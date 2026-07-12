import type { CameraScenario } from "../camera/cameraTypes";

const numericMetrics: Record<CameraScenario, string[]> = {
  orbit: ["durationSeconds", "initialYawDegrees", "finalYawDegrees", "totalYawTravelDegrees", "initialPitchDegrees", "finalPitchDegrees", "totalPitchTravelDegrees", "physicsSteps", "fixedDeltaSeconds"],
  "pitch-clamp": ["minimumObservedPitchDegrees", "maximumObservedPitchDegrees", "configuredMinimumPitchDegrees", "configuredMaximumPitchDegrees", "stepsToPositiveClamp", "stepsToNegativeClamp", "physicsSteps", "fixedDeltaSeconds"],
  recenter: ["initialYawErrorDegrees", "delaySeconds", "recenterStartSeconds", "timeToWithinToleranceSeconds", "finalYawErrorDegrees", "maximumAngularSpeedDegreesPerSecond", "physicsSteps", "fixedDeltaSeconds"],
  follow: ["durationSeconds", "initialFollowError", "maximumFollowError", "finalFollowError", "physicsSteps", "fixedDeltaSeconds"],
  collision: ["desiredDistance", "minimumObservedDistance", "compressedDistance", "finalRecoveredDistance", "compressionRatio", "recoveryDurationSeconds", "physicsSteps", "fixedDeltaSeconds"],
  basis: []
};

export function validateCameraRuntimeMetrics(scenario: CameraScenario, metrics: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const field of numericMetrics[scenario]) {
    const value = metrics[field];
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) errors.push(`metrics.${field} must be a finite number or null`);
  }
  if (scenario === "pitch-clamp") for (const field of ["positiveClampReached", "negativeClampReached"]) if (typeof metrics[field] !== "boolean") errors.push(`metrics.${field} must be boolean`);
  if (scenario === "collision" && typeof metrics.collisionDetected !== "boolean") errors.push("metrics.collisionDetected must be boolean");
  if (scenario === "follow") for (const field of ["finalCameraPosition", "finalTargetPosition"]) errors.push(...validateVector(metrics[field], `metrics.${field}`));
  if (scenario === "basis") {
    if (!Array.isArray(metrics.samples) || metrics.samples.length !== 4) errors.push("metrics.samples must contain four basis samples");
    else metrics.samples.forEach((sample, index) => {
      if (!isRecord(sample)) { errors.push(`metrics.samples.${index} must be an object`); return; }
      for (const field of ["yawDegrees", "orthogonalityDot", "forwardMagnitude", "rightMagnitude"]) if (typeof sample[field] !== "number" || !Number.isFinite(sample[field])) errors.push(`metrics.samples.${index}.${field} must be finite`);
      errors.push(...validateVector(sample.forward, `metrics.samples.${index}.forward`), ...validateVector(sample.right, `metrics.samples.${index}.right`));
    });
  }
  if (!isRecord(metrics.lens)) errors.push("metrics.lens must be an object");
  else for (const field of ["fieldOfViewDegrees", "nearClipDistance", "farClipDistance"]) if (typeof metrics.lens[field] !== "number" || !Number.isFinite(metrics.lens[field])) errors.push(`metrics.lens.${field} must be finite`);
  return errors;
}

function validateVector(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object`];
  return ["x", "y", "z"].flatMap((field) => typeof value[field] === "number" && Number.isFinite(value[field]) ? [] : [`${path}.${field} must be finite`]);
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
