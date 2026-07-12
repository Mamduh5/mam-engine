import type { StaminaActionSimulation } from "../../domain/stamina/staminaTypes";

export interface StaminaMetricComparison { metric: string; expected: unknown; actual: unknown; absoluteDifference: number; tolerance: number; passed: boolean }
export interface StaminaRuntimeComparison { passed: boolean; metrics: StaminaMetricComparison[] }

export function compareStaminaRuntime(simulation: StaminaActionSimulation, runtime: Record<string, unknown>): StaminaRuntimeComparison {
  const tolerances: Record<keyof StaminaActionSimulation, number> = { actionKind: 0, startingStamina: 1e-6, requestedStaminaCost: 1e-6, consumedStamina: 1e-6, remainingStamina: 1e-6, sufficientStamina: 0, actionAccepted: 0, finalStaminaState: 0 };
  const metrics = (Object.keys(tolerances) as Array<keyof StaminaActionSimulation>).map((metric) => { const expected = simulation[metric]; const actual = runtime[metric]; const numeric = typeof expected === "number" && typeof actual === "number" && Number.isFinite(expected) && Number.isFinite(actual); const absoluteDifference = numeric ? Math.abs(expected - actual) : Object.is(expected, actual) ? 0 : Number.POSITIVE_INFINITY; const tolerance = tolerances[metric]; return { metric, expected, actual, absoluteDifference, tolerance, passed: absoluteDifference <= tolerance }; });
  return { passed: metrics.every((metric) => metric.passed), metrics };
}
