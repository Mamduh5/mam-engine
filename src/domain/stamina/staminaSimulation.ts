import { roundMetric } from "../movement/movementMetrics";
import type { StaminaActionProfile, StaminaActionSimulation, StaminaProfile } from "./staminaTypes";

export function simulateStaminaAction(stamina: StaminaProfile, action: StaminaActionProfile): StaminaActionSimulation {
  const startingStamina = roundMetric(stamina.startingStamina);
  const requestedStaminaCost = roundMetric(action.staminaCost);
  const sufficientStamina = startingStamina >= requestedStaminaCost;
  const consumedStamina = sufficientStamina ? requestedStaminaCost : 0;
  const remainingStamina = roundMetric(Math.max(0, startingStamina - consumedStamina));
  return {
    actionKind: action.kind,
    startingStamina,
    requestedStaminaCost,
    consumedStamina,
    remainingStamina,
    sufficientStamina,
    actionAccepted: sufficientStamina,
    finalStaminaState: sufficientStamina ? (remainingStamina === 0 ? "depleted" : "available") : "insufficient"
  };
}
