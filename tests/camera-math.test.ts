import assert from "node:assert/strict";
import test from "node:test";

import { cameraHorizontalBasis, clampPitchDegrees, normalizeYawDegrees, shortestAngleDifferenceDegrees, smoothHalfLifeScalar, smoothHalfLifeVector, vectorDot, vectorMagnitude } from "../src/domain/camera/cameraMath";

test("yaw normalization uses [-180, 180)", () => { assert.equal(normalizeYawDegrees(180), -180); assert.equal(normalizeYawDegrees(540), -180); assert.equal(normalizeYawDegrees(-181), 179); });
test("shortest angular difference crosses wrap correctly", () => { assert.equal(shortestAngleDifferenceDegrees(170, -170), 20); assert.equal(shortestAngleDifferenceDegrees(-170, 170), -20); });
test("pitch clamp respects configured limits", () => { assert.equal(clampPitchDegrees(90, -35, 60), 60); assert.equal(clampPitchDegrees(-90, -35, 60), -35); });
test("half-life scalar and vector halve remaining error", () => {
  assert.equal(smoothHalfLifeScalar(0, 10, 1, 1), 5);
  assert.deepEqual(smoothHalfLifeVector({ x: 0, y: 0, z: 0 }, { x: 10, y: -4, z: 2 }, 1, 1), { x: 5, y: -2, z: 1 });
});
test("half-life is equivalent across fixed deltas", () => {
  let sixty = 0; for (let i = 0; i < 60; i += 1) sixty = smoothHalfLifeScalar(sixty, 10, 1 / 60, 0.25);
  let thirty = 0; for (let i = 0; i < 30; i += 1) thirty = smoothHalfLifeScalar(thirty, 10, 1 / 30, 0.25);
  assert(Math.abs(sixty - thirty) < 1e-12);
});
test("zero half-life snaps to target", () => { assert.equal(smoothHalfLifeScalar(1, 9, 0.01, 0), 9); });
test("canonical basis follows movement convention", () => {
  const zero = cameraHorizontalBasis(0); assert(Math.abs(zero.forward.x) < 1e-12); assert.equal(zero.forward.z, -1);
  const ninety = cameraHorizontalBasis(90); assert.equal(ninety.forward.x, -1); assert(Math.abs(ninety.forward.z) < 1e-12);
  const negative = cameraHorizontalBasis(-90); assert.equal(negative.forward.x, 1);
  const reverse = cameraHorizontalBasis(180); assert(Math.abs(reverse.forward.z - 1) < 1e-12);
});
test("basis vectors are normalized and orthogonal", () => { for (const yaw of [0, 90, -90, 180, 37]) { const basis = cameraHorizontalBasis(yaw); assert(Math.abs(vectorMagnitude(basis.forward) - 1) < 1e-12); assert(Math.abs(vectorMagnitude(basis.right) - 1) < 1e-12); assert(Math.abs(vectorDot(basis.forward, basis.right)) < 1e-12); } });
