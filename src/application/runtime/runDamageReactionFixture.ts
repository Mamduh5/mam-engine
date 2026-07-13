import { randomUUID } from "node:crypto";

import { DAMAGE_REACTION_FIXED_DELTA_SECONDS, simulateDamageReactionHit } from "../../domain/damageReaction/damageReactionSimulation";
import type { DamageReactionProfile, DamageReactionSimulation } from "../../domain/damageReaction/damageReactionTypes";
import type { HealthProfile } from "../../domain/health/healthTypes";
import type { OffensiveActionProfile } from "../../domain/offensiveAction/offensiveActionTypes";
import { DAMAGE_REACTION_FIXTURE_ID, RUNTIME_RUN_COMMAND, RUNTIME_SCHEMA_VERSION, type DamageReactionRuntimeRequest, type DamageReactionRuntimeScenario, type RuntimeResponse } from "../../domain/runtime/runtimeProtocol";
import { validateRuntimeRequest, validateRuntimeResponse } from "../../domain/runtime/runtimeValidation";
import { captureWorkspaceState, diffFileStates } from "../../infrastructure/files/changedFileAudit";
import { fileExists } from "../../infrastructure/files/jsonFileStore";
import { discoverGodot, GodotDiscoveryError, type GodotExecutable } from "../../infrastructure/runtime/godotDiscovery";
import { runGodotProcess, type ProcessRunnerOptions } from "../../infrastructure/runtime/godotProcessRunner";
import { createRuntimeSession, readSessionJson, removeRuntimeSession, writeSessionJson, type RuntimeSession } from "../../infrastructure/runtime/runtimeSessionStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { resolveRuntimeProjectPath, RuntimeFixtureError } from "./runMovementFixture";

export interface RunDamageReactionFixtureOptions extends ProcessRunnerOptions { godot?: string; keepSession?: boolean; timeoutMs?: number }
export interface DamageReactionRuntimeFixtureExecution { executable: GodotExecutable; request: DamageReactionRuntimeRequest; readiness: RuntimeResponse; response: RuntimeResponse; process: Awaited<ReturnType<typeof runGodotProcess>>; simulation: DamageReactionSimulation; session: { retained: boolean; path: string | null }; runtimeSession: RuntimeSession; internalArtifacts: string[] }

