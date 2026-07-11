import assert from "node:assert/strict";
import test from "node:test";

import { inspectCamera } from "../src/application/camera/inspectCamera";
import { simulateBasis, simulateCamera, simulateCollision, simulateFollow, simulateOrbit, simulatePitchClamp, simulateRecenter } from "../src/domain/camera/cameraSimulation";
import { createCameraTestWorkspace, defaultCameraProfile } from "./testUtils";

test("camera simulation is exactly deterministic", async () => { const profile = await defaultCameraProfile(); assert.deepEqual(simulateCamera(profile, "orbit"), simulateCamera(profile, "orbit")); assert.deepEqual(simulateCamera(profile, "follow"), simulateCamera(profile, "follow")); });
test("orbit honors yaw and pitch inversion", async () => {
  const profile = await defaultCameraProfile(); const normal = simulateOrbit(profile, 0.5, 1 / 60);
  const inverted = structuredClone(profile); inverted.orbit.invertYaw = true; inverted.orbit.invertPitch = true; const reversed = simulateOrbit(inverted, 0.5, 1 / 60);
  assert.equal(Math.sign(normal.totalYawTravelDegrees as number), -Math.sign(reversed.totalYawTravelDegrees as number));
  assert.equal(Math.sign(normal.totalPitchTravelDegrees as number), -Math.sign(reversed.totalPitchTravelDegrees as number));
});
test("pitch simulation reaches but never exceeds both bounds", async () => { const profile = await defaultCameraProfile(); const result = simulatePitchClamp(profile, 1, 1 / 60); assert.equal(result.minimumObservedPitchDegrees, profile.orbit.minimumPitchDegrees); assert.equal(result.maximumObservedPitchDegrees, profile.orbit.maximumPitchDegrees); assert.equal(result.positiveClampReached, true); assert.equal(result.negativeClampReached, true); });
test("recenter waits for delay and uses bounded shortest-angle speed", async () => { const profile = await defaultCameraProfile(); const result = simulateRecenter(profile, 3, 1 / 60); assert((result.recenterStartSeconds as number) >= profile.recenter.delaySeconds); assert.equal(result.maximumAngularSpeedDegreesPerSecond, profile.recenter.yawSpeedDegreesPerSecond); assert((result.finalYawErrorDegrees as number) <= 0.25); });
test("manual yaw input cancels recenter", async () => { const result = simulateRecenter(await defaultCameraProfile(), 3, 1 / 60, { manualYawInput: 0.5 }); assert.equal(result.recenterStartSeconds, null); assert.equal(result.maximumAngularSpeedDegreesPerSecond, 0); });
test("disabled and below-threshold recenter never modifies yaw", async () => {
  const disabled = await defaultCameraProfile(); disabled.recenter.enabled = false; assert.equal(simulateRecenter(disabled, 3, 1 / 60).finalYawErrorDegrees, 120);
  const profile = await defaultCameraProfile(); assert.equal(simulateRecenter(profile, 3, 1 / 60, { movementInputMagnitude: 0.1 }).finalYawErrorDegrees, 120);
});
test("follow moves for the first half, then settles with frame-rate-independent half-life smoothing", async () => {
  const profile = await defaultCameraProfile();
  const result = simulateFollow(profile, 2, 1 / 60);
  const resultAtDoubleRate = simulateFollow(profile, 2, 1 / 120);
  const finalTarget = result.finalTargetPosition as { x: number; y: number; z: number };
  const finalTargetAtDoubleRate = resultAtDoubleRate.finalTargetPosition as { x: number; y: number; z: number };

  assert.deepEqual(finalTarget, { x: 1, y: 0, z: 0 });
  assert.deepEqual(finalTargetAtDoubleRate, finalTarget);
  assert.equal(result.initialFollowError, 0);
  assert((result.maximumFollowError as number) > (result.initialFollowError as number));
  assert((result.finalFollowError as number) < (result.maximumFollowError as number));
  assert((result.finalFollowError as number) < 0.001);
  assert(Math.abs((result.finalFollowError as number) - (resultAtDoubleRate.finalFollowError as number)) < 0.0001);
});
test("collision compresses safely and recovers", async () => { const profile = await defaultCameraProfile(); const result = simulateCollision(profile, 2, 1 / 60); assert((result.compressedDistance as number) <= 2.5 - profile.collision.probeRadius); assert((result.minimumObservedDistance as number) >= profile.collision.minimumDistance); assert((result.finalRecoveredDistance as number) > (result.compressedDistance as number)); });
test("disabled collision ignores scalar obstruction", async () => { const profile = await defaultCameraProfile(); profile.collision.enabled = false; const result = simulateCollision(profile, 2, 1 / 60); assert.equal(result.minimumObservedDistance, profile.follow.distance); assert.equal(result.finalRecoveredDistance, profile.follow.distance); });
test("basis scenario reports four normalized orthogonal samples", () => { const result = simulateBasis(); assert.equal(result.samples.length, 4); for (const sample of result.samples) { assert.equal(sample.forwardMagnitude, 1); assert.equal(sample.rightMagnitude, 1); assert(Math.abs(sample.orthogonalityDot as number) < 1e-9); } });
test("camera inspection returns normalized profile, derived metrics, and zero changes", async (context) => { const workspace = await createCameraTestWorkspace(context); const result = await inspectCamera(workspace.root, workspace.relativeFile); assert.equal(result.status, "passed"); assert.deepEqual(result.changedFiles, []); const data = result.data as { profile: { kind: string }; derivedMetrics: Record<string, unknown> }; assert.equal(data.profile.kind, "camera-profile"); for (const key of ["pitchRangeDegrees", "initialPitchWithinRange", "orbitYawSecondsForFullRotation", "orbitPitchSecondsAcrossConfiguredRange", "recenterSecondsFor180Degrees", "nominalCameraHeight", "minimumCollisionCompressionRatio", "fieldOfViewRadians", "nearFarRatio"]) assert(Object.hasOwn(data.derivedMetrics, key)); });
