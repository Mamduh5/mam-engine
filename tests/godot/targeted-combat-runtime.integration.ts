import assert from "node:assert/strict";
import test from "node:test";

import { executeCli } from "../../src/cli/main";
import { discoverGodot } from "../../src/infrastructure/runtime/godotDiscovery";
import { projectRoot } from "../testUtils";

const availability = discoverGodot().then(() => null, (error: Error) => error.message);
const files = ["examples/targeting/default.json", "examples/stamina/default.json", "examples/health/default.json", "examples/offensive-action/default.json"];

async function runScenario(scenario: "target-available" | "no-valid-target") {
  return executeCli(["combat", "targeted-runtime-test", ...files, "--scenario", scenario, "--json"], projectRoot());
}

test("real Godot targeted combat acquires and matches TypeScript", async (context) => {
  const reason = await availability; if (reason) { context.skip(`Godot unavailable: ${reason}`); return; }
  const result = await runScenario("target-available"); const data = result.result.data as any;
  assert.equal(result.result.status, "passed", JSON.stringify(result.result)); assert.deepEqual(result.result.changedFiles, []);
  assert.equal(data.runtime.fixtureId, "combat/targeted-stamina-exchange"); assert.equal(data.runtime.metrics.targetAcquired, true); assert.equal(data.runtime.metrics.hitAccepted, true); assert.equal(data.comparison.passed, true);
});

test("real Godot no-target scenario rejects before stamina and matches TypeScript", async (context) => {
  const reason = await availability; if (reason) { context.skip(`Godot unavailable: ${reason}`); return; }
  const result = await runScenario("no-valid-target"); const data = result.result.data as any;
  assert.equal(result.result.status, "passed", JSON.stringify(result.result)); assert.deepEqual(result.result.changedFiles, []);
  assert.equal(data.runtime.metrics.targetAcquired, false); assert.equal(data.runtime.metrics.actionAccepted, false); assert.equal(data.runtime.metrics.consumedStamina, 0); assert.equal(data.runtime.metrics.appliedDamage, 0); assert.equal(data.comparison.passed, true);
});
