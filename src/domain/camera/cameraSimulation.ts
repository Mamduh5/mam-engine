import { roundMetric } from "../movement/movementMetrics";
import {
  cameraHorizontalBasis,
  clampPitchDegrees,
  normalizeYawDegrees,
  shortestAngleDifferenceDegrees,
  smoothHalfLifeScalar,
  smoothHalfLifeVector,
  vectorDistance,
  vectorDot,
  vectorMagnitude
} from "./cameraMath";
import type { CameraProfile, CameraScenario, CameraVector3 } from "./cameraTypes";

export const CAMERA_FIXED_DELTA_SECONDS = 1 / 60;
export const CAMERA_ANGLE_TOLERANCE_DEGREES = 0.25;
const EPSILON = 1e-12;

export interface RecenterSimulationOptions {
  manualYawInput?: number;
  movementInputMagnitude?: number;
  movementYawDegrees?: number;
}

export function simulateCamera(profile: CameraProfile, scenario: CameraScenario, seconds?: number, fixedDelta = CAMERA_FIXED_DELTA_SECONDS): { scenario: CameraScenario; metrics: Record<string, unknown> } {
  const duration = seconds ?? defaultDuration(profile, scenario);
  switch (scenario) {
    case "orbit": return { scenario, metrics: simulateOrbit(profile, duration, fixedDelta) };
    case "pitch-clamp": return { scenario, metrics: simulatePitchClamp(profile, duration, fixedDelta) };
    case "recenter": return { scenario, metrics: simulateRecenter(profile, duration, fixedDelta) };
    case "follow": return { scenario, metrics: simulateFollow(profile, duration, fixedDelta) };
    case "collision": return { scenario, metrics: simulateCollision(profile, duration, fixedDelta) };
    case "basis": return { scenario, metrics: simulateBasis() };
  }
}

export function simulateOrbit(profile: CameraProfile, seconds: number, delta: number) {
  const steps = stepCount(seconds, delta);
  let yaw = profile.orbit.initialYawDegrees;
  let pitch = profile.orbit.initialPitchDegrees;
  let yawTravel = 0;
  let pitchTravel = 0;
  const yawRate = profile.orbit.yawSpeedDegreesPerSecond * (profile.orbit.invertYaw ? -1 : 1);
  const pitchRate = profile.orbit.pitchSpeedDegreesPerSecond * 0.5 * (profile.orbit.invertPitch ? -1 : 1);
  for (let index = 0; index < steps; index += 1) {
    const yawChange = yawRate * delta;
    const nextPitch = clampPitchDegrees(pitch + pitchRate * delta, profile.orbit.minimumPitchDegrees, profile.orbit.maximumPitchDegrees);
    yaw = normalizeYawDegrees(yaw + yawChange);
    yawTravel += yawChange;
    pitchTravel += nextPitch - pitch;
    pitch = nextPitch;
  }
  return rounded({ durationSeconds: steps * delta, initialYawDegrees: profile.orbit.initialYawDegrees, finalYawDegrees: yaw, totalYawTravelDegrees: yawTravel, initialPitchDegrees: profile.orbit.initialPitchDegrees, finalPitchDegrees: pitch, totalPitchTravelDegrees: pitchTravel, physicsSteps: steps, fixedDeltaSeconds: delta });
}

export function simulatePitchClamp(profile: CameraProfile, seconds: number, delta: number) {
  const steps = stepCount(seconds, delta);
  const rate = profile.orbit.pitchSpeedDegreesPerSecond;
  let positive = profile.orbit.initialPitchDegrees;
  let negative = profile.orbit.initialPitchDegrees;
  let positiveStep: number | null = null;
  let negativeStep: number | null = null;
  for (let index = 1; index <= steps; index += 1) {
    positive = clampPitchDegrees(positive + rate * delta, profile.orbit.minimumPitchDegrees, profile.orbit.maximumPitchDegrees);
    negative = clampPitchDegrees(negative - rate * delta, profile.orbit.minimumPitchDegrees, profile.orbit.maximumPitchDegrees);
    if (positiveStep === null && positive === profile.orbit.maximumPitchDegrees) positiveStep = index;
    if (negativeStep === null && negative === profile.orbit.minimumPitchDegrees) negativeStep = index;
  }
  return rounded({ minimumObservedPitchDegrees: negative, maximumObservedPitchDegrees: positive, configuredMinimumPitchDegrees: profile.orbit.minimumPitchDegrees, configuredMaximumPitchDegrees: profile.orbit.maximumPitchDegrees, positiveClampReached: positiveStep !== null, negativeClampReached: negativeStep !== null, stepsToPositiveClamp: positiveStep, stepsToNegativeClamp: negativeStep, physicsSteps: steps, fixedDeltaSeconds: delta });
}

