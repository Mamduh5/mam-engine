import type { EncounterScenario } from "../../domain/encounter/encounterTypes";
import { validateEncounterCheckpoint } from "../../domain/runtime/encounterCheckpoint";
import { removeRuntimeSession } from "../../infrastructure/runtime/runtimeSessionStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedEncounterBundle, loadValidEncounterBundle, type LoadedEncounterBundle } from "../encounter/encounterOperationSupport";
import { runtimeFailure } from "./checkRuntime";
import { compareEncounterRuntime } from "./compareEncounterRuntime";
import { runEncounterFixture, type RunEncounterFixtureOptions } from "./runEncounterFixture";

export async function runEncounterInteractiveTest(workspaceRoot: string, encounterFile: string, scenario: EncounterScenario, fixedDelta = 1 / 60, options: RunEncounterFixtureOptions = {}): Promise<OperationResult> {
  const command = "encounter.interactive-test"; const input = { file: encounterFile, scenario, fixedDelta };
  if (!Number.isFinite(fixedDelta) || fixedDelta <= 0 || fixedDelta > 1) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.CliArgumentInvalid, path: "fixedDelta", message: "fixed delta must be finite, greater than zero, and at most 1", actual: fixedDelta, expected: "(0, 1]" }] });
  const loaded = await loadValidEncounterBundle(workspaceRoot, encounterFile); if (!isLoadedEncounterBundle(loaded)) return operationResult({ command, status: "failed", input, errors: loaded.errors });
  try {
    const run = await runEncounterFixture(workspaceRoot, loaded, scenario, fixedDelta, { ...options, interactive: true, mode: "interactive", autoDrive: true, keepSession: true }); const comparison = compareEncounterRuntime(run.simulation, run.response.metrics);
    const checkpointValidation = validateEncounterCheckpoint(run.checkpoint, expectations(loaded, run.simulation.hunterStartingStamina, scenario));
    const metrics = run.response.metrics; const interactiveConfirmed = metrics.interactiveModeConfirmed === true; const inputEventsProcessed = Number(metrics.inputEventsProcessed ?? 0); const restartAvailable = metrics.restartAvailable === true;
    if (comparison.passed && checkpointValidation.valid && interactiveConfirmed && inputEventsProcessed === run.simulation.roundsStarted && restartAvailable && options.keepSession !== true) { await removeRuntimeSession(run.runtimeSession); run.session = { retained: false, path: null }; }
    const data = { interactiveModeConfirmed: interactiveConfirmed, inputEventsProcessed, restartAvailable, checkpointCreated: checkpointValidation.valid, checkpointPath: run.session.retained ? `${run.session.path}/encounter-checkpoint.json` : null, finalEncounterReport: metrics, comparison, runtime: { fixtureId: run.request.fixtureId, godotVersion: run.executable.version.reportedVersion, evidence: run.response.evidence, process: run.process }, session: run.session };
    if (!comparison.passed || !checkpointValidation.valid || !interactiveConfirmed || inputEventsProcessed !== run.simulation.roundsStarted || !restartAvailable) return operationResult({ command, status: "failed", input, data, errors: [{ code: checkpointValidation.valid ? ErrorCodes.RuntimeMetricToleranceExceeded : ErrorCodes.EncounterCheckpointInvalid, message: checkpointValidation.valid ? "Interactive encounter evidence differs from the TypeScript simulation" : "Interactive encounter checkpoint validation failed", details: { checkpointErrors: checkpointValidation.errors, failedMetrics: comparison.metrics.filter((metric) => !metric.passed) } }] });
    return operationResult({ command, status: "passed", input: { ...input, file: loaded.relativePath }, data });
  } catch (caught) { return runtimeFailure(command, caught, input); }
}

function expectations(loaded: LoadedEncounterBundle, startingStamina: number, scenario: EncounterScenario) { return { encounterId: loaded.profile.id, scenarioId: scenario, selectedBodyPartId: loaded.selectedBodyPartId, maximumRounds: loaded.profile.maxRounds, startingStamina, maximumStamina: loaded.hunter.stamina.maxStamina, startingEnemyHealth: loaded.enemy.health.startingHealth, maximumEnemyHealth: loaded.enemy.health.maxHealth }; }
