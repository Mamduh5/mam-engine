import type { CameraProfile } from "../../domain/camera/cameraTypes";

export const CAMERA_RUNTIME_TOLERANCES = {
  angle: 0.25,
  distance: 0.05,
  positionComponent: 0.05,
  timeEpsilon: 1e-9,
  vectorMagnitude: 0.001,
  orthogonalityDot: 0.001,
  steps: 0,
  lens: 0.001,
  boolean: 0
} as const;

export interface CameraMetricComparison {
  metric: string;
  expected: number | boolean | null;
  actual: number | boolean | null;
  absoluteDifference: number;
  tolerance: number;
  passed: boolean;
}
export interface CameraRuntimeComparison { passed: boolean; metrics: CameraMetricComparison[] }

export function compareCameraRuntime(simulation: { scenario: string; metrics: Record<string, unknown> }, runtime: Record<string, unknown>, profile: CameraProfile, fixedDeltaSeconds = 1 / 60): CameraRuntimeComparison {
  const comparisons: CameraMetricComparison[] = [];
  const add = (metric: string, expected: unknown, actual: unknown, tolerance: number) => comparisons.push(compare(metric, expected, actual, tolerance));
  const e = simulation.metrics;
  const scenario = simulation.scenario;
  if (scenario === "orbit") for (const field of ["durationSeconds", "initialYawDegrees", "finalYawDegrees", "totalYawTravelDegrees", "initialPitchDegrees", "finalPitchDegrees", "totalPitchTravelDegrees"]) add(field, e[field], runtime[field], field === "durationSeconds" ? fixedDeltaSeconds + CAMERA_RUNTIME_TOLERANCES.timeEpsilon : CAMERA_RUNTIME_TOLERANCES.angle);
  if (scenario === "pitch-clamp") {
    for (const field of ["minimumObservedPitchDegrees", "maximumObservedPitchDegrees", "configuredMinimumPitchDegrees", "configuredMaximumPitchDegrees"]) add(field, e[field], runtime[field], CAMERA_RUNTIME_TOLERANCES.angle);
    for (const field of ["positiveClampReached", "negativeClampReached"]) add(field, e[field], runtime[field], CAMERA_RUNTIME_TOLERANCES.boolean);
    for (const field of ["stepsToPositiveClamp", "stepsToNegativeClamp"]) add(field, e[field], runtime[field], CAMERA_RUNTIME_TOLERANCES.steps);
  }
  if (scenario === "recenter") {
    for (const field of ["initialYawErrorDegrees", "finalYawErrorDegrees", "maximumAngularSpeedDegreesPerSecond"]) add(field, e[field], runtime[field], CAMERA_RUNTIME_TOLERANCES.angle);
    for (const field of ["delaySeconds", "recenterStartSeconds", "timeToWithinToleranceSeconds"]) add(field, e[field], runtime[field], fixedDeltaSeconds + CAMERA_RUNTIME_TOLERANCES.timeEpsilon);
  }
  if (scenario === "follow") {
    for (const field of ["initialFollowError", "maximumFollowError", "finalFollowError"]) add(field, e[field], runtime[field], CAMERA_RUNTIME_TOLERANCES.distance);
    for (const vector of ["finalCameraPosition", "finalTargetPosition"]) for (const component of ["x", "y", "z"]) add(`${vector}.${component}`, record(e[vector])?.[component], record(runtime[vector])?.[component], CAMERA_RUNTIME_TOLERANCES.positionComponent);
    add("durationSeconds", e.durationSeconds, runtime.durationSeconds, fixedDeltaSeconds + CAMERA_RUNTIME_TOLERANCES.timeEpsilon);
  }
  if (scenario === "collision") {
    for (const field of ["desiredDistance", "minimumObservedDistance", "compressedDistance", "finalRecoveredDistance"]) add(field, e[field], runtime[field], CAMERA_RUNTIME_TOLERANCES.distance);
    add("compressionRatio", e.compressionRatio, runtime.compressionRatio, CAMERA_RUNTIME_TOLERANCES.distance);
    add("recoveryDurationSeconds", e.recoveryDurationSeconds, runtime.recoveryDurationSeconds, fixedDeltaSeconds + CAMERA_RUNTIME_TOLERANCES.timeEpsilon);
    add("collisionDetected", e.collisionDetected, runtime.collisionDetected, CAMERA_RUNTIME_TOLERANCES.boolean);
  }
  if (scenario === "basis") {
    const expectedSamples = Array.isArray(e.samples) ? e.samples : [];
    const actualSamples = Array.isArray(runtime.samples) ? runtime.samples : [];
    for (let index = 0; index < 4; index += 1) {
      const expected = record(expectedSamples[index]); const actual = record(actualSamples[index]);
      add(`samples.${index}.yawDegrees`, expected?.yawDegrees, actual?.yawDegrees, CAMERA_RUNTIME_TOLERANCES.angle);
      for (const vector of ["forward", "right"]) for (const component of ["x", "y", "z"]) add(`samples.${index}.${vector}.${component}`, record(expected?.[vector])?.[component], record(actual?.[vector])?.[component], CAMERA_RUNTIME_TOLERANCES.vectorMagnitude);
      for (const field of ["forwardMagnitude", "rightMagnitude"]) add(`samples.${index}.${field}`, expected?.[field], actual?.[field], CAMERA_RUNTIME_TOLERANCES.vectorMagnitude);
      add(`samples.${index}.orthogonalityDot`, expected?.orthogonalityDot, actual?.orthogonalityDot, CAMERA_RUNTIME_TOLERANCES.orthogonalityDot);
    }
  }
  if (scenario !== "basis") add("physicsSteps", e.physicsSteps, runtime.physicsSteps, CAMERA_RUNTIME_TOLERANCES.steps);
  const lens = record(runtime.lens);
  add("lens.fieldOfViewDegrees", profile.lens.fieldOfViewDegrees, lens?.fieldOfViewDegrees, CAMERA_RUNTIME_TOLERANCES.lens);
  add("lens.nearClipDistance", profile.lens.nearClipDistance, lens?.nearClipDistance, CAMERA_RUNTIME_TOLERANCES.lens);
  add("lens.farClipDistance", profile.lens.farClipDistance, lens?.farClipDistance, CAMERA_RUNTIME_TOLERANCES.lens);
  return { passed: comparisons.every((item) => item.passed), metrics: comparisons };
}

function compare(metric: string, expectedValue: unknown, actualValue: unknown, tolerance: number): CameraMetricComparison {
  const expected = scalar(expectedValue); const actual = scalar(actualValue);
  const absoluteDifference = typeof expected === "boolean" && typeof actual === "boolean" ? (expected === actual ? 0 : 1) : expected === null && actual === null ? 0 : typeof expected === "number" && typeof actual === "number" && Number.isFinite(expected) && Number.isFinite(actual) ? Math.abs(expected - actual) : Number.POSITIVE_INFINITY;
  return { metric, expected, actual, absoluteDifference, tolerance, passed: absoluteDifference <= tolerance };
}
function scalar(value: unknown): number | boolean | null { return typeof value === "number" || typeof value === "boolean" ? value : null; }
function record(value: unknown): Record<string, unknown> | null { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null; }
