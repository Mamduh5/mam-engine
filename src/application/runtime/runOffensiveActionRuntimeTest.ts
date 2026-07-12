import { removeRuntimeSession } from "../../infrastructure/runtime/runtimeSessionStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedOffensiveAction, loadValidOffensiveAction } from "../offensiveAction/offensiveActionOperationSupport";
import { runtimeFailure } from "./checkRuntime";
import { compareOffensiveActionRuntime } from "./compareOffensiveActionRuntime";
import { runOffensiveActionFixture, type RunOffensiveActionFixtureOptions } from "./runOffensiveActionFixture";

export async function runOffensiveActionRuntimeTest(workspaceRoot: string, inputFile: string, fixedDelta?: number, options: RunOffensiveActionFixtureOptions = {}): Promise<OperationResult> {
  const command = "offensive-action.runtime-test"; const input = { file: inputFile, ...(fixedDelta === undefined ? {} : { fixedDelta }) }; const loaded = await loadValidOffensiveAction(workspaceRoot, inputFile); if (!isLoadedOffensiveAction(loaded)) return operationResult({ command, status: "failed", input, errors: loaded.errors });
  try { const run = await runOffensiveActionFixture(workspaceRoot, loaded.profile, fixedDelta, { ...options, keepSession: true }); const comparison = compareOffensiveActionRuntime(run.simulation, run.response.metrics); if (comparison.passed && options.keepSession !== true) { await removeRuntimeSession(run.runtimeSession); run.session = { retained: false, path: null }; } const data = { runtime: { fixtureId: run.request.fixtureId, scenarioId: "default", godotVersion: run.executable.version.reportedVersion, metrics: run.response.metrics, evidence: run.response.evidence, process: run.process }, simulation: run.simulation, comparison, session: run.session, internalArtifacts: run.internalArtifacts }; if (!comparison.passed) return operationResult({ command, status: "failed", input: { ...input, file: loaded.relativePath }, data, errors: [{ code: ErrorCodes.RuntimeMetricToleranceExceeded, message: "Offensive action runtime metrics differ from the TypeScript simulation", details: { failedMetrics: comparison.metrics.filter((metric) => !metric.passed) } }] }); return operationResult({ command, status: "passed", input: { ...input, file: loaded.relativePath }, data }); } catch (caught) { return runtimeFailure(command, caught, input); }
}
