import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compareStaminaRuntime } from "../../src/application/runtime/compareStaminaRuntime";
import { runStaminaFixture } from "../../src/application/runtime/runStaminaFixture";
import { runStaminaRuntimeTest } from "../../src/application/runtime/runStaminaRuntimeTest";
import type { DefensiveActionProfile } from "../../src/domain/defensiveAction/defensiveActionTypes";
import type { StaminaProfile } from "../../src/domain/stamina/staminaTypes";
import { discoverGodot } from "../../src/infrastructure/runtime/godotDiscovery";
import { projectRoot } from "../testUtils";

const availability = discoverGodot().then(() => null, (error: Error) => error.message);

test("real Godot accepts the default offensive action and matches TypeScript stamina", async (context) => {
  const reason = await availability; if (reason) { context.skip(`Godot unavailable: ${reason}`); return; }
  const result = await runStaminaRuntimeTest(projectRoot(), "examples/stamina/default.json", "examples/offensive-action/default.json");
  assert.equal(result.status, "passed", JSON.stringify(result));
  assert.deepEqual(result.changedFiles, []);
  assert.equal((result.data as any).runtime.fixtureId, "stamina/basic-action-cost");
  assert.equal((result.data as any).runtime.metrics.actionAccepted, true);
  assert.equal((result.data as any).comparison.passed, true);
});

test("real Godot rejects an unaffordable defensive action without consuming stamina", async (context) => {
  const reason = await availability; if (reason) { context.skip(`Godot unavailable: ${reason}`); return; }
  const root = projectRoot();
  const stamina = JSON.parse(await readFile(path.join(root, "examples", "stamina", "default.json"), "utf8")) as StaminaProfile;
  const action = JSON.parse(await readFile(path.join(root, "examples", "defensive-action", "default.json"), "utf8")) as DefensiveActionProfile;
  const run = await runStaminaFixture(root, { ...stamina, startingStamina: 10 }, action);
  assert.equal(run.response.metrics.actionAccepted, false);
  assert.equal(run.response.metrics.consumedStamina, 0);
  assert.equal(compareStaminaRuntime(run.simulation, run.response.metrics).passed, true);
});
