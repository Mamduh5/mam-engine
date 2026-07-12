import type { OffensiveActionProfile } from "../offensiveAction/offensiveActionTypes";
import { roundMetric } from "../movement/movementMetrics";
import type { HealthProfile, HitSimulation } from "./healthTypes";

export function simulateHit(health: HealthProfile, action: OffensiveActionProfile): HitSimulation {
  return simulateDamage(health, action.damage);
}

export function simulateDamage(health: HealthProfile, damage: number): HitSimulation {
  const startingHealth = roundMetric(health.startingHealth); const incomingDamage = roundMetric(damage); const appliedDamage = roundMetric(Math.min(startingHealth, incomingDamage)); const remainingHealth = roundMetric(Math.max(0, startingHealth - appliedDamage)); const overkillDamage = roundMetric(incomingDamage - appliedDamage); const defeated = remainingHealth === 0;
  return { startingHealth, incomingDamage, appliedDamage, remainingHealth, overkillDamage, defeated, finalTargetState: defeated ? "defeated" : "alive" };
}
