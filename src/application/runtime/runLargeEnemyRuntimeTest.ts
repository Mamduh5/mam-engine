import { LARGE_ENEMY_FIXED_DELTA_SECONDS } from "../../domain/largeEnemy/largeEnemySimulation";
import type { LargeEnemyScenario } from "../../domain/largeEnemy/largeEnemyTypes";
import { removeRuntimeSession } from "../../infrastructure/runtime/runtimeSessionStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedLargeEnemyBundle, loadValidLargeEnemyBundle } from "../largeEnemy/largeEnemyOperationSupport";
import { runtimeFailure } from "./checkRuntime";
import { compareLargeEnemyRuntime } from "./compareLargeEnemyRuntime";
import { runLargeEnemyFixture, type RunLargeEnemyFixtureOptions } from "./runLargeEnemyFixture";

export async function runLargeEnemyRuntimeTest(workspaceRoot: string, enemyFile: string, scenario: LargeEnemyScenario, fixedDelta = LARGE_ENEMY_FIXED_DELTA_SECONDS, options: RunLargeEnemyFixtureOptions = {}): Promise<OperationResult> {
  const command = "large-enemy.runtime-test"; const input = { file: enemyFile, scenario, fixedDelta };
  if (!Number.isFinite(fixedDelta) || fixedDelta <= 0 || fixedDelta > 1) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.CliArgumentInvalid, path: "fixedDelta", message: "fixed delta must be finite, greater than zero, and at most 1", actual: fixedDelta, expected: "(0, 1]" }] });
  const enemy = await loadValidLargeEnemyBundle(workspaceRoot, enemyFile); if (!isLoadedLargeEnemyBundle(enemy)) return operationResult({ command, status: "failed", input, errors: enemy.errors });
  if (scenario === "primary-part-disabled" && enemy.profile.bodyParts.filter((part) => part.targetable).length < 2) return operationResult({ command, status: "failed", input: { ...input, file: enemy.relativePath }, errors: [{ code: ErrorCodes.LargeEnemyScenarioInvalid, path: "scenario", message: "primary-part-disabled requires another authored targetable body part", actual: scenario, expected: "at least two targetable body parts" }] });
  try { const run = await runLargeEnemyFixture(workspaceRoot, enemy.profile, enemy.resolvedDefinitionPaths, enemy.health, enemy.reaction, enemy.hurtboxes, scenario, fixedDelta, { ...options, keepSession: true }); const comparison = compareLargeEnemyRuntime(run.simulation, run.response.metrics); if (comparison.passed && options.keepSession !== true) { await removeRuntimeSession(run.runtimeSession); run.session = { retained: false, path: null }; } const data = { runtime: { fixtureId: run.request.fixtureId, scenarioId: scenario, godotVersion: run.executable.version.reportedVersion, metrics: run.response.metrics, evidence: run.response.evidence, process: run.process }, simulation: run.simulation, comparison, session: run.session, internalArtifacts: run.internalArtifacts }; if (!comparison.passed) return operationResult({ command, status: "failed", input, data, errors: [{ code: ErrorCodes.RuntimeMetricToleranceExceeded, message: "Large-enemy runtime metrics differ from the TypeScript simulation", details: { failedMetrics: comparison.metrics.filter((metric) => !metric.passed) } }] }); return operationResult({ command, status: "passed", input: { ...input, file: enemy.relativePath }, data }); } catch (caught) { return runtimeFailure(command, caught, input); }
}
