import type { CombatExchangeSimulation } from "../../domain/combat/combatExchangeSimulation";

export interface CombatMetricComparison { metric: string; expected: unknown; actual: unknown; absoluteDifference: number; tolerance: number; passed: boolean }
export interface CombatRuntimeComparison { passed: boolean; metrics: CombatMetricComparison[] }

export function compareCombatRuntime(simulation: CombatExchangeSimulation, runtime: Record<string, unknown>): CombatRuntimeComparison {
  const tolerances: Record<keyof CombatExchangeSimulation, number> = {
    actionTotalSteps: 0, activeStartStep: 0, activeEndStep: 0, hitStep: 0, hitAccepted: 0,
    startingHealth: 1e-6, incomingDamage: 1e-6, appliedDamage: 1e-6, remainingHealth: 1e-6,
    overkillDamage: 1e-6, defeated: 0, finalActionState: 0, finalTargetState: 0
  };
  const metrics = (Object.keys(tolerances) as Array<keyof CombatExchangeSimulation>).map((metric) => {
    const expected = simulation[metric]; const actual = runtime[metric];
    const numeric = typeof expected === "number" && typeof actual === "number" && Number.isFinite(expected) && Number.isFinite(actual);
    const absoluteDifference = numeric ? Math.abs(expected - actual) : Object.is(expected, actual) ? 0 : Number.POSITIVE_INFINITY;
    const tolerance = tolerances[metric];
    return { metric, expected, actual, absoluteDifference, tolerance, passed: absoluteDifference <= tolerance };
  });
  return { passed: metrics.every((metric) => metric.passed), metrics };
}