export function simulateRecenter(profile: CameraProfile, seconds: number, delta: number, options: RecenterSimulationOptions = {}) {
  const movementYaw = options.movementYawDegrees ?? 0;
  const movementMagnitude = options.movementInputMagnitude ?? 1;
  const manualInput = options.manualYawInput ?? 0;
  const initialYaw = normalizeYawDegrees(movementYaw + 120);
  let yaw = initialYaw;
  let idleSeconds = 0;
  let start: number | null = null;
  let completed: number | null = null;
  let maximumSpeed = 0;
  const steps = stepCount(seconds, delta);
  for (let index = 1; index <= steps; index += 1) {
    if (Math.abs(manualInput) > EPSILON) {
      yaw = normalizeYawDegrees(yaw + manualInput * profile.orbit.yawSpeedDegreesPerSecond * delta * (profile.orbit.invertYaw ? -1 : 1));
      idleSeconds = 0;
      continue;
    }
    idleSeconds += delta;
    if (!profile.recenter.enabled || movementMagnitude < profile.recenter.movementInputThreshold || idleSeconds + EPSILON < profile.recenter.delaySeconds) continue;
    if (start === null) start = index * delta;
    const difference = shortestAngleDifferenceDegrees(yaw, movementYaw);
    const change = Math.sign(difference) * Math.min(Math.abs(difference), profile.recenter.yawSpeedDegreesPerSecond * delta);
    yaw = normalizeYawDegrees(yaw + change);
    maximumSpeed = Math.max(maximumSpeed, Math.abs(change) / delta);
    if (completed === null && Math.abs(shortestAngleDifferenceDegrees(yaw, movementYaw)) <= CAMERA_ANGLE_TOLERANCE_DEGREES) completed = index * delta;
  }
  return rounded({ initialYawErrorDegrees: Math.abs(shortestAngleDifferenceDegrees(initialYaw, movementYaw)), delaySeconds: profile.recenter.delaySeconds, recenterStartSeconds: start, timeToWithinToleranceSeconds: completed, finalYawErrorDegrees: Math.abs(shortestAngleDifferenceDegrees(yaw, movementYaw)), maximumAngularSpeedDegreesPerSecond: maximumSpeed, physicsSteps: steps, fixedDeltaSeconds: delta });
}

export function simulateFollow(profile: CameraProfile, seconds: number, delta: number) {
  const steps = stepCount(seconds, delta);
  const movementSteps = Math.floor(steps / 2);
  const offset = { x: profile.follow.shoulderOffset, y: profile.follow.height, z: -profile.follow.distance };
  let target: CameraVector3 = { x: 0, y: 0, z: 0 };
  let camera: CameraVector3 = { ...offset };
  let maximumError = 0;
  for (let index = 0; index < steps; index += 1) {
    if (index < movementSteps) target = { x: target.x + delta, y: 0, z: 0 };
    const desired = add(target, offset);
    camera = smoothHalfLifeVector(camera, desired, delta, profile.follow.positionHalfLifeSeconds);
    maximumError = Math.max(maximumError, vectorDistance(camera, desired));
  }
  const finalDesired = add(target, offset);
  return rounded({ durationSeconds: steps * delta, initialFollowError: 0, maximumFollowError: maximumError, finalFollowError: vectorDistance(camera, finalDesired), finalCameraPosition: camera, finalTargetPosition: target, physicsSteps: steps, fixedDeltaSeconds: delta });
}

export function simulateCollision(profile: CameraProfile, seconds: number, delta: number, obstructionDistance = 2.5) {
  const steps = stepCount(seconds, delta);
  const obstructionSteps = Math.max(1, Math.floor(steps / 4));
  const desired = profile.follow.distance;
  let distance = desired;
  let minimum = desired;
  let compressed = desired;
  for (let index = 0; index < steps; index += 1) {
    if (profile.collision.enabled && index < obstructionSteps) {
      distance = Math.max(profile.collision.minimumDistance, Math.min(desired, obstructionDistance - profile.collision.probeRadius));
      compressed = distance;
    } else if (profile.collision.enabled) {
      distance = smoothHalfLifeScalar(distance, desired, delta, profile.collision.returnHalfLifeSeconds);
    }
    minimum = Math.min(minimum, distance);
  }
  return rounded({ desiredDistance: desired, minimumObservedDistance: minimum, compressedDistance: compressed, finalRecoveredDistance: distance, compressionRatio: compressed / desired, recoveryDurationSeconds: Math.max(0, (steps - obstructionSteps) * delta), physicsSteps: steps, fixedDeltaSeconds: delta, collisionDetected: profile.collision.enabled });
}

export function simulateBasis() {
  const samples = [0, 90, -90, 180].map((yawDegrees) => {
    const basis = cameraHorizontalBasis(yawDegrees);
    return rounded({ yawDegrees, forward: basis.forward, right: basis.right, orthogonalityDot: vectorDot(basis.forward, basis.right), forwardMagnitude: vectorMagnitude(basis.forward), rightMagnitude: vectorMagnitude(basis.right) });
  });
  return { yawRange: "[-180, 180)", samples };
}

function defaultDuration(profile: CameraProfile, scenario: CameraScenario): number {
  if (scenario === "pitch-clamp") return Math.max(profile.orbit.maximumPitchDegrees - profile.orbit.initialPitchDegrees, profile.orbit.initialPitchDegrees - profile.orbit.minimumPitchDegrees) / profile.orbit.pitchSpeedDegreesPerSecond + CAMERA_FIXED_DELTA_SECONDS;
  if (scenario === "recenter") return profile.recenter.delaySeconds + 120 / profile.recenter.yawSpeedDegreesPerSecond + 0.5;
  return scenario === "basis" ? 0 : 2;
}
function stepCount(seconds: number, delta: number): number { return Math.max(0, Math.ceil(seconds / delta - EPSILON)); }
function add(left: CameraVector3, right: CameraVector3): CameraVector3 { return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z }; }
function rounded<T>(value: T): T { return deepMap(value) as T; }
function deepMap(value: unknown): unknown {
  if (typeof value === "number") return roundMetric(value);
  if (Array.isArray(value)) return value.map(deepMap);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepMap(item)]));
  return value;
}
