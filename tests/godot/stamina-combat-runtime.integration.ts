import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compareStaminaCombatRuntime } from "../../src/application/runtime/compareStaminaCombatRuntime";
import { runStaminaCombatFixture } from "../../src/application/runtime/runStaminaCombatFixture";
import { executeCli } from "../../src/cli/main";
import type { HealthProfile } from "../../src/domain/health/healthTypes";
import type { OffensiveActionProfile } from "../../src/domain/offensiveAction/offensiveActionTypes";
import type { StaminaProfile } from "../../src/domain/stamina/staminaTypes";
import { discoverGodot } from "../../src/infrastructure/runtime/godotDiscovery";
import { projectRoot } from "../testUtils";

const availability = discoverGodot().then(() => null, (error: Error) => error.message);

test("real Godot accepted stamina combat matches TypeScript through the CLI", async (context) => {
  const reason = await availability; if (reason) { context.skip(`Godot unavailable: ${reason}`); return; }
  const result = await executeCli(["combat", "stamina-runtime-test", "examples/stamina/default.json", "examples/health/default.json", "examples/offensive-action/default.json", "--scenario", "accepted", "--json"], projectRoot());
  assert.equal(result.result.status, "passed", JSON.stringify(result.result));
  assert.deepEqual(result.result.changedFiles, []);
  assert.equal((result.result.data as any).runtime.fixtureId, "combat/stamina-gated-exchange");
  assert.equal((result.result.data as any).runtime.metrics.hitAccepted, true);
  assert.equal((result.result.data as any).comparison.passed, true);
});

test("real Godot insufficient stamina rejects before combat and matches TypeScript", async (context) => {
  const reason = await availability; if (reason) { context.skip(`Godot unavailable: ${reason}`); return; }
  const root = projectRoot();
  const stamina = JSON.parse(await readFile(path.join(root, "examples", "stamina", "default.json"), "utf8")) as StaminaProfile;
  const health = JSON.parse(await readFile(path.join(root, "examples", "health", "default.json"), "utf8")) as HealthProfile;
  const action = JSON.parse(await readFile(path.join(root, "examples", "offensive-action", "default.json"), "utf8")) as OffensiveActionProfile;
  const run = await runStaminaCombatFixture(root, { ...stamina, startingStamina: 5 }, health, action, "insufficient-stamina");
  assert.equal(run.response.metrics.actionAccepted, false);
  assert.equal(run.response.metrics.consumedStamina, 0);
  assert.equal(run.response.metrics.hitAccepted, false);
  assert.equal(run.response.metrics.appliedDamage, 0);
  assert.equal(run.response.metrics.remainingHealth, health.startingHealth);
  assert.equal(compareStaminaCombatRuntime(run.simulation, run.response.metrics).passed, true);
});
