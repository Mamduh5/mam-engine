import { roundMetric } from "../movement/movementMetrics";
import type { DefensiveActionProfile, DefensiveActionSimulation, DefensiveActionState } from "./defensiveActionTypes";

export const DEFENSIVE_ACTION_FIXED_DELTA_SECONDS = 1 / 60;
const EPSILON = 1e-12;

export function simulateDefensiveAction(profile: DefensiveActionProfile, fixedDeltaSeconds = DEFENSIVE_ACTION_FIXED_DELTA_SECONDS): DefensiveActionSimulation {
  if (!Number.isFinite(fixedDeltaSeconds) || fixedDeltaSeconds <= 0) throw new Error("fixedDeltaSeconds must be finite and greater than 0");
  const cooldownCompletionSeconds = profile.durationSeconds + profile.cooldownSeconds;
  const totalSteps = completionStep(cooldownCompletionSeconds, fixedDeltaSeconds);
  let distanceTravelled = 0; let state: DefensiveActionState = "active";
  for (let step = 1; step <= totalSteps; step += 1) {
    const stepStart = (step - 1) * fixedDeltaSeconds; const stepEnd = step * fixedDeltaSeconds;
    const movementSeconds = Math.max(0, Math.min(stepEnd, profile.durationSeconds) - Math.min(Math.max(stepStart, 0), profile.durationSeconds));
    distanceTravelled += profile.movementDistance * movementSeconds / profile.durationSeconds;
    state = stepEnd + EPSILON < profile.durationSeconds ? "active" : stepEnd + EPSILON < cooldownCompletionSeconds ? "cooldown" : "ready";
  }
  return {
    fixedDeltaSeconds: roundMetric(fixedDeltaSeconds), totalSteps, distanceTravelled: roundMetric(distanceTravelled), staminaConsumed: roundMetric(profile.staminaCost),
    invulnerabilityStartStep: Math.floor(profile.invulnerabilityStartSeconds / fixedDeltaSeconds + EPSILON) + 1,
    invulnerabilityEndStep: completionStep(profile.invulnerabilityEndSeconds, fixedDeltaSeconds),
    cooldownCompletionStep: totalSteps, finalActionState: state
  };
}

function completionStep(seconds: number, delta: number): number { return Math.max(1, Math.ceil(seconds / delta - EPSILON)); }
