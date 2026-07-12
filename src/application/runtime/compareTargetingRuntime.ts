export const TARGETING_RUNTIME_TOLERANCES = { angle: 0.25, distance: 0.05, positionComponent: 0.05, score: 1e-6, timeEpsilon: 1e-9, steps: 0, lens: 0.001, exact: 0 } as const;

export interface TargetingMetricComparison { metric: string; expected: unknown; actual: unknown; absoluteDifference: number; tolerance: number; passed: boolean }
export interface TargetingRuntimeComparison { passed: boolean; metrics: TargetingMetricComparison[] }

export function compareTargetingRuntime(simulation: { metrics: Record<string, unknown> }, runtime: Record<string, unknown>, fixedDeltaSeconds = 1 / 60): TargetingRuntimeComparison {
  const metrics: TargetingMetricComparison[] = [];
  visit("", normalize(simulation.metrics, ""), normalize(runtime, ""), metrics, fixedDeltaSeconds);
  return { passed: metrics.every((item) => item.passed), metrics };
}

function visit(path: string, expected: unknown, actual: unknown, results: TargetingMetricComparison[], delta: number): void {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) { results.push(result(path, expected.length, Array.isArray(actual) ? actual.length : actual, 0)); return; }
    expected.forEach((value, index) => visit(`${path}.${index}`, value, actual[index], results, delta)); return;
  }
  const expectedRecord = record(expected);
  if (expectedRecord) {
    const actualRecord = record(actual); if (!actualRecord) { results.push(result(path, expected, actual, 0)); return; }
    for (const key of Object.keys(expectedRecord).sort()) visit(path ? `${path}.${key}` : key, expectedRecord[key], actualRecord[key], results, delta);
    return;
  }
  const tolerance = toleranceFor(path, delta); results.push(result(path, expected, actual, tolerance));
}

function result(metric: string, expected: unknown, actual: unknown, tolerance: number): TargetingMetricComparison {
  const numeric = typeof expected === "number" && Number.isFinite(expected) && typeof actual === "number" && Number.isFinite(actual);
  const absoluteDifference = numeric ? Math.abs(expected - actual) : Object.is(expected, actual) ? 0 : Number.POSITIVE_INFINITY;
  return { metric, expected, actual, absoluteDifference, tolerance, passed: absoluteDifference <= tolerance };
}

function toleranceFor(path: string, delta: number): number {
  if (/physicsSteps|Step$/.test(path)) return TARGETING_RUNTIME_TOLERANCES.steps;
  if (/TimeSeconds$|fixedDeltaSeconds$/.test(path)) return delta + TARGETING_RUNTIME_TOLERANCES.timeEpsilon;
  if (/totalScore|priorityScore|distanceScore|angleScore|priority$/.test(path)) return TARGETING_RUNTIME_TOLERANCES.score;
  if (/lens\./.test(path)) return TARGETING_RUNTIME_TOLERANCES.lens;
  if (/Degrees|Angular/.test(path)) return TARGETING_RUNTIME_TOLERANCES.angle;
  if (/Position\.|Point\./.test(path)) return TARGETING_RUNTIME_TOLERANCES.positionComponent;
  if (/distance|Distance|Translation|Error/.test(path)) return TARGETING_RUNTIME_TOLERANCES.distance;
  return TARGETING_RUNTIME_TOLERANCES.exact;
}

function normalize(value: unknown, path: string): unknown {
  if (Array.isArray(value)) {
    const normalized = value.map((item, index) => normalize(item, `${path}.${index}`));
    if (path.endsWith("candidateEvaluations")) return normalized.sort((a, b) => String(record(a)?.id ?? "").localeCompare(String(record(b)?.id ?? "")));
    if (path.endsWith("rejectionCodes")) return normalized.sort((a, b) => String(a).localeCompare(String(b)));
    return normalized;
  }
  const valueRecord = record(value); if (valueRecord) return Object.fromEntries(Object.entries(valueRecord).map(([key, item]) => [key, normalize(item, path ? `${path}.${key}` : key)]));
  return value;
}
function record(value: unknown): Record<string, unknown> | null { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null; }
