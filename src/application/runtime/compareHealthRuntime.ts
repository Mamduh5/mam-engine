import type { HitSimulation } from "../../domain/health/healthTypes";

export interface HealthMetricComparison { metric: string; expected: unknown; actual: unknown; absoluteDifference: number; tolerance: number; passed: boolean }
export interface HealthRuntimeComparison { passed: boolean; metrics: HealthMetricComparison[] }

export function compareHealthRuntime(simulation: HitSimulation, runtime: Record<string, unknown>): HealthRuntimeComparison {
  const tolerances: Record<keyof HitSimulation, number> = { startingHealth: 1e-6, incomingDamage: 1e-6, appliedDamage: 1e-6, remainingHealth: 1e-6, overkillDamage: 1e-6, defeated: 0, finalTargetState: 0 };
  const metrics = (Object.keys(tolerances) as Array<keyof HitSimulation>).map((metric) => { const expected = simulation[metric]; const actual = runtime[metric]; const numeric = typeof expected === "number" && typeof actual === "number" && Number.isFinite(expected) && Number.isFinite(actual); const absoluteDifference = numeric ? Math.abs(expected - actual) : Object.is(expected, actual) ? 0 : Number.POSITIVE_INFINITY; const tolerance = tolerances[metric]; return { metric, expected, actual, absoluteDifference, tolerance, passed: absoluteDifference <= tolerance }; });
  return { passed: metrics.every((metric) => metric.passed), metrics };
}
