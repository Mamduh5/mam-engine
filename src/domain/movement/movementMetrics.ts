import type { MovementDerivedMetrics, MovementProfile } from "./movementTypes";

export function roundMetric(value: number): number {
  return Number(value.toFixed(9));
}

export function deriveMovementMetrics(profile: MovementProfile): MovementDerivedMetrics {
  const { ground, stamina, dodge } = profile;
  return {
    speedOrdering: {
      valid: ground.walkSpeed <= ground.runSpeed && ground.runSpeed <= ground.sprintSpeed,
      walkSpeed: ground.walkSpeed,
      runSpeed: ground.runSpeed,
      sprintSpeed: ground.sprintSpeed
    },
    estimatedTimeToRunSpeedSeconds: roundMetric(ground.runSpeed / ground.acceleration),
    estimatedStoppingTimeFromRunSpeedSeconds: roundMetric(ground.runSpeed / ground.deceleration),
    sprintDurationFromFullStaminaSeconds: stamina.sprintCostPerSecond === 0
      ? null
      : roundMetric(stamina.maximum / stamina.sprintCostPerSecond),
    dodgeInvulnerabilityDurationSeconds: roundMetric(
      dodge.invulnerabilityEndSeconds - dodge.invulnerabilityStartSeconds
    ),
    dodgeAverageTravelSpeed: roundMetric(dodge.distance / dodge.durationSeconds)
  };
}
