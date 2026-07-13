import type { ActionTimelineSimulation } from "../../domain/actionTimeline/actionTimelineTypes";

export interface ActionTimelineMetricComparison { metric: string; expected: unknown; actual: unknown; absoluteDifference: number; tolerance: number; passed: boolean }
export interface ActionTimelineRuntimeComparison { passed: boolean; metrics: ActionTimelineMetricComparison[] }

export function compareActionTimelineRuntime(simulation: ActionTimelineSimulation, runtime: Record<string, unknown>): ActionTimelineRuntimeComparison {
  const expected = { ...simulation, emittedEventCount: simulation.emittedEvents.length };
  const metrics: ActionTimelineMetricComparison[] = [];
  visit("", expected, runtime, metrics);
  return { passed: metrics.every((metric) => metric.passed), metrics };
}

function visit(path: string, expected: unknown, actual: unknown, metrics: ActionTimelineMetricComparison[]): void {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) { metrics.push(result(path, expected.length, Array.isArray(actual) ? actual.length : actual, 0)); return; }
    expected.forEach((value, index) => visit(`${path}.${index}`, value, actual[index], metrics)); return;
  }
  const expectedRecord = record(expected);
  if (expectedRecord) {
    const actualRecord = record(actual); if (!actualRecord) { metrics.push(result(path, expected, actual, 0)); return; }
    for (const key of Object.keys(expectedRecord)) visit(path ? `${path}.${key}` : key, expectedRecord[key], actualRecord[key], metrics);
    return;
  }
  metrics.push(result(path, expected, actual, typeof expected === "number" ? 1e-9 : 0));
}

function result(metric: string, expected: unknown, actual: unknown, tolerance: number): ActionTimelineMetricComparison { const numeric = typeof expected === "number" && typeof actual === "number" && Number.isFinite(expected) && Number.isFinite(actual); const absoluteDifference = numeric ? Math.abs(expected - actual) : Object.is(expected, actual) ? 0 : Number.POSITIVE_INFINITY; return { metric, expected, actual, absoluteDifference, tolerance, passed: absoluteDifference <= tolerance }; }
function record(value: unknown): Record<string, unknown> | null { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null; }
