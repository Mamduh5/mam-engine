import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";

import { FIXED_TIMESTEP_SECONDS, simulateMovement, type SimulationResult } from "../../domain/movement/movementSimulation";
import type { MovementProfile, MovementScenario } from "../../domain/movement/movementTypes";
import { MOVEMENT_FIXTURE_ID, RUNTIME_RUN_COMMAND, RUNTIME_SCHEMA_VERSION, type RuntimeRequest, type RuntimeResponse } from "../../domain/runtime/runtimeProtocol";
import { validateRuntimeRequest, validateRuntimeResponse } from "../../domain/runtime/runtimeValidation";
import { captureWorkspaceState, diffFileStates } from "../../infrastructure/files/changedFileAudit";
import { fileExists } from "../../infrastructure/files/jsonFileStore";
import { discoverGodot, GodotDiscoveryError, type GodotExecutable } from "../../infrastructure/runtime/godotDiscovery";
import { runGodotProcess, type ProcessRunnerOptions } from "../../infrastructure/runtime/godotProcessRunner";
import { createRuntimeSession, readSessionJson, removeRuntimeSession, writeSessionJson, type RuntimeSession } from "../../infrastructure/runtime/runtimeSessionStore";
import { ErrorCodes, type ErrorCode } from "../../shared/errorCodes";

export class RuntimeFixtureError extends Error {
  constructor(public readonly code: ErrorCode, message: string, public readonly session: RuntimeSession | null = null, public readonly details: Record<string, unknown> = {}) { super(message); }
}

export interface RuntimeFixtureExecution {
  executable: GodotExecutable;
  request: RuntimeRequest;
  readiness: RuntimeResponse;
  response: RuntimeResponse;
  process: Awaited<ReturnType<typeof runGodotProcess>>;
  simulation: SimulationResult;
  session: { retained: boolean; path: string | null };
  runtimeSession: RuntimeSession;
  internalArtifacts: string[];
}

export interface RunMovementFixtureOptions extends ProcessRunnerOptions { godot?: string; keepSession?: boolean; timeoutMs?: number }

