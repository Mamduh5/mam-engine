import type { CameraVector3 } from "./cameraTypes";

export function normalizeYawDegrees(value: number): number {
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function shortestAngleDifferenceDegrees(current: number, target: number): number {
  return normalizeYawDegrees(target - current);
}

export function clampPitchDegrees(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function halfLifeRemainingFraction(deltaSeconds: number, halfLifeSeconds: number): number {
  return halfLifeSeconds === 0 ? 0 : 2 ** (-deltaSeconds / halfLifeSeconds);
}

export function smoothHalfLifeScalar(current: number, target: number, deltaSeconds: number, halfLifeSeconds: number): number {
  return target + (current - target) * halfLifeRemainingFraction(deltaSeconds, halfLifeSeconds);
}

export function smoothHalfLifeVector(current: CameraVector3, target: CameraVector3, deltaSeconds: number, halfLifeSeconds: number): CameraVector3 {
  return {
    x: smoothHalfLifeScalar(current.x, target.x, deltaSeconds, halfLifeSeconds),
    y: smoothHalfLifeScalar(current.y, target.y, deltaSeconds, halfLifeSeconds),
    z: smoothHalfLifeScalar(current.z, target.z, deltaSeconds, halfLifeSeconds)
  };
}

export function cameraHorizontalBasis(yawDegrees: number): { forward: CameraVector3; right: CameraVector3 } {
  const radians = yawDegrees * Math.PI / 180;
  return {
    forward: { x: -Math.sin(radians), y: 0, z: -Math.cos(radians) },
    right: { x: Math.cos(radians), y: 0, z: -Math.sin(radians) }
  };
}

export function vectorMagnitude(value: CameraVector3): number { return Math.hypot(value.x, value.y, value.z); }
export function vectorDistance(left: CameraVector3, right: CameraVector3): number {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}
export function vectorDot(left: CameraVector3, right: CameraVector3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}
