import { randomUUID } from "node:crypto";

import { FIXED_TIMESTEP_SECONDS } from "../../domain/movement/movementSimulation";
import { MOVEMENT_SANDBOX_FIXTURE_ID, RUNTIME_RUN_COMMAND, RUNTIME_SCHEMA_VERSION, type RuntimeRequest } from "../../domain/runtime/runtimeProtocol";
import { validateRuntimeRequest, validateRuntimeResponse } from "../../domain/runtime/runtimeValidation";
import { captureWorkspaceState, diffFileStates } from "../../infrastructure/files/changedFileAudit";
import { fileExists } from "../../infrastructure/files/jsonFileStore";
import { discoverGodot } from "../../infrastructure/runtime/godotDiscovery";
import { runGodotProcess } from "../../infrastructure/runtime/godotProcessRunner";
import { createRuntimeSession, readSessionJson, removeRuntimeSession, writeSessionJson } from "../../infrastructure/runtime/runtimeSessionStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedMovement, loadErrors, loadValidMovement } from "../movement/movementOperationSupport";
import { inspectProjectWorkspace, loadProject } from "../project/projectOperations";
import { resolveRuntimeProjectPath, RuntimeFixtureError } from "./runMovementFixture";

export interface RunProjectPlayOptions { godot?: string; keepSession?: boolean; automatedInput?: boolean; executionTimeoutMs?: number }

export async function runProjectPlay(workspaceRoot: string, options: RunProjectPlayOptions = {}): Promise<OperationResult> {
  const command = "project.play";
  const inspection = await inspectProjectWorkspace(workspaceRoot);
  if (!inspection.valid || inspection.manifest?.entryMovementFile == null) return operationResult({ command, status: "failed", errors: [{ code: ErrorCodes.ProjectValidationFailed, message: "Project validation must pass before play", details: { findings: inspection.findings } }] });
  const loaded = await loadProject(workspaceRoot);
  if (!("manifest" in loaded)) return operationResult({ command, status: "failed", errors: loaded.errors });
  const movement = await loadValidMovement(workspaceRoot, inspection.manifest.entryMovementFile);
  if (!isLoadedMovement(movement)) return operationResult({ command, status: "failed", errors: loadErrors(movement) });
  const automated = options.automatedInput === true;
  const correlationId = randomUUID();
  const request: RuntimeRequest = {
    schemaVersion: RUNTIME_SCHEMA_VERSION,
    commandId: RUNTIME_RUN_COMMAND,
    fixtureId: MOVEMENT_SANDBOX_FIXTURE_ID,
    correlationId,
    requestedAt: new Date().toISOString(),
    timeoutMs: 60_000,
    payload: { definitionKind: "movement-profile", definitionSchemaVersion: 1, profile: movement.profile, scenario: { id: automated ? "automated" : "interactive", durationSeconds: automated ? 3 : 0, fixedDeltaSeconds: FIXED_TIMESTEP_SECONDS, automatedInput: automated } }
  };
  const requestValidation = validateRuntimeRequest(request);
  if (!requestValidation.valid) return operationResult({ command, status: "failed", errors: [{ code: ErrorCodes.RuntimeRequestInvalid, message: "Movement sandbox request validation failed", details: { errors: requestValidation.errors } }] });
  const before = await captureWorkspaceState(workspaceRoot);
  const session = await createRuntimeSession(workspaceRoot, correlationId);
  try {
    const executable = await discoverGodot(options.godot);
    const projectPath = await resolveRuntimeProjectPath();
    await writeSessionJson(session.requestPath, request);
    await writeSessionJson(session.metadataPath, { correlationId, state: "created", requestedAt: request.requestedAt, mode: automated ? "automated" : "interactive" });
    const process = await runGodotProcess(executable.path, projectPath, session, { interactive: !automated, executionTimeoutMs: options.executionTimeoutMs ?? (automated ? 20_000 : 600_000) });
    if (process.timedOut) throw new RuntimeFixtureError(ErrorCodes.RuntimeTimeout, "Movement sandbox exceeded its deadline", session);
    if (!process.readyObserved) throw new RuntimeFixtureError(ErrorCodes.RuntimeNotReady, "Movement sandbox exited before readiness", session);
    const ready = validateRuntimeResponse(await readSessionJson(session.readyPath), { correlationId, fixtureId: MOVEMENT_SANDBOX_FIXTURE_ID, commandId: "runtime.fixture.ready", status: "ready" });
    if (!ready.valid) throw new RuntimeFixtureError(ErrorCodes.RuntimeResponseInvalid, "Movement sandbox readiness is invalid", session, { errors: ready.errors });
    if (process.exitCode !== 0) throw new RuntimeFixtureError(ErrorCodes.RuntimeProcessExited, `Movement sandbox exited with code ${process.exitCode ?? "unknown"}`, session);
    if (!await fileExists(session.responsePath)) throw new RuntimeFixtureError(ErrorCodes.RuntimeResponseMissing, "Movement sandbox response is missing", session);
    const response = validateRuntimeResponse(await readSessionJson(session.responsePath), { correlationId, fixtureId: MOVEMENT_SANDBOX_FIXTURE_ID, commandId: RUNTIME_RUN_COMMAND, status: "ok" });
    if (!response.valid || response.value === undefined) throw new RuntimeFixtureError(ErrorCodes.RuntimeResponseInvalid, "Movement sandbox response is invalid", session, { errors: response.errors });
    const after = await captureWorkspaceState(workspaceRoot);
    const changed = diffFileStates(before, after);
    const unexpected = changed.filter((file) => !file.startsWith(".mam-engine/runtime-sessions/"));
    if (unexpected.length > 0) throw new RuntimeFixtureError(ErrorCodes.RuntimeUnexpectedFileChange, "Movement sandbox changed files outside its runtime session", session, { unexpected });
    const retained = options.keepSession === true;
    if (!retained) await removeRuntimeSession(session);
    return operationResult({ command, status: "passed", input: { projectId: loaded.manifest.id, entryMovementFile: movement.relativePath, mode: automated ? "automated" : "interactive" }, data: { projectId: loaded.manifest.id, entryMovementFile: movement.relativePath, launched: true, nonHeadless: !automated, metrics: response.value.metrics, evidence: response.value.evidence, process, session: { retained, path: retained ? session.relativeDirectory : null } }, changedFiles: [] });
  } catch (caught) {
    await writeSessionJson(session.metadataPath, { correlationId, state: "failed", message: caught instanceof Error ? caught.message : String(caught) }).catch(() => undefined);
    const runtime = caught instanceof RuntimeFixtureError ? caught : new RuntimeFixtureError(ErrorCodes.ProjectRuntimeFailed, caught instanceof Error ? caught.message : String(caught), session);
    return operationResult({ command, status: "failed", errors: [{ code: runtime.code, message: runtime.message, details: runtime.details }] });
  }
}
