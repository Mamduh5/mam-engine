import { roundMetric } from "../movement/movementMetrics";
import type { OffensiveActionProfile, OffensiveActionSimulation, OffensiveActionState } from "./offensiveActionTypes";

export const OFFENSIVE_ACTION_FIXED_DELTA_SECONDS = 1 / 60;
const EPSILON = 1e-12;

export function simulateOffensiveAction(profile: OffensiveActionProfile, fixedDeltaSeconds = OFFENSIVE_ACTION_FIXED_DELTA_SECONDS): OffensiveActionSimulation {
  if (!Number.isFinite(fixedDeltaSeconds) || fixedDeltaSeconds <= 0) throw new Error("fixedDeltaSeconds must be finite and greater than 0");
  const lifecycleSeconds = profile.durationSeconds + profile.cooldownSeconds; const totalSteps = completionStep(lifecycleSeconds, fixedDeltaSeconds);
  let distanceTravelled = 0; let state: OffensiveActionState = "active";
  for (let step = 1; step <= totalSteps; step += 1) { const stepStart = (step - 1) * fixedDeltaSeconds; const stepEnd = step * fixedDeltaSeconds; const movementSeconds = Math.max(0, Math.min(stepEnd, profile.durationSeconds) - Math.min(Math.max(stepStart, 0), profile.durationSeconds)); distanceTravelled += profile.movementDistance * movementSeconds / profile.durationSeconds; state = stepEnd + EPSILON < profile.durationSeconds ? "active" : stepEnd + EPSILON < lifecycleSeconds ? "cooldown" : "ready"; }
  return { fixedDeltaSeconds: roundMetric(fixedDeltaSeconds), totalSteps, distanceTravelled: roundMetric(distanceTravelled), staminaConsumed: roundMetric(profile.staminaCost), damageValue: roundMetric(profile.damage), activeStartStep: Math.floor(profile.activeStartSeconds / fixedDeltaSeconds + EPSILON) + 1, activeEndStep: completionStep(profile.activeEndSeconds, fixedDeltaSeconds), cooldownCompletionStep: totalSteps, finalActionState: state };
}

function completionStep(seconds: number, delta: number): number { return Math.max(1, Math.ceil(seconds / delta - EPSILON)); }
