import type { ContactVolumeSimulation } from "../../domain/contactVolume/contactVolumeTypes";

export interface ContactVolumeMetricComparison { metric: string; expected: unknown; actual: unknown; absoluteDifference: number; tolerance: number; passed: boolean }
export interface ContactVolumeRuntimeComparison { passed: boolean; metrics: ContactVolumeMetricComparison[] }

export function compareContactVolumeRuntime(simulation: ContactVolumeSimulation, runtime: Record<string, unknown>): ContactVolumeRuntimeComparison {
  const metrics = (Object.keys(simulation) as Array<keyof ContactVolumeSimulation>).map((metric) => {
    const expected = simulation[metric]; const actual = runtime[metric];
    const absoluteDifference = Object.is(expected, actual) ? 0 : Number.POSITIVE_INFINITY;
    return { metric, expected, actual, absoluteDifference, tolerance: 0, passed: absoluteDifference === 0 };
  });
  return { passed: metrics.every((metric) => metric.passed), metrics };
}
