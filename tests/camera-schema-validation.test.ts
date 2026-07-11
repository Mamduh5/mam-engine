import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import test from "node:test";

import { validateCameraFile } from "../src/application/camera/validateCamera";
import { validateCameraDefinition } from "../src/domain/camera/cameraValidation";
import type { CameraProfile } from "../src/domain/camera/cameraTypes";
import { ErrorCodes } from "../src/shared/errorCodes";
import { createCameraTestWorkspace, defaultCameraProfile } from "./testUtils";

async function changed(mutator: (profile: CameraProfile) => void): Promise<CameraProfile> { const profile = await defaultCameraProfile(); mutator(profile); return profile; }

test("default camera profile satisfies schema and semantics", async () => { const result = validateCameraDefinition(await defaultCameraProfile()); assert.equal(result.valid, true); assert.equal(result.profile?.kind, "camera-profile"); });
test("camera schema rejects missing required fields", async () => { const value = await defaultCameraProfile() as unknown as Record<string, unknown>; delete value.follow; assert.equal(validateCameraDefinition(value).errors[0]?.code, ErrorCodes.CameraSchemaInvalid); });
test("camera schema rejects unknown root and nested properties", async () => {
  const root = await defaultCameraProfile() as unknown as Record<string, unknown>; root.extra = true; assert.equal(validateCameraDefinition(root).valid, false);
  const nested = await defaultCameraProfile() as unknown as { orbit: Record<string, unknown> }; nested.orbit.extra = true; assert.equal(validateCameraDefinition(nested).valid, false);
});
test("camera schema rejects unsupported version and wrong kind", async () => {
  assert.equal(validateCameraDefinition(await changed((p) => { (p as unknown as { schemaVersion: number }).schemaVersion = 2; })).errors[0]?.code, ErrorCodes.CameraSchemaVersionUnsupported);
  assert.equal(validateCameraDefinition(await changed((p) => { (p as unknown as { kind: string }).kind = "movement-profile"; })).errors[0]?.code, ErrorCodes.CameraSchemaInvalid);
});
test("camera file reports malformed JSON", async (context) => { const workspace = await createCameraTestWorkspace(context); await writeFile(workspace.cameraFile, "{bad", "utf8"); const result = await validateCameraFile(workspace.root, workspace.relativeFile); assert.equal(result.errors[0]?.code, ErrorCodes.CameraJsonInvalid); });
test("camera schema rejects non-finite direct numeric input", async () => { const profile = await changed((p) => { p.follow.distance = Number.POSITIVE_INFINITY; }); assert.equal(validateCameraDefinition(profile).valid, false); });
test("camera validation rejects invalid pitch range and initial pitch bounds", async () => {
  assert.equal(validateCameraDefinition(await changed((p) => { p.orbit.minimumPitchDegrees = 70; })).errors.some((e) => e.code === ErrorCodes.CameraPitchRangeInvalid), true);
  assert.equal(validateCameraDefinition(await changed((p) => { p.orbit.initialPitchDegrees = -40; })).valid, false);
  assert.equal(validateCameraDefinition(await changed((p) => { p.orbit.initialPitchDegrees = 70; })).valid, false);
});
test("camera validation rejects orbit, follow, and half-life violations", async () => {
  assert.equal(validateCameraDefinition(await changed((p) => { p.orbit.yawSpeedDegreesPerSecond = 0; })).errors[0]?.code, ErrorCodes.CameraOrbitInvalid);
  assert.equal(validateCameraDefinition(await changed((p) => { p.follow.distance = 0; })).errors[0]?.code, ErrorCodes.CameraFollowInvalid);
  assert.equal(validateCameraDefinition(await changed((p) => { p.follow.positionHalfLifeSeconds = -1; })).errors[0]?.code, ErrorCodes.CameraFollowInvalid);
});
test("camera validation rejects recenter and collision violations", async () => {
  assert.equal(validateCameraDefinition(await changed((p) => { p.recenter.movementInputThreshold = 1.1; })).errors[0]?.code, ErrorCodes.CameraRecenterInvalid);
  assert.equal(validateCameraDefinition(await changed((p) => { p.collision.minimumDistance = 7; })).errors[0]?.code, ErrorCodes.CameraCollisionInvalid);
});
test("camera validation rejects lens violations", async () => {
  assert.equal(validateCameraDefinition(await changed((p) => { p.lens.fieldOfViewDegrees = 10; })).errors[0]?.code, ErrorCodes.CameraLensInvalid);
  assert.equal(validateCameraDefinition(await changed((p) => { p.lens.farClipDistance = p.lens.nearClipDistance; })).errors[0]?.code, ErrorCodes.CameraLensInvalid);
});
test("camera validation normalizes initial yaw to canonical range", async () => { const result = validateCameraDefinition(await changed((p) => { p.orbit.initialYawDegrees = 540; })); assert.equal(result.profile?.orbit.initialYawDegrees, -180); });
