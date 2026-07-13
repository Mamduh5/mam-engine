import type { EncounterScenario } from "../../domain/encounter/encounterTypes";
import { removeRuntimeSession } from "../../infrastructure/runtime/runtimeSessionStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedEncounterBundle, loadValidEncounterBundle } from "../encounter/encounterOperationSupport";
import { runtimeFailure } from "./checkRuntime";
import { compareEncounterRuntime } from "./compareEncounterRuntime";
import { runEncounterFixture, type RunEncounterFixtureOptions } from "./runEncounterFixture";

export async function runEncounterRuntimeTest(workspaceRoot: string, encounterFile: string, scenario: EncounterScenario, fixedDelta = 1 / 60, options: RunEncounterFixtureOptions = {}): Promise<OperationResult> {
  const command = "encounter.runtime-test"; const input = { file: encounterFile, scenario, fixedDelta };
  if (!Number.isFinite(fixedDelta) || fixedDelta <= 0 || fixedDelta > 1) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.CliArgumentInvalid, path: "fixedDelta", message: "fixed delta must be finite, greater than zero, and at most 1", actual: fixedDelta, expected: "(0, 1]" }] });
  const loaded = await loadValidEncounterBundle(workspaceRoot, encounterFile); if (!isLoadedEncounterBundle(loaded)) return operationResult({ command, status: "failed", input, errors: loaded.errors });
  try { const run = await runEncounterFixture(workspaceRoot, loaded, scenario, fixedDelta, { ...options, keepSession: true }); const comparison = compareEncounterRuntime(run.simulation, run.response.metrics); if (comparison.passed && options.keepSession !== true) { await removeRuntimeSession(run.runtimeSession); run.session = { retained: false, path: null }; } const data = { runtime: { fixtureId: run.request.fixtureId, scenarioId: scenario, godotVersion: run.executable.version.reportedVersion, metrics: run.response.metrics, evidence: run.response.evidence, process: run.process }, simulation: run.simulation, comparison, session: run.session, internalArtifacts: run.internalArtifacts }; if (!comparison.passed) return operationResult({ command, status: "failed", input, data, errors: [{ code: ErrorCodes.RuntimeMetricToleranceExceeded, message: "Encounter runtime metrics differ from the TypeScript simulation", details: { failedMetrics: comparison.metrics.filter((metric) => !metric.passed) } }] }); return operationResult({ command, status: "passed", input: { ...input, file: loaded.relativePath }, data }); } catch (caught) { return runtimeFailure(command, caught, input); }
}
