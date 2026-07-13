import type { EncounterRuntimeCheckpoint } from "../../domain/runtime/encounterCheckpoint";
import { validateEncounterCheckpoint } from "../../domain/runtime/encounterCheckpoint";
import { removeRuntimeSession } from "../../infrastructure/runtime/runtimeSessionStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedEncounterBundle, loadValidEncounterBundle, type LoadedEncounterBundle } from "../encounter/encounterOperationSupport";
import { runtimeFailure } from "./checkRuntime";
import { compareEncounterRuntime } from "./compareEncounterRuntime";
import { runEncounterFixture, type RunEncounterFixtureOptions } from "./runEncounterFixture";

export interface RunEncounterRecoveryOptions extends RunEncounterFixtureOptions { tamperCheckpoint?: (checkpoint: EncounterRuntimeCheckpoint) => unknown }

export async function runEncounterRecoveryTest(workspaceRoot: string, encounterFile: string, interruptAfterRound = 1, fixedDelta = 1 / 60, options: RunEncounterRecoveryOptions = {}): Promise<OperationResult> {
  const command = "encounter.recovery-test"; const scenario = "successful-hunt" as const; const input = { file: encounterFile, scenario, interruptAfterRound, fixedDelta };
  if (!Number.isFinite(fixedDelta) || fixedDelta <= 0 || fixedDelta > 1) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.CliArgumentInvalid, path: "fixedDelta", message: "fixed delta must be finite, greater than zero, and at most 1", actual: fixedDelta, expected: "(0, 1]" }] });
  const loaded = await loadValidEncounterBundle(workspaceRoot, encounterFile); if (!isLoadedEncounterBundle(loaded)) return operationResult({ command, status: "failed", input, errors: loaded.errors });
  if (!Number.isInteger(interruptAfterRound) || interruptAfterRound < 1 || interruptAfterRound >= loaded.profile.maxRounds) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.CliArgumentInvalid, path: "interruptAfterRound", message: "interrupt-after-round must be a completed non-final round", actual: interruptAfterRound, expected: `integer in 1..${loaded.profile.maxRounds - 1}` }] });
  let first: Awaited<ReturnType<typeof runEncounterFixture>> | undefined;
  try {
    first = await runEncounterFixture(workspaceRoot, loaded, scenario, fixedDelta, { ...options, interactive: false, mode: "recovery-initial", interruptAfterRound, keepSession: true });
    const expected = expectations(loaded, first.simulation.hunterStartingStamina); const firstValidation = validateEncounterCheckpoint(first.checkpoint, { ...expected, requireResumable: true });
    const checkpointCandidate = firstValidation.valid && firstValidation.checkpoint && options.tamperCheckpoint ? options.tamperCheckpoint(firstValidation.checkpoint) : first.checkpoint; const validation = validateEncounterCheckpoint(checkpointCandidate, { ...expected, requireResumable: true });
    if (!validation.valid || !validation.checkpoint) {
      if (options.keepSession !== true) await removeRuntimeSession(first.runtimeSession);
      return operationResult({ command, status: "failed", input: { ...input, file: loaded.relativePath }, data: { checkpointCreated: firstValidation.valid, checkpointPath: options.keepSession === true ? `${first.runtimeSession.relativeDirectory}/encounter-checkpoint.json` : null, interruptionRound: interruptAfterRound, secondProcessLaunched: false, processLaunchCount: 1, checkpointErrors: validation.errors }, errors: [{ code: ErrorCodes.EncounterCheckpointInvalid, message: "Encounter recovery checkpoint validation failed before resume execution", details: { errors: validation.errors } }] });
    }
    const checkpoint = validation.checkpoint; const second = await runEncounterFixture(workspaceRoot, loaded, scenario, fixedDelta, { ...options, interactive: false, mode: "recovery-resume", recoveryCheckpoint: checkpoint, keepSession: true }); const comparison = compareEncounterRuntime(second.simulation, second.response.metrics);
    const recovered = { currentHunterStamina: checkpoint.currentHunterStamina, currentEnemyHealth: checkpoint.currentEnemyHealth, roundsCompleted: checkpoint.roundsCompleted, totalConsumedStamina: checkpoint.totalConsumedStamina, totalAppliedDamage: checkpoint.totalAppliedDamage };
    if (comparison.passed && options.keepSession !== true) { await Promise.all([removeRuntimeSession(first.runtimeSession), removeRuntimeSession(second.runtimeSession)]); first.session = { retained: false, path: null }; second.session = { retained: false, path: null }; }
    const data = { checkpointCreated: true, checkpointPath: first.session.retained ? `${first.session.path}/encounter-checkpoint.json` : null, interruptionRound: interruptAfterRound, resumedFromRound: checkpoint.nextRoundNumber, recoveredStateValues: recovered, secondProcessLaunched: true, processLaunchCount: 2, finalEncounterReport: second.response.metrics, comparison, sessions: { interrupted: first.session, resumed: second.session } };
    if (!comparison.passed) return operationResult({ command, status: "failed", input, data, errors: [{ code: ErrorCodes.RuntimeMetricToleranceExceeded, message: "Recovered encounter differs from the uninterrupted TypeScript simulation", details: { failedMetrics: comparison.metrics.filter((metric) => !metric.passed) } }] });
    return operationResult({ command, status: "passed", input: { ...input, file: loaded.relativePath }, data });
  } catch (caught) { if (first && options.keepSession !== true) await removeRuntimeSession(first.runtimeSession).catch(() => undefined); return runtimeFailure(command, caught, input); }
}

function expectations(loaded: LoadedEncounterBundle, startingStamina: number) { return { encounterId: loaded.profile.id, scenarioId: "successful-hunt" as const, selectedBodyPartId: loaded.selectedBodyPartId, maximumRounds: loaded.profile.maxRounds, startingStamina, maximumStamina: loaded.hunter.stamina.maxStamina, startingEnemyHealth: loaded.enemy.health.startingHealth, maximumEnemyHealth: loaded.enemy.health.maxHealth }; }
