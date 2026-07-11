import assert from "node:assert/strict";
import test from "node:test";

import { simulateMovement } from "../src/domain/movement/movementSimulation";
import { defaultProfile } from "./testUtils";

test("identical simulations are byte-for-byte deterministic", async () => {
  const profile = await defaultProfile();
  const first = simulateMovement(profile, "accelerate", 2);
  const second = simulateMovement(profile, "accelerate", 2);
  assert.deepEqual(first, second);
});

test("acceleration reaches run speed without exceeding it", async () => {
  const profile = await defaultProfile();
  const result = simulateMovement(profile, "accelerate", 2);
  assert.equal(result.metrics.finalSpeed, profile.ground.runSpeed);
  assert.equal(result.metrics.maximumObservedSpeed, profile.ground.runSpeed);
  assert.equal(typeof result.metrics.timeToNinetyFivePercentSeconds, "number");
});

test("stopping reaches zero deterministically", async () => {
  const profile = await defaultProfile();
  const result = simulateMovement(profile, "stop");
  assert.equal(result.metrics.finalSpeed, 0);
  assert.equal(typeof result.metrics.stoppingTimeSeconds, "number");
  assert((result.metrics.stoppingDistance as number) > 0);
});

test("sprint consumes stamina deterministically", async () => {
  const profile = await defaultProfile();
  const result = simulateMovement(profile, "sprint", 2);
  assert.equal(result.metrics.staminaConsumed, 24);
  assert.equal(result.metrics.finalStamina, 76);
  assert((result.metrics.totalDistance as number) > profile.ground.runSpeed * 2);
});

test("dodge distance and timing match the profile", async () => {
  const profile = await defaultProfile();
  const result = simulateMovement(profile, "dodge");
  assert.equal(result.metrics.configuredDistance, profile.dodge.distance);
  assert.equal(result.metrics.simulatedDistance, profile.dodge.distance);
  assert.equal(result.metrics.durationSeconds, profile.dodge.durationSeconds);
  assert.equal(result.metrics.invulnerabilityDurationSeconds, 0.24);
  assert.equal(result.metrics.staminaConsumed, profile.dodge.staminaCost);
});
