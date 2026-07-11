import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import test from "node:test";

import { validateMovementFile } from "../src/application/movement/validateMovement";
import { validateMovementDefinition } from "../src/domain/movement/movementValidation";
import { ErrorCodes } from "../src/shared/errorCodes";
import { createTestWorkspace, defaultProfile } from "./testUtils";

test("default movement profile satisfies schema v1", async () => {
  const result = validateMovementDefinition(await defaultProfile());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("malformed JSON returns a stable parsing error", async (context) => {
  const workspace = await createTestWorkspace(context);
  await writeFile(workspace.movementFile, "{not-json", "utf8");
  const result = await validateMovementFile(workspace.root, workspace.relativeFile);
  assert.equal(result.status, "failed");
  assert.equal(result.errors[0]?.code, ErrorCodes.MovementJsonInvalid);
});

test("missing required fields are normalized to schema errors", async () => {
  const profile = await defaultProfile() as unknown as Record<string, unknown>;
  delete profile.ground;
  const result = validateMovementDefinition(profile);
  assert.equal(result.valid, false);
  assert.equal(result.errors[0]?.code, ErrorCodes.MovementSchemaInvalid);
  assert.equal(result.errors[0]?.path, "ground");
});

test("missing schemaVersion is a schema error, not an unsupported version", async () => {
  const profile = await defaultProfile() as unknown as Record<string, unknown>;
  delete profile.schemaVersion;
  const result = validateMovementDefinition(profile);
  assert.equal(result.valid, false);
  assert.equal(result.errors[0]?.code, ErrorCodes.MovementSchemaInvalid);
  assert.equal(result.errors[0]?.path, "schemaVersion");
});

test("unknown properties are rejected", async () => {
  const profile = await defaultProfile() as unknown as Record<string, unknown>;
  profile.unplanned = true;
  const result = validateMovementDefinition(profile);
  assert.equal(result.valid, false);
  assert.equal(result.errors[0]?.code, ErrorCodes.MovementSchemaInvalid);
  assert.equal(result.errors[0]?.path, "unplanned");
});

test("unsupported schema versions have a dedicated error", async () => {
  const profile = await defaultProfile() as unknown as Record<string, unknown>;
  profile.schemaVersion = 2;
  const result = validateMovementDefinition(profile);
  assert.equal(result.valid, false);
  assert.equal(result.errors[0]?.code, ErrorCodes.MovementSchemaVersionUnsupported);
});
