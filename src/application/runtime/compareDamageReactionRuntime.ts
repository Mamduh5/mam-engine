import type { DamageReactionSimulation } from "../../domain/damageReaction/damageReactionTypes";

export interface DamageReactionMetricComparison { metric: string; expected: unknown; actual: unknown; absoluteDifference: number; tolerance: number; passed: boolean }
export interface DamageReactionRuntimeComparison { passed: boolean; metrics: DamageReactionMetricComparison[] }

export function compareDamageReactionRuntime(simulation: DamageReactionSimulation, runtime: Record<string, unknown>): DamageReactionRuntimeComparison {
  const numericMetrics = new Set(["startingHealth", "incomingDamage", "appliedDamage", "remainingHealth", "staggerThreshold", "reactionDurationSeconds"]);
  const metrics = (Object.keys(simulation) as Array<keyof DamageReactionSimulation>).map((metric) => { const expected = simulation[metric]; const actual = runtime[metric]; const tolerance = numericMetrics.has(metric) ? 1e-6 : 0; const numeric = typeof expected === "number" && typeof actual === "number" && Number.isFinite(expected) && Number.isFinite(actual); const absoluteDifference = numeric ? Math.abs(expected - actual) : Object.is(expected, actual) ? 0 : Number.POSITIVE_INFINITY; return { metric, expected, actual, absoluteDifference, tolerance, passed: absoluteDifference <= tolerance }; });
  return { passed: metrics.every((metric) => metric.passed), metrics };
}
