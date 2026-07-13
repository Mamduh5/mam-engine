import { roundMetric } from "../movement/movementMetrics";
import type { LargeEnemyBehaviorSimulation, LargeEnemyProfile, LargeEnemyScenario, ResolvedLargeEnemyDefinitionPaths } from "./largeEnemyTypes";

export const LARGE_ENEMY_FIXED_DELTA_SECONDS = 1 / 60;
const EPSILON = 1e-12;

export function simulateLargeEnemyBehavior(profile: LargeEnemyProfile, resolvedDefinitionPaths: ResolvedLargeEnemyDefinitionPaths, scenario: LargeEnemyScenario, fixedDeltaSeconds = LARGE_ENEMY_FIXED_DELTA_SECONDS): LargeEnemyBehaviorSimulation {
  if (!Number.isFinite(fixedDeltaSeconds) || fixedDeltaSeconds <= 0) throw new Error("fixedDeltaSeconds must be finite and greater than 0");
  const authoredTargetable = profile.bodyParts.filter((part) => part.targetable);
  const targetable = scenario === "primary-part-disabled" ? authoredTargetable.slice(1) : authoredTargetable;
  const selected = targetable[0]; if (!selected) throw new Error("Scenario leaves no targetable body part");
  const idleEnd = profile.idleDurationSeconds;
  const telegraphEnd = idleEnd + profile.telegraphDurationSeconds;
  const attackEnd = telegraphEnd + profile.attackDurationSeconds;
  const cycleEnd = attackEnd + profile.recoveryDurationSeconds;
  const boundaryStep = (seconds: number): number => Math.max(1, Math.ceil(seconds / fixedDeltaSeconds - EPSILON));
  return {
    enemyId: profile.id,
    resolvedDefinitionPaths,
    totalCycleDurationSeconds: roundMetric(cycleEnd),
    totalSteps: boundaryStep(cycleEnd),
    idleStartStep: 1,
    idleEndStep: boundaryStep(idleEnd),
    telegraphName: profile.telegraphName,
    telegraphStartStep: boundaryStep(idleEnd),
    telegraphEndStep: boundaryStep(telegraphEnd),
    attackStartStep: boundaryStep(telegraphEnd),
    attackEndStep: boundaryStep(attackEnd),
    recoveryStartStep: boundaryStep(attackEnd),
    recoveryCompletionStep: boundaryStep(cycleEnd),
    bodyPartIds: profile.bodyParts.map((part) => part.id),
    targetableBodyPartIds: targetable.map((part) => part.id),
    selectedBodyPartId: selected.id,
    finalBehaviorState: "complete"
  };
}
