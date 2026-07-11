import assert from "node:assert/strict";
import test from "node:test";

import { validateMovementDefinition } from "../src/domain/movement/movementValidation";
import type { MovementProfile } from "../src/domain/movement/movementTypes";
import { ErrorCodes } from "../src/shared/errorCodes";
import { defaultProfile } from "./testUtils";

async function invalidProfile(change: (profile: MovementProfile) => void) {
  const profile = await defaultProfile();
  change(profile);
  return validateMovementDefinition(profile);
}

test("walk, run, and sprint speeds must remain ordered", async () => {
  const result = await invalidProfile((profile) => { profile.ground.sprintSpeed = 4; });
  assert.equal(result.errors[0]?.code, ErrorCodes.MovementSpeedOrderInvalid);
  assert.equal(result.errors[0]?.path, "ground.sprintSpeed");
});

test("acceleration must be positive", async () => {
  const result = await invalidProfile((profile) => { profile.ground.acceleration = 0; });
  assert.equal(result.errors[0]?.code, ErrorCodes.MovementAccelerationInvalid);
});

test("sprint threshold cannot exceed maximum stamina", async () => {
  const result = await invalidProfile((profile) => { profile.stamina.minimumToStartSprint = 101; });
  assert.equal(result.errors[0]?.code, ErrorCodes.MovementStaminaInvalid);
});

test("dodge duration must be positive", async () => {
  const result = await invalidProfile((profile) => { profile.dodge.durationSeconds = 0; });
  assert(result.errors.some((error) => error.code === ErrorCodes.MovementDodgeInvalid));
});

test("dodge invulnerability must fit inside the dodge", async () => {
  const result = await invalidProfile((profile) => { profile.dodge.invulnerabilityEndSeconds = 0.7; });
  assert(result.errors.some((error) => error.code === ErrorCodes.MovementDodgeIframeWindowInvalid));
});

test("dodge stamina cost cannot exceed maximum stamina", async () => {
  const result = await invalidProfile((profile) => { profile.dodge.staminaCost = 101; });
  assert(result.errors.some((error) => error.code === ErrorCodes.MovementDodgeInvalid));
});
