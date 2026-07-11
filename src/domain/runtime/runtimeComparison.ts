import type { MovementScenario } from "../movement/movementTypes";
import type { SimulationResult } from "../movement/movementSimulation";

export const RUNTIME_TOLERANCES = {
  speed: 0.02,
  distance: 0.05,
  timeEpsilon: 1e-9,
  stamina: 0.02,
  angle: 0.25,
  steps: 0
} as const;

export interface MetricComparison {
  metric: string;
  expected: number | null;
  actual: number | null;
  absoluteDifference: number;
  tolerance: number;
  passed: boolean;
}

export interface RuntimeComparison { passed: boolean; metrics: MetricComparison[] }

const scenarioMetrics: Record<MovementScenario, Array<[string, string, keyof typeof RUNTIME_TOLERANCES]>> = {
  accelerate: [["finalSpeed", "finalSpeed", "speed"], ["maximumObservedSpeed", "maximumObservedSpeed", "speed"], ["timeToNinetyFivePercentSeconds", "timeToNinetyFivePercentSeconds", "timeEpsilon"], ["totalDistance", "totalDistance", "distance"], ["simulationSteps", "physicsSteps", "steps"]],
  stop: [["stoppingTimeSeconds", "stoppingTimeSeconds", "timeEpsilon"], ["stoppingDistance", "stoppingDistance", "distance"], ["finalSpeed", "finalSpeed", "speed"], ["simulationSteps", "physicsSteps", "steps"]],
  sprint: [["totalDistance", "totalDistance", "distance"], ["finalSpeed", "finalSpeed", "speed"], ["staminaConsumed", "staminaConsumed", "stamina"], ["finalStamina", "finalStamina", "stamina"], ["timeUntilSprintUnavailableSeconds", "timeUntilSprintUnavailableSeconds", "timeEpsilon"], ["simulationSteps", "physicsSteps", "steps"]],
  dodge: [["configuredDistance", "configuredDistance", "distance"], ["simulatedDistance", "simulatedDistance", "distance"], ["durationSeconds", "durationSeconds", "timeEpsilon"], ["invulnerabilityStartSeconds", "invulnerabilityStartSeconds", "timeEpsilon"], ["invulnerabilityEndSeconds", "invulnerabilityEndSeconds", "timeEpsilon"], ["invulnerabilityDurationSeconds", "invulnerabilityDurationSeconds", "timeEpsilon"], ["staminaConsumed", "staminaConsumed", "stamina"], ["simulationSteps", "physicsSteps", "steps"]],
  turn: [["targetYawDegrees", "targetYawDegrees", "angle"], ["finalYawDegrees", "finalYawDegrees", "angle"], ["maximumAngularSpeedDegreesPerSecond", "maximumAngularSpeedDegreesPerSecond", "angle"], ["timeToTargetYawSeconds", "timeToTargetYawSeconds", "timeEpsilon"], ["simulationSteps", "physicsSteps", "steps"]]
};

export function compareMovementRuntime(simulation: SimulationResult, runtimeMetrics: Record<string, unknown>, fixedDeltaSeconds = 1 / 60): RuntimeComparison {
  const metrics = scenarioMetrics[simulation.scenario].map(([expectedName, actualName, toleranceName]) => {
    const expectedValue = simulation.metrics[expectedName];
    const actualValue = runtimeMetrics[actualName];
    const expected = typeof expectedValue === "number" ? expectedValue : null;
    const actual = typeof actualValue === "number" ? actualValue : null;
    const tolerance = toleranceName === "timeEpsilon" ? fixedDeltaSeconds + RUNTIME_TOLERANCES.timeEpsilon : RUNTIME_TOLERANCES[toleranceName];
    const absoluteDifference = expected === null && actual === null ? 0 : expected !== null && actual !== null && Number.isFinite(expected) && Number.isFinite(actual) ? Math.abs(expected - actual) : Number.POSITIVE_INFINITY;
    return { metric: actualName, expected, actual, absoluteDifference, tolerance, passed: absoluteDifference <= tolerance };
  });
  return { passed: metrics.every((metric) => metric.passed), metrics };
}
