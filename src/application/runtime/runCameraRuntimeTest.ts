import { CAMERA_RUNTIME_SCENARIOS } from "../../domain/runtime/runtimeProtocol";
import type { CameraScenario } from "../../domain/camera/cameraTypes";
import { removeRuntimeSession } from "../../infrastructure/runtime/runtimeSessionStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedCamera, loadValidCamera } from "../camera/cameraOperationSupport";
import { runtimeFailure } from "./checkRuntime";
import { compareCameraRuntime } from "./compareCameraRuntime";
import { runCameraFixture, type RunCameraFixtureOptions } from "./runCameraFixture";

export async function runCameraRuntimeTest(workspaceRoot: string, inputFile: string, scenario: CameraScenario, seconds: number | undefined, fixedDelta: number | undefined, options: RunCameraFixtureOptions = {}): Promise<OperationResult> {
  const command = "camera.runtime-test"; const input = { file: inputFile, scenario, ...(seconds === undefined ? {} : { seconds }), ...(fixedDelta === undefined ? {} : { fixedDelta }) };
  if (!CAMERA_RUNTIME_SCENARIOS.has(scenario)) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.CameraRuntimeScenarioUnsupported, message: "Unsupported camera runtime scenario" }] });
  const loaded = await loadValidCamera(workspaceRoot, inputFile);
  if (!isLoadedCamera(loaded)) return operationResult({ command, status: "failed", input, errors: loaded.errors });
  try {
    const run = await runCameraFixture(workspaceRoot, loaded.profile, scenario, seconds, { ...options, fixedDeltaSeconds: fixedDelta, keepSession: true });
    const comparison = compareCameraRuntime(run.simulation, run.response.metrics, loaded.profile, fixedDelta);
    if (comparison.passed && options.keepSession !== true) { await removeRuntimeSession(run.runtimeSession); run.session = { retained: false, path: null }; }
    const data = { runtime: { fixtureId: run.request.fixtureId, scenarioId: scenario, godotVersion: run.executable.version.reportedVersion, metrics: run.response.metrics, evidence: run.response.evidence, process: run.process }, simulation: run.simulation, comparison, session: run.session, internalArtifacts: run.internalArtifacts };
    if (!comparison.passed) return operationResult({ command, status: "failed", input: { ...input, file: loaded.relativePath }, data, errors: [{ code: ErrorCodes.RuntimeMetricToleranceExceeded, message: "One or more camera runtime metrics exceeded project tolerances", details: { failedMetrics: comparison.metrics.filter((metric) => !metric.passed) } }] });
    return operationResult({ command, status: "passed", input: { ...input, file: loaded.relativePath }, data });
  } catch (caught) { return runtimeFailure(command, caught, input); }
}
