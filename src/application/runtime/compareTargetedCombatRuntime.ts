import type { TargetedCombatExchangeSimulation } from "../../domain/combat/targetedCombatExchangeSimulation";

export interface TargetedCombatMetricComparison { metric: string; expected: unknown; actual: unknown; absoluteDifference: number; tolerance: number; passed: boolean }
export interface TargetedCombatRuntimeComparison { passed: boolean; metrics: TargetedCombatMetricComparison[] }

export function compareTargetedCombatRuntime(simulation: TargetedCombatExchangeSimulation, runtime: Record<string, unknown>): TargetedCombatRuntimeComparison {
  const numericMetrics = new Set(["startingStamina", "requestedStaminaCost", "consumedStamina", "remainingStamina", "startingHealth", "incomingDamage", "appliedDamage", "remainingHealth", "overkillDamage"]);
  const metrics = (Object.keys(simulation) as Array<keyof TargetedCombatExchangeSimulation>).map((metric) => {
    const expected = simulation[metric]; const actual = runtime[metric]; const tolerance = numericMetrics.has(metric) ? 1e-6 : 0;
    const numeric = typeof expected === "number" && typeof actual === "number" && Number.isFinite(expected) && Number.isFinite(actual);
    const absoluteDifference = numeric ? Math.abs(expected - actual) : Object.is(expected, actual) ? 0 : Number.POSITIVE_INFINITY;
    return { metric, expected, actual, absoluteDifference, tolerance, passed: absoluteDifference <= tolerance };
  });
  return { passed: metrics.every((metric) => metric.passed), metrics };
}
