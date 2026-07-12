import { simulateHit } from "../health/hitSimulation";
import type { HealthProfile, TargetState } from "../health/healthTypes";
import { simulateOffensiveAction } from "../offensiveAction/offensiveActionSimulation";
import type { OffensiveActionProfile, OffensiveActionState } from "../offensiveAction/offensiveActionTypes";

export interface CombatExchangeSimulation {
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

export function simulateCombatExchange(health: HealthProfile, action: OffensiveActionProfile): CombatExchangeSimulation | null {
  const actionSimulation = simulateOffensiveAction(action);
  const hitStep = actionSimulation.activeStartStep;
  const hitAccepted = hitStep >= 1
    && hitStep <= actionSimulation.totalSteps
    && hitStep <= actionSimulation.activeEndStep;

  if (!hitAccepted) return null;

  const hit = simulateHit(health, action);
  return {
    actionTotalSteps: actionSimulation.totalSteps,
    activeStartStep: actionSimulation.activeStartStep,
    activeEndStep: actionSimulation.activeEndStep,
    hitStep,
    hitAccepted,
    startingHealth: hit.startingHealth,
    incomingDamage: hit.incomingDamage,
    appliedDamage: hit.appliedDamage,
    remainingHealth: hit.remainingHealth,
    overkillDamage: hit.overkillDamage,
    defeated: hit.defeated,
    finalActionState: actionSimulation.finalActionState,
    finalTargetState: hit.finalTargetState
  };
}