export async function runMovementFixture(workspaceRoot: string, profile: MovementProfile, scenario: MovementScenario, seconds: number | undefined, cameraYawDegrees: number, options: RunMovementFixtureOptions = {}): Promise<RuntimeFixtureExecution> {
  const before = await captureWorkspaceState(workspaceRoot);
  let executable: GodotExecutable;
  try { executable = await discoverGodot(options.godot); }
  catch (caught) { if (caught instanceof GodotDiscoveryError) throw new RuntimeFixtureError(caught.code, caught.message); throw caught; }
  const projectPath = path.join(workspaceRoot, "runtime", "godot");
  try { if (!(await stat(path.join(projectPath, "project.godot"))).isFile()) throw new Error(); }
  catch { throw new RuntimeFixtureError(ErrorCodes.RuntimeProjectNotFound, "Godot runtime project was not found"); }

  const correlationId = randomUUID();
  const simulation = simulateMovement(profile, scenario, seconds);
  const durationSeconds = requestedDuration(profile, scenario, seconds, simulation);
  const request: RuntimeRequest = {
    schemaVersion: RUNTIME_SCHEMA_VERSION, commandId: RUNTIME_RUN_COMMAND, fixtureId: MOVEMENT_FIXTURE_ID, correlationId,
    requestedAt: new Date().toISOString(), timeoutMs: Math.min(Math.max(options.timeoutMs ?? 10_000, 1), 60_000),
    payload: { definitionSchemaVersion: 1, profile, scenario: { id: scenario, durationSeconds, fixedDeltaSeconds: FIXED_TIMESTEP_SECONDS, cameraYawDegrees } }
  };
  const requestValidation = validateRuntimeRequest(request);
  if (!requestValidation.valid) throw new RuntimeFixtureError(ErrorCodes.RuntimeRequestInvalid, "Runtime request validation failed", null, { errors: requestValidation.errors });
  const session = await createRuntimeSession(workspaceRoot, correlationId);
  await writeSessionJson(session.requestPath, request);
  await writeSessionJson(session.metadataPath, { correlationId, state: "created", executableSource: executable.source, requestedAt: request.requestedAt });
  try {
    let processResult: Awaited<ReturnType<typeof runGodotProcess>>;
    try { processResult = await runGodotProcess(executable.path, projectPath, session, { ...options, executionTimeoutMs: Math.min(options.executionTimeoutMs ?? 15_000, 60_000) }); }
    catch (caught) { throw new RuntimeFixtureError(ErrorCodes.RuntimeStartFailed, caught instanceof Error ? caught.message : String(caught), session); }
    if (processResult.timedOut) throw new RuntimeFixtureError(ErrorCodes.RuntimeTimeout, "Godot runtime exceeded its deadline and was terminated", session, { process: processResult });
    if (!processResult.readyObserved) throw new RuntimeFixtureError(ErrorCodes.RuntimeNotReady, "Godot exited before writing readiness", session, { process: processResult });
    let readyValue: unknown;
    try { readyValue = await readSessionJson(session.readyPath); } catch { throw new RuntimeFixtureError(ErrorCodes.RuntimeResponseInvalid, "Godot readiness file is missing or malformed", session); }
    const ready = validateRuntimeResponse(readyValue, { correlationId, fixtureId: MOVEMENT_FIXTURE_ID, commandId: "runtime.fixture.ready", status: "ready" });
    if (!ready.valid || !ready.value) throw responseValidationError(ready.errors, "readiness", session);
    if (processResult.exitCode !== 0) throw new RuntimeFixtureError(ErrorCodes.RuntimeProcessExited, `Godot exited with code ${processResult.exitCode ?? "unknown"}`, session, { process: processResult });
    let responseValue: unknown;
    if (!await fileExists(session.responsePath)) throw new RuntimeFixtureError(ErrorCodes.RuntimeResponseMissing, "Godot final response is missing", session);
    try { responseValue = await readSessionJson(session.responsePath); } catch { throw new RuntimeFixtureError(ErrorCodes.RuntimeResponseInvalid, "Godot final response contains malformed JSON", session); }
    const response = validateRuntimeResponse(responseValue, { correlationId, fixtureId: MOVEMENT_FIXTURE_ID, commandId: RUNTIME_RUN_COMMAND, status: ["ok", "rejected", "failed"] });
    if (!response.valid || !response.value) throw responseValidationError(response.errors, "response", session);
    if (response.value.status !== "ok") throw new RuntimeFixtureError(ErrorCodes.RuntimeExecutionFailed, `Godot runtime returned ${response.value.status}`, session, { validationErrors: response.value.validationErrors, runtimeErrors: response.value.runtimeErrors });
    const after = await captureWorkspaceState(workspaceRoot);
    const changed = diffFileStates(before, after);
    const internalArtifacts = changed.filter(isAllowedRuntimeArtifact);
    const unexpected = changed.filter((file) => !isAllowedRuntimeArtifact(file));
    if (unexpected.length > 0) throw new RuntimeFixtureError(ErrorCodes.RuntimeUnexpectedFileChange, "Godot runtime changed files outside its allowlist", session, { unexpectedFiles: unexpected });
    const retain = options.keepSession === true;
    if (!retain) await removeRuntimeSession(session);
    return { executable, request, readiness: ready.value, response: response.value, process: processResult, simulation, session: { retained: retain, path: retain ? session.relativeDirectory : null }, runtimeSession: session, internalArtifacts };
  } catch (caught) {
    await writeSessionJson(session.metadataPath, { correlationId, state: "failed", code: caught instanceof RuntimeFixtureError ? caught.code : ErrorCodes.RuntimeExecutionFailed }).catch(() => undefined);
    if (caught instanceof RuntimeFixtureError) throw caught;
    throw new RuntimeFixtureError(ErrorCodes.RuntimeExecutionFailed, caught instanceof Error ? caught.message : String(caught), session);
  }
}

function requestedDuration(profile: MovementProfile, scenario: MovementScenario, seconds: number | undefined, simulation: SimulationResult): number {
  if (scenario === "dodge") return profile.dodge.durationSeconds;
  if (scenario === "turn") return Number(simulation.metrics.timeToTargetYawSeconds);
  if (seconds !== undefined) return seconds;
  if (scenario === "stop") return profile.ground.runSpeed / profile.ground.deceleration + FIXED_TIMESTEP_SECONDS;
  return scenario === "accelerate" ? 3 : 5;
}

function responseValidationError(errors: string[], label: string, session: RuntimeSession): RuntimeFixtureError {
  const joined = errors.join(", ");
  const code = joined.includes("protocol") ? ErrorCodes.RuntimeProtocolMismatch : joined.includes("correlation") ? ErrorCodes.RuntimeCorrelationMismatch : joined.includes("fixture") ? ErrorCodes.RuntimeFixtureMismatch : ErrorCodes.RuntimeResponseInvalid;
  return new RuntimeFixtureError(code, `Runtime ${label} validation failed`, session, { errors });
}
function isAllowedRuntimeArtifact(file: string): boolean { return file.startsWith(".mam-engine/runtime-sessions/") || file.startsWith("runtime/godot/.godot/"); }
