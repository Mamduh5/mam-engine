import type { StaminaCombatExchangeSimulation } from "../../domain/combat/staminaCombatExchangeSimulation";

export interface StaminaCombatMetricComparison { metric: string; expected: unknown; actual: unknown; absoluteDifference: number; tolerance: number; passed: boolean }
export interface StaminaCombatRuntimeComparison { passed: boolean; metrics: StaminaCombatMetricComparison[] }

export function compareStaminaCombatRuntime(simulation: StaminaCombatExchangeSimulation, runtime: Record<string, unknown>): StaminaCombatRuntimeComparison {
  const tolerances: Record<keyof StaminaCombatExchangeSimulation, number> = {
    actionAccepted: 0, sufficientStamina: 0, startingStamina: 1e-6, requestedStaminaCost: 1e-6, consumedStamina: 1e-6, remainingStamina: 1e-6, finalStaminaState: 0,
    actionTotalSteps: 0, activeStartStep: 0, activeEndStep: 0, hitStep: 0, hitAccepted: 0,
    startingHealth: 1e-6, incomingDamage: 1e-6, appliedDamage: 1e-6, remainingHealth: 1e-6, overkillDamage: 1e-6, defeated: 0, finalActionState: 0, finalTargetState: 0
  };
  const metrics = (Object.keys(tolerances) as Array<keyof StaminaCombatExchangeSimulation>).map((metric) => { const expected = simulation[metric]; const actual = runtime[metric]; const numeric = typeof expected === "number" && typeof actual === "number" && Number.isFinite(expected) && Number.isFinite(actual); const absoluteDifference = numeric ? Math.abs(expected - actual) : Object.is(expected, actual) ? 0 : Number.POSITIVE_INFINITY; const tolerance = tolerances[metric]; return { metric, expected, actual, absoluteDifference, tolerance, passed: absoluteDifference <= tolerance }; });
  return { passed: metrics.every((metric) => metric.passed), metrics };
}
