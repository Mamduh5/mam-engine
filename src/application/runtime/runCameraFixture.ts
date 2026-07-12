import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";

import { CAMERA_FIXED_DELTA_SECONDS, simulateCamera } from "../../domain/camera/cameraSimulation";
import type { CameraProfile, CameraScenario } from "../../domain/camera/cameraTypes";
import { CAMERA_FIXTURE_ID, RUNTIME_RUN_COMMAND, RUNTIME_SCHEMA_VERSION, type CameraRuntimeRequest, type RuntimeResponse } from "../../domain/runtime/runtimeProtocol";
import { validateRuntimeRequest, validateRuntimeResponse } from "../../domain/runtime/runtimeValidation";
import { captureWorkspaceState, diffFileStates } from "../../infrastructure/files/changedFileAudit";
import { fileExists } from "../../infrastructure/files/jsonFileStore";
import { discoverGodot, GodotDiscoveryError, type GodotExecutable } from "../../infrastructure/runtime/godotDiscovery";
import { runGodotProcess, type ProcessRunnerOptions } from "../../infrastructure/runtime/godotProcessRunner";
import { createRuntimeSession, readSessionJson, removeRuntimeSession, writeSessionJson, type RuntimeSession } from "../../infrastructure/runtime/runtimeSessionStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { RuntimeFixtureError } from "./runMovementFixture";

export interface CameraFixtureExecution {
  executable: GodotExecutable;
  request: CameraRuntimeRequest;
  readiness: RuntimeResponse;
  response: RuntimeResponse;
  process: Awaited<ReturnType<typeof runGodotProcess>>;
  simulation: ReturnType<typeof simulateCamera>;
  session: { retained: boolean; path: string | null };
  runtimeSession: RuntimeSession;
  internalArtifacts: string[];
}
export interface RunCameraFixtureOptions extends ProcessRunnerOptions { godot?: string; keepSession?: boolean; timeoutMs?: number; fixedDeltaSeconds?: number; variant?: "default" | "disabled" | "below-threshold" | "manual-input" }

