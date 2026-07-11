import { compareMovementRuntime } from "../../domain/runtime/runtimeComparison";
import type { MovementScenario } from "../../domain/movement/movementTypes";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedMovement, loadErrors, loadValidMovement } from "../movement/movementOperationSupport";
import { runtimeFailure } from "./checkRuntime";
import { runMovementFixture, type RunMovementFixtureOptions } from "./runMovementFixture";
import { removeRuntimeSession } from "../../infrastructure/runtime/runtimeSessionStore";

export async function runMovementRuntimeTest(workspaceRoot: string, inputFile: string, scenario: MovementScenario, seconds: number | undefined, cameraYawDegrees: number, options: RunMovementFixtureOptions = {}): Promise<OperationResult> {
  const command = "movement.runtime-test";
  const input = { file: inputFile, scenario, ...(seconds === undefined ? {} : { seconds }), cameraYawDegrees };
  const loaded = await loadValidMovement(workspaceRoot, inputFile);
  if (!isLoadedMovement(loaded)) return operationResult({ command, status: "failed", input, errors: loadErrors(loaded) });
  try {
    const run = await runMovementFixture(workspaceRoot, loaded.profile, scenario, seconds, cameraYawDegrees, { ...options, keepSession: true });
    const comparison = compareMovementRuntime(run.simulation, run.response.metrics);
    if (comparison.passed && options.keepSession !== true) {
      await removeRuntimeSession(run.runtimeSession);
      run.session = { retained: false, path: null };
    }
    const data = {
      runtime: { fixtureId: run.request.fixtureId, scenarioId: scenario, godotVersion: run.executable.version.reportedVersion, metrics: run.response.metrics, evidence: run.response.evidence, process: run.process },
      simulation: run.simulation,
      comparison,
      session: run.session,
      internalArtifacts: run.internalArtifacts
    };
    if (!comparison.passed) return operationResult({ command, status: "failed", input: { ...input, file: loaded.relativePath }, data, errors: [{ code: ErrorCodes.RuntimeMetricToleranceExceeded, message: "One or more runtime metrics exceeded project tolerances", details: { failedMetrics: comparison.metrics.filter((metric) => !metric.passed) } }] });
    return operationResult({ command, status: "passed", input: { ...input, file: loaded.relativePath }, data });
  } catch (caught) { return runtimeFailure(command, caught, input); }
}
