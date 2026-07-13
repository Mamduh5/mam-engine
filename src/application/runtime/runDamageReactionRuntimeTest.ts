import { DAMAGE_REACTION_FIXED_DELTA_SECONDS } from "../../domain/damageReaction/damageReactionSimulation";
import type { DamageReactionRuntimeScenario } from "../../domain/runtime/runtimeProtocol";
import { removeRuntimeSession } from "../../infrastructure/runtime/runtimeSessionStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedDamageReaction, loadValidDamageReaction } from "../damageReaction/damageReactionOperationSupport";
import { isLoadedHealth, loadValidHealth } from "../health/healthOperationSupport";
import { isLoadedOffensiveAction, loadValidOffensiveAction } from "../offensiveAction/offensiveActionOperationSupport";
import { runtimeFailure } from "./checkRuntime";
import { compareDamageReactionRuntime } from "./compareDamageReactionRuntime";
import { runDamageReactionFixture, type RunDamageReactionFixtureOptions } from "./runDamageReactionFixture";

export async function runDamageReactionRuntimeTest(workspaceRoot: string, reactionFile: string, healthFile: string, offensiveActionFile: string, scenario: DamageReactionRuntimeScenario, fixedDelta = DAMAGE_REACTION_FIXED_DELTA_SECONDS, options: RunDamageReactionFixtureOptions = {}): Promise<OperationResult> {
  const command = "damage-reaction.runtime-test"; const input = { reactionFile, healthFile, offensiveActionFile, scenario, fixedDelta };
  if (!Number.isFinite(fixedDelta) || fixedDelta <= 0 || fixedDelta > 1) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.CliArgumentInvalid, path: "fixedDelta", message: "fixed delta must be finite, greater than zero, and at most 1", actual: fixedDelta, expected: "(0, 1]" }] });
  const reaction = await loadValidDamageReaction(workspaceRoot, reactionFile); if (!isLoadedDamageReaction(reaction)) return operationResult({ command, status: "failed", input, errors: reaction.errors });
  const health = await loadValidHealth(workspaceRoot, healthFile); if (!isLoadedHealth(health)) return operationResult({ command, status: "failed", input: { ...input, reactionFile: reaction.relativePath }, errors: health.errors });
  const action = await loadValidOffensiveAction(workspaceRoot, offensiveActionFile); if (!isLoadedOffensiveAction(action)) return operationResult({ command, status: "failed", input: { ...input, reactionFile: reaction.relativePath, healthFile: health.relativePath }, errors: action.errors });
  try { const run = await runDamageReactionFixture(workspaceRoot, reaction.profile, health.profile, action.profile, scenario, fixedDelta, { ...options, keepSession: true }); const comparison = compareDamageReactionRuntime(run.simulation, run.response.metrics); if (comparison.passed && options.keepSession !== true) { await removeRuntimeSession(run.runtimeSession); run.session = { retained: false, path: null }; } const data = { runtime: { fixtureId: run.request.fixtureId, scenarioId: scenario, godotVersion: run.executable.version.reportedVersion, metrics: run.response.metrics, evidence: run.response.evidence, process: run.process }, simulation: run.simulation, comparison, session: run.session, internalArtifacts: run.internalArtifacts }; if (!comparison.passed) return operationResult({ command, status: "failed", input: { ...input, reactionFile: reaction.relativePath, healthFile: health.relativePath, offensiveActionFile: action.relativePath }, data, errors: [{ code: ErrorCodes.RuntimeMetricToleranceExceeded, message: "Damage reaction runtime metrics differ from the TypeScript simulation", details: { failedMetrics: comparison.metrics.filter((metric) => !metric.passed) } }] }); return operationResult({ command, status: "passed", input: { ...input, reactionFile: reaction.relativePath, healthFile: health.relativePath, offensiveActionFile: action.relativePath }, data }); } catch (caught) { return runtimeFailure(command, caught, input); }
}