export async function runCameraFixture(workspaceRoot: string, profile: CameraProfile, scenario: CameraScenario, seconds: number | undefined, options: RunCameraFixtureOptions = {}): Promise<CameraFixtureExecution> {
  const fixedDelta = options.fixedDeltaSeconds ?? CAMERA_FIXED_DELTA_SECONDS;
  const simulationProfile = scenario === "recenter" && options.variant === "disabled" ? { ...profile, recenter: { ...profile.recenter, enabled: false } } : profile;
  const simulationOptions = scenario === "recenter" && options.variant === "below-threshold" ? { movementInputMagnitude: Math.max(0, profile.recenter.movementInputThreshold - 0.01) } : scenario === "recenter" && options.variant === "manual-input" ? { manualYawInput: 1 } : undefined;
  const simulation = scenario === "recenter" && simulationOptions
    ? { scenario, metrics: (await import("../../domain/camera/cameraSimulation")).simulateRecenter(simulationProfile, seconds ?? defaultDuration(simulationProfile, scenario), fixedDelta, simulationOptions) }
    : simulateCamera(simulationProfile, scenario, seconds, fixedDelta);
  const simulationMetrics = simulation.metrics as Record<string, unknown>;
  const durationSeconds = scenario === "basis" ? 0 : Number(simulationMetrics.durationSeconds ?? Number(simulationMetrics.physicsSteps) * fixedDelta);
  const correlationId = randomUUID();
  const request: CameraRuntimeRequest = {
    schemaVersion: RUNTIME_SCHEMA_VERSION, commandId: RUNTIME_RUN_COMMAND, fixtureId: CAMERA_FIXTURE_ID, correlationId,
    requestedAt: new Date().toISOString(), timeoutMs: Math.min(Math.max(options.timeoutMs ?? 15_000, 1), 60_000),
    payload: { definitionKind: "camera-profile", definitionSchemaVersion: 1, profile, scenario: { id: scenario, durationSeconds, fixedDeltaSeconds: fixedDelta, ...(options.variant ? { variant: options.variant } : {}) } }
  };
  const requestValidation = validateRuntimeRequest(request);
  if (!requestValidation.valid) throw new RuntimeFixtureError(ErrorCodes.RuntimeRequestInvalid, "Camera runtime request validation failed", null, { errors: requestValidation.errors });
  const before = await captureWorkspaceState(workspaceRoot);
  let executable: GodotExecutable;
  try { executable = await discoverGodot(options.godot); }
  catch (caught) { if (caught instanceof GodotDiscoveryError) throw new RuntimeFixtureError(caught.code, caught.message); throw caught; }
  const projectPath = path.join(workspaceRoot, "runtime", "godot");
  try { if (!(await stat(path.join(projectPath, "project.godot"))).isFile()) throw new Error(); }
  catch { throw new RuntimeFixtureError(ErrorCodes.RuntimeProjectNotFound, "Godot runtime project was not found"); }
  const session = await createRuntimeSession(workspaceRoot, correlationId);
  await writeSessionJson(session.requestPath, request);
  await writeSessionJson(session.metadataPath, { correlationId, state: "created", fixtureId: CAMERA_FIXTURE_ID, executableSource: executable.source, requestedAt: request.requestedAt });
  try {
    let processResult: Awaited<ReturnType<typeof runGodotProcess>>;
    try { processResult = await runGodotProcess(executable.path, projectPath, session, { ...options, executionTimeoutMs: Math.min(options.executionTimeoutMs ?? 20_000, 60_000) }); }
    catch (caught) { throw new RuntimeFixtureError(ErrorCodes.RuntimeStartFailed, caught instanceof Error ? caught.message : String(caught), session); }
    if (processResult.timedOut) throw new RuntimeFixtureError(ErrorCodes.RuntimeTimeout, "Godot camera runtime exceeded its deadline and was terminated", session, { process: processResult });
    if (!processResult.readyObserved) throw new RuntimeFixtureError(ErrorCodes.RuntimeNotReady, "Godot exited before writing camera readiness", session, { process: processResult });
    let readyValue: unknown; try { readyValue = await readSessionJson(session.readyPath); } catch { throw new RuntimeFixtureError(ErrorCodes.RuntimeResponseInvalid, "Godot readiness file is missing or malformed", session); }
    const ready = validateRuntimeResponse(readyValue, { correlationId, fixtureId: CAMERA_FIXTURE_ID, commandId: "runtime.fixture.ready", status: "ready" });
    if (!ready.valid || !ready.value) throw responseValidationError(ready.errors, "readiness", session);
    if (processResult.exitCode !== 0) throw new RuntimeFixtureError(ErrorCodes.RuntimeProcessExited, `Godot exited with code ${processResult.exitCode ?? "unknown"}`, session, { process: processResult });
    if (!await fileExists(session.responsePath)) throw new RuntimeFixtureError(ErrorCodes.RuntimeResponseMissing, "Godot camera final response is missing", session);
    let responseValue: unknown; try { responseValue = await readSessionJson(session.responsePath); } catch { throw new RuntimeFixtureError(ErrorCodes.RuntimeResponseInvalid, "Godot camera response contains malformed JSON", session); }
    const response = validateRuntimeResponse(responseValue, { correlationId, fixtureId: CAMERA_FIXTURE_ID, commandId: RUNTIME_RUN_COMMAND, status: ["ok", "rejected", "failed"], scenarioId: scenario });
    if (!response.valid || !response.value) throw responseValidationError(response.errors, "response", session);
    if (response.value.status !== "ok") throw new RuntimeFixtureError(ErrorCodes.RuntimeExecutionFailed, `Godot camera runtime returned ${response.value.status}`, session, { validationErrors: response.value.validationErrors, runtimeErrors: response.value.runtimeErrors });
    const after = await captureWorkspaceState(workspaceRoot); const changed = diffFileStates(before, after);
    const internalArtifacts = changed.filter(isAllowedRuntimeArtifact); const unexpected = changed.filter((file) => !isAllowedRuntimeArtifact(file));
    if (unexpected.length > 0) throw new RuntimeFixtureError(ErrorCodes.RuntimeUnexpectedFileChange, "Godot camera runtime changed files outside its allowlist", session, { unexpectedFiles: unexpected });
    const retain = options.keepSession === true; if (!retain) await removeRuntimeSession(session);
    return { executable, request, readiness: ready.value, response: response.value, process: processResult, simulation, session: { retained: retain, path: retain ? session.relativeDirectory : null }, runtimeSession: session, internalArtifacts };
  } catch (caught) {
    await writeSessionJson(session.metadataPath, { correlationId, state: "failed", code: caught instanceof RuntimeFixtureError ? caught.code : ErrorCodes.RuntimeExecutionFailed }).catch(() => undefined);
    if (caught instanceof RuntimeFixtureError) throw caught;
    throw new RuntimeFixtureError(ErrorCodes.RuntimeExecutionFailed, caught instanceof Error ? caught.message : String(caught), session);
  }
}

function defaultDuration(profile: CameraProfile, scenario: CameraScenario): number { if (scenario === "recenter") return profile.recenter.delaySeconds + 120 / profile.recenter.yawSpeedDegreesPerSecond + 0.5; return 2; }
function responseValidationError(errors: string[], label: string, session: RuntimeSession): RuntimeFixtureError { const joined = errors.join(", "); const code = joined.includes("protocol") ? ErrorCodes.RuntimeProtocolMismatch : joined.includes("correlation") ? ErrorCodes.RuntimeCorrelationMismatch : joined.includes("fixture") ? ErrorCodes.RuntimeFixtureMismatch : ErrorCodes.RuntimeResponseInvalid; return new RuntimeFixtureError(code, `Camera runtime ${label} validation failed`, session, { errors }); }
function isAllowedRuntimeArtifact(file: string): boolean { return file.startsWith(".mam-engine/runtime-sessions/") || file.startsWith("runtime/godot/.godot/"); }
