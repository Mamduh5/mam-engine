import type { DefensiveActionSimulation } from "../../domain/defensiveAction/defensiveActionTypes";

export interface DefensiveActionMetricComparison { metric: string; expected: unknown; actual: unknown; absoluteDifference: number; tolerance: number; passed: boolean }
export interface DefensiveActionRuntimeComparison { passed: boolean; metrics: DefensiveActionMetricComparison[] }

export function compareDefensiveActionRuntime(simulation: DefensiveActionSimulation, runtime: Record<string, unknown>): DefensiveActionRuntimeComparison {
  const tolerances: Record<keyof DefensiveActionSimulation, number> = { fixedDeltaSeconds: 1e-9, totalSteps: 0, distanceTravelled: 1e-6, staminaConsumed: 1e-6, invulnerabilityStartStep: 0, invulnerabilityEndStep: 0, cooldownCompletionStep: 0, finalActionState: 0 };
  const metrics = (Object.keys(tolerances) as Array<keyof DefensiveActionSimulation>).map((metric) => { const expected = simulation[metric]; const actual = runtime[metric]; const numeric = typeof expected === "number" && typeof actual === "number" && Number.isFinite(expected) && Number.isFinite(actual); const absoluteDifference = numeric ? Math.abs(expected - actual) : Object.is(expected, actual) ? 0 : Number.POSITIVE_INFINITY; const tolerance = tolerances[metric]; return { metric, expected, actual, absoluteDifference, tolerance, passed: absoluteDifference <= tolerance }; });
  return { passed: metrics.every((metric) => metric.passed), metrics };
}
