import { simulateDamage } from "../health/hitSimulation";
import type { HealthProfile } from "../health/healthTypes";
import { simulateOffensiveAction } from "../offensiveAction/offensiveActionSimulation";
import type { OffensiveActionProfile } from "../offensiveAction/offensiveActionTypes";
import { simulateStaminaAction } from "../stamina/staminaSimulation";
import type { StaminaProfile } from "../stamina/staminaTypes";
import { acquireTarget } from "../targeting/targetingSimulation";
import type { TargetCandidate, TargetingContext, TargetingProfile } from "../targeting/targetingTypes";
import { simulateStaminaCombatExchange, type StaminaCombatExchangeSimulation } from "./staminaCombatExchangeSimulation";

export type TargetedCombatExchangeScenario = "target-available" | "no-valid-target";

export interface TargetedCombatExchangeSimulation extends StaminaCombatExchangeSimulation {
  scenario: TargetedCombatExchangeScenario;
  targetAcquired: boolean;
  selectedTargetId: string | null;
  targetingFinalState: "locked" | "unlocked";
}

export function simulateTargetedCombatExchange(
  targeting: TargetingProfile,
  stamina: StaminaProfile,
  health: HealthProfile,
  action: OffensiveActionProfile,
  scenario: TargetedCombatExchangeScenario
): TargetedCombatExchangeSimulation | null {
  const candidate: TargetCandidate = {
    id: "target-1",
    targetPoint: { x: 0, y: 0, z: -targeting.acquisition.maximumDistance / 2 },
    targetable: scenario === "target-available",
    lineOfSight: true,
    priority: 1
  };
  const context: TargetingContext = {
    origin: { x: 0, y: 0, z: 0 },
    viewForward: { x: 0, y: 0, z: -1 },
    candidates: [candidate],
    currentTargetId: null
  };
  const targetingResult = acquireTarget(targeting, context);
  const selectedTargetId = targetingResult.selectedTargetId;

  if (selectedTargetId !== null) {
    const exchange = simulateStaminaCombatExchange(stamina, health, action);
    return exchange ? {
      scenario,
      targetAcquired: true,
      selectedTargetId,
      targetingFinalState: "locked",
      ...exchange
    } : null;
  }

  const unchangedStamina = simulateStaminaAction(stamina, { ...action, staminaCost: 0 });
  const actionResult = simulateOffensiveAction(action);
  const targetResult = simulateDamage(health, 0);
  return {
    scenario,
    targetAcquired: false,
    selectedTargetId: null,
    targetingFinalState: "unlocked",
    actionAccepted: false,
    sufficientStamina: false,
    startingStamina: unchangedStamina.startingStamina,
    requestedStaminaCost: action.staminaCost,
    consumedStamina: unchangedStamina.consumedStamina,
    remainingStamina: unchangedStamina.remainingStamina,
    finalStaminaState: unchangedStamina.finalStaminaState,
    actionTotalSteps: actionResult.totalSteps,
    activeStartStep: actionResult.activeStartStep,
    activeEndStep: actionResult.activeEndStep,
    hitStep: actionResult.activeStartStep,
    hitAccepted: false,
    startingHealth: targetResult.startingHealth,
    incomingDamage: targetResult.incomingDamage,
    appliedDamage: targetResult.appliedDamage,
    remainingHealth: targetResult.remainingHealth,
    overkillDamage: targetResult.overkillDamage,
    defeated: targetResult.defeated,
    finalActionState: actionResult.finalActionState,
    finalTargetState: targetResult.finalTargetState
  };
}
