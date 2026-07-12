import { simulateDamage } from "../health/hitSimulation";
import type { HealthProfile, TargetState } from "../health/healthTypes";
import { simulateOffensiveAction } from "../offensiveAction/offensiveActionSimulation";
import type { OffensiveActionProfile, OffensiveActionState } from "../offensiveAction/offensiveActionTypes";
import { simulateStaminaAction } from "../stamina/staminaSimulation";
import type { StaminaProfile, StaminaState } from "../stamina/staminaTypes";
import { simulateCombatExchange } from "./combatExchangeSimulation";

export interface StaminaCombatExchangeSimulation {
  actionAccepted: boolean;
  sufficientStamina: boolean;
  startingStamina: number;
  requestedStaminaCost: number;
  consumedStamina: number;
  remainingStamina: number;
  finalStaminaState: StaminaState;
  actionTotalSteps: number;
  activeStartStep: number;
  activeEndStep: number;
  hitStep: number;
  hitAccepted: boolean;
  startingHealth: number;
  incomingDamage: number;
  appliedDamage: number;
  remainingHealth: number;
  overkillDamage: number;
  defeated: boolean;
  finalActionState: OffensiveActionState;
  finalTargetState: TargetState;
}

export function simulateStaminaCombatExchange(stamina: StaminaProfile, health: HealthProfile, action: OffensiveActionProfile): StaminaCombatExchangeSimulation | null {
  const staminaResult = simulateStaminaAction(stamina, action);
  if (staminaResult.actionAccepted) {
    const combat = simulateCombatExchange(health, action);
    return combat ? {
      actionAccepted: staminaResult.actionAccepted,
      sufficientStamina: staminaResult.sufficientStamina,
      startingStamina: staminaResult.startingStamina,
      requestedStaminaCost: staminaResult.requestedStaminaCost,
      consumedStamina: staminaResult.consumedStamina,
      remainingStamina: staminaResult.remainingStamina,
      finalStaminaState: staminaResult.finalStaminaState,
      ...combat
    } : null;
  }

  const actionResult = simulateOffensiveAction(action);
  const target = simulateDamage(health, 0);
  return {
    actionAccepted: staminaResult.actionAccepted,
    sufficientStamina: staminaResult.sufficientStamina,
    startingStamina: staminaResult.startingStamina,
    requestedStaminaCost: staminaResult.requestedStaminaCost,
    consumedStamina: staminaResult.consumedStamina,
    remainingStamina: staminaResult.remainingStamina,
    finalStaminaState: staminaResult.finalStaminaState,
    actionTotalSteps: actionResult.totalSteps,
    activeStartStep: actionResult.activeStartStep,
    activeEndStep: actionResult.activeEndStep,
    hitStep: actionResult.activeStartStep,
    hitAccepted: false,
    startingHealth: target.startingHealth,
    incomingDamage: target.incomingDamage,
    appliedDamage: target.appliedDamage,
    remainingHealth: target.remainingHealth,
    overkillDamage: target.overkillDamage,
    defeated: target.defeated,
    finalActionState: "ready",
    finalTargetState: target.finalTargetState
  };
}