export async function runDamageReactionFixture(workspaceRoot: string, reaction: DamageReactionProfile, health: HealthProfile, action: OffensiveActionProfile, scenario: DamageReactionRuntimeScenario, fixedDeltaSeconds = DAMAGE_REACTION_FIXED_DELTA_SECONDS, options: RunDamageReactionFixtureOptions = {}): Promise<DamageReactionRuntimeFixtureExecution> {
  const before = await captureWorkspaceState(workspaceRoot); let executable: GodotExecutable;
  try { executable = await discoverGodot(options.godot); } catch (caught) { if (caught instanceof GodotDiscoveryError) throw new RuntimeFixtureError(caught.code, caught.message); throw caught; }
  const projectPath = await resolveRuntimeProjectPath();
  const correlationId = randomUUID(); const simulation = simulateDamageReactionHit(reaction, health, action, true, fixedDeltaSeconds);
  const request: DamageReactionRuntimeRequest = { schemaVersion: RUNTIME_SCHEMA_VERSION, commandId: RUNTIME_RUN_COMMAND, fixtureId: DAMAGE_REACTION_FIXTURE_ID, correlationId, requestedAt: new Date().toISOString(), timeoutMs: Math.min(Math.max(options.timeoutMs ?? 10_000, 1), 60_000), payload: { reactionDefinitionKind: "damage-reaction-profile", reactionDefinitionSchemaVersion: 1, reactionProfile: reaction, healthDefinitionKind: "health-profile", healthDefinitionSchemaVersion: 1, healthProfile: health, offensiveActionDefinitionKind: "offensive-action-profile", offensiveActionDefinitionSchemaVersion: 1, offensiveActionProfile: action, scenario: { id: scenario, durationSeconds: simulation.reactionTotalSteps * fixedDeltaSeconds, fixedDeltaSeconds, targetActionWasActive: true } } };
  const requestValidation = validateRuntimeRequest(request); if (!requestValidation.valid) throw new RuntimeFixtureError(ErrorCodes.RuntimeRequestInvalid, "Damage reaction runtime request validation failed", null, { errors: requestValidation.errors });
  const session = await createRuntimeSession(workspaceRoot, correlationId); await writeSessionJson(session.requestPath, request); await writeSessionJson(session.metadataPath, { correlationId, state: "created", fixtureId: DAMAGE_REACTION_FIXTURE_ID, executableSource: executable.source, requestedAt: request.requestedAt });
  try {
    let processResult: Awaited<ReturnType<typeof runGodotProcess>>; try { processResult = await runGodotProcess(executable.path, projectPath, session, { ...options, executionTimeoutMs: Math.min(options.executionTimeoutMs ?? 15_000, 60_000) }); } catch (caught) { throw new RuntimeFixtureError(ErrorCodes.RuntimeStartFailed, caught instanceof Error ? caught.message : String(caught), session); }
    if (processResult.timedOut) throw new RuntimeFixtureError(ErrorCodes.RuntimeTimeout, "Godot damage reaction runtime exceeded its deadline and was terminated", session, { process: processResult });
    if (!processResult.readyObserved) throw new RuntimeFixtureError(ErrorCodes.RuntimeNotReady, "Godot exited before writing damage reaction readiness", session, { process: processResult });
    let readyValue: unknown; try { readyValue = await readSessionJson(session.readyPath); } catch { throw new RuntimeFixtureError(ErrorCodes.RuntimeResponseInvalid, "Godot readiness file is missing or malformed", session); }
    const ready = validateRuntimeResponse(readyValue, { correlationId, fixtureId: DAMAGE_REACTION_FIXTURE_ID, commandId: "runtime.fixture.ready", status: "ready" }); if (!ready.valid || !ready.value) throw responseValidationError(ready.errors, "readiness", session);
    if (processResult.exitCode !== 0) throw new RuntimeFixtureError(ErrorCodes.RuntimeProcessExited, `Godot exited with code ${processResult.exitCode ?? "unknown"}`, session, { process: processResult });
    if (!await fileExists(session.responsePath)) throw new RuntimeFixtureError(ErrorCodes.RuntimeResponseMissing, "Godot damage reaction final response is missing", session);
    let responseValue: unknown; try { responseValue = await readSessionJson(session.responsePath); } catch { throw new RuntimeFixtureError(ErrorCodes.RuntimeResponseInvalid, "Godot damage reaction response contains malformed JSON", session); }
    const response = validateRuntimeResponse(responseValue, { correlationId, fixtureId: DAMAGE_REACTION_FIXTURE_ID, commandId: RUNTIME_RUN_COMMAND, status: ["ok", "rejected", "failed"], scenarioId: scenario }); if (!response.valid || !response.value) throw responseValidationError(response.errors, "response", session); if (response.value.status !== "ok") throw new RuntimeFixtureError(ErrorCodes.RuntimeExecutionFailed, `Godot damage reaction runtime returned ${response.value.status}`, session, { validationErrors: response.value.validationErrors, runtimeErrors: response.value.runtimeErrors });
    const changed = diffFileStates(before, await captureWorkspaceState(workspaceRoot)); const internalArtifacts = changed.filter(isAllowedRuntimeArtifact); const unexpected = changed.filter((file) => !isAllowedRuntimeArtifact(file)); if (unexpected.length > 0) throw new RuntimeFixtureError(ErrorCodes.RuntimeUnexpectedFileChange, "Godot damage reaction runtime changed files outside its allowlist", session, { unexpectedFiles: unexpected });
    const retain = options.keepSession === true; if (!retain) await removeRuntimeSession(session); return { executable, request, readiness: ready.value, response: response.value, process: processResult, simulation, session: { retained: retain, path: retain ? session.relativeDirectory : null }, runtimeSession: session, internalArtifacts };
  } catch (caught) { await writeSessionJson(session.metadataPath, { correlationId, state: "failed", code: caught instanceof RuntimeFixtureError ? caught.code : ErrorCodes.RuntimeExecutionFailed }).catch(() => undefined); if (caught instanceof RuntimeFixtureError) throw caught; throw new RuntimeFixtureError(ErrorCodes.RuntimeExecutionFailed, caught instanceof Error ? caught.message : String(caught), session); }
}

function responseValidationError(errors: string[], label: string, session: RuntimeSession): RuntimeFixtureError { const joined = errors.join(", "); const code = joined.includes("protocol") ? ErrorCodes.RuntimeProtocolMismatch : joined.includes("correlation") ? ErrorCodes.RuntimeCorrelationMismatch : joined.includes("fixture") ? ErrorCodes.RuntimeFixtureMismatch : ErrorCodes.RuntimeResponseInvalid; return new RuntimeFixtureError(code, `Damage reaction runtime ${label} validation failed`, session, { errors }); }
function isAllowedRuntimeArtifact(file: string): boolean { return file.startsWith(".mam-engine/runtime-sessions/") || file.startsWith("runtime/godot/.godot/"); }
