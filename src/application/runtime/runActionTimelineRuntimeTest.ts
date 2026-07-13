import { removeRuntimeSession } from "../../infrastructure/runtime/runtimeSessionStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedActionTimeline, loadValidActionTimeline } from "../actionTimeline/actionTimelineOperationSupport";
import { runtimeFailure } from "./checkRuntime";
import { compareActionTimelineRuntime } from "./compareActionTimelineRuntime";
import { runActionTimelineFixture, type RunActionTimelineFixtureOptions } from "./runActionTimelineFixture";

export async function runActionTimelineRuntimeTest(workspaceRoot: string, inputFile: string, fixedDelta?: number, options: RunActionTimelineFixtureOptions = {}): Promise<OperationResult> {
  const command = "action-timeline.runtime-test"; const input = { file: inputFile, ...(fixedDelta === undefined ? {} : { fixedDelta }) }; const loaded = await loadValidActionTimeline(workspaceRoot, inputFile); if (!isLoadedActionTimeline(loaded)) return operationResult({ command, status: "failed", input, errors: loaded.errors });
  try { const run = await runActionTimelineFixture(workspaceRoot, loaded.profile, fixedDelta, { ...options, keepSession: true }); const comparison = compareActionTimelineRuntime(run.simulation, run.response.metrics); if (comparison.passed && options.keepSession !== true) { await removeRuntimeSession(run.runtimeSession); run.session = { retained: false, path: null }; } const data = { runtime: { fixtureId: run.request.fixtureId, scenarioId: "default", godotVersion: run.executable.version.reportedVersion, metrics: run.response.metrics, evidence: run.response.evidence, process: run.process }, simulation: run.simulation, comparison, session: run.session, internalArtifacts: run.internalArtifacts }; if (!comparison.passed) return operationResult({ command, status: "failed", input: { ...input, file: loaded.relativePath }, data, errors: [{ code: ErrorCodes.RuntimeMetricToleranceExceeded, message: "Action timeline runtime metrics differ from the TypeScript simulation", details: { failedMetrics: comparison.metrics.filter((metric) => !metric.passed) } }] }); return operationResult({ command, status: "passed", input: { ...input, file: loaded.relativePath }, data }); } catch (caught) { return runtimeFailure(command, caught, input); }
}
