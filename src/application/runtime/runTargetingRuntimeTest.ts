import type { TargetingRuntimeScenario } from "../../domain/runtime/targetingRuntimePlan";
import { TARGETING_RUNTIME_SCENARIOS } from "../../domain/runtime/targetingRuntimePlan";
import { removeRuntimeSession } from "../../infrastructure/runtime/runtimeSessionStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedCamera, loadValidCamera } from "../camera/cameraOperationSupport";
import { isLoadedTargeting, loadValidTargeting } from "../targeting/targetingOperationSupport";
import { runtimeFailure } from "./checkRuntime";
import { compareTargetingRuntime } from "./compareTargetingRuntime";
import { runTargetingFixture, type RunTargetingFixtureOptions } from "./runTargetingFixture";

export async function runTargetingRuntimeTest(workspaceRoot: string, targetingFile: string, cameraFile: string, scenario: TargetingRuntimeScenario, seconds?: number, fixedDelta?: number, options: RunTargetingFixtureOptions = {}): Promise<OperationResult> {
  const command = "targeting.runtime-test"; const input = { file: targetingFile, camera: cameraFile, scenario, ...(seconds === undefined ? {} : { seconds }), ...(fixedDelta === undefined ? {} : { fixedDelta }) };
  if (!TARGETING_RUNTIME_SCENARIOS.has(scenario)) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.TargetingRuntimeScenarioUnsupported, message: "Unsupported targeting runtime scenario" }] });
  const targeting = await loadValidTargeting(workspaceRoot, targetingFile); if (!isLoadedTargeting(targeting)) return operationResult({ command, status: "failed", input, errors: targeting.errors });
  const camera = await loadValidCamera(workspaceRoot, cameraFile); if (!isLoadedCamera(camera)) return operationResult({ command, status: "failed", input, errors: camera.errors });
  const normalizedInput = { ...input, file: targeting.relativePath, camera: camera.relativePath };
  try {
    const run = await runTargetingFixture(workspaceRoot, targeting.profile, camera.profile, scenario, seconds, { ...options, fixedDeltaSeconds: fixedDelta, keepSession: true });
    const comparison = compareTargetingRuntime(run.simulation, run.response.metrics, fixedDelta ?? 1 / 60);
    if (comparison.passed && options.keepSession !== true) { await removeRuntimeSession(run.runtimeSession); run.session = { retained: false, path: null }; }
    const data = { runtime: { fixtureId: run.request.fixtureId, scenarioId: scenario, godotVersion: run.executable.version.reportedVersion, metrics: run.response.metrics, evidence: run.response.evidence, process: run.process }, simulation: run.simulation, comparison, session: run.session, internalArtifacts: run.internalArtifacts };
    if (!comparison.passed) return operationResult({ command, status: "failed", input: normalizedInput, data, errors: [{ code: ErrorCodes.RuntimeMetricToleranceExceeded, message: "One or more targeting runtime metrics exceeded project tolerances", details: { failedMetrics: comparison.metrics.filter((metric) => !metric.passed) } }] });
    return operationResult({ command, status: "passed", input: normalizedInput, data });
  } catch (caught) { return runtimeFailure(command, caught, normalizedInput); }
}
