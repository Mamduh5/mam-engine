import type { TargetedCombatExchangeScenario } from "../../domain/combat/targetedCombatExchangeSimulation";
import { removeRuntimeSession } from "../../infrastructure/runtime/runtimeSessionStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedHealth, loadValidHealth } from "../health/healthOperationSupport";
import { isLoadedOffensiveAction, loadValidOffensiveAction } from "../offensiveAction/offensiveActionOperationSupport";
import { isLoadedStamina, loadValidStamina } from "../stamina/staminaOperationSupport";
import { isLoadedTargeting, loadValidTargeting } from "../targeting/targetingOperationSupport";
import { runtimeFailure } from "./checkRuntime";
import { compareTargetedCombatRuntime } from "./compareTargetedCombatRuntime";
import { runTargetedCombatFixture, type RunTargetedCombatFixtureOptions } from "./runTargetedCombatFixture";

export async function runTargetedCombatRuntimeTest(workspaceRoot: string, targetingFile: string, staminaFile: string, healthFile: string, offensiveActionFile: string, scenario: TargetedCombatExchangeScenario, options: RunTargetedCombatFixtureOptions = {}): Promise<OperationResult> {
  const command = "combat.targeted-runtime-test"; const input = { targetingFile, staminaFile, healthFile, offensiveActionFile, scenario };
  const targeting = await loadValidTargeting(workspaceRoot, targetingFile); if (!isLoadedTargeting(targeting)) return operationResult({ command, status: "failed", input, errors: targeting.errors });
  const stamina = await loadValidStamina(workspaceRoot, staminaFile); if (!isLoadedStamina(stamina)) return operationResult({ command, status: "failed", input: { ...input, targetingFile: targeting.relativePath }, errors: stamina.errors });
  const health = await loadValidHealth(workspaceRoot, healthFile); if (!isLoadedHealth(health)) return operationResult({ command, status: "failed", input: { ...input, targetingFile: targeting.relativePath, staminaFile: stamina.relativePath }, errors: health.errors });
  const action = await loadValidOffensiveAction(workspaceRoot, offensiveActionFile); if (!isLoadedOffensiveAction(action)) return operationResult({ command, status: "failed", input: { ...input, targetingFile: targeting.relativePath, staminaFile: stamina.relativePath, healthFile: health.relativePath }, errors: action.errors });
  const normalizedInput = { ...input, targetingFile: targeting.relativePath, staminaFile: stamina.relativePath, healthFile: health.relativePath, offensiveActionFile: action.relativePath };
  try { const run = await runTargetedCombatFixture(workspaceRoot, targeting.profile, stamina.profile, health.profile, action.profile, scenario, { ...options, keepSession: true }); const comparison = compareTargetedCombatRuntime(run.simulation, run.response.metrics); if (comparison.passed && options.keepSession !== true) { await removeRuntimeSession(run.runtimeSession); run.session = { retained: false, path: null }; } const data = { runtime: { fixtureId: run.request.fixtureId, scenarioId: scenario, godotVersion: run.executable.version.reportedVersion, metrics: run.response.metrics, evidence: run.response.evidence, process: run.process }, simulation: run.simulation, comparison, session: run.session, internalArtifacts: run.internalArtifacts }; if (!comparison.passed) return operationResult({ command, status: "failed", input: normalizedInput, data, errors: [{ code: ErrorCodes.RuntimeMetricToleranceExceeded, message: "Targeted combat runtime metrics differ from the TypeScript simulation", details: { failedMetrics: comparison.metrics.filter((metric) => !metric.passed) } }] }); return operationResult({ command, status: "passed", input: normalizedInput, data }); } catch (caught) { return runtimeFailure(command, caught, normalizedInput); }
}
