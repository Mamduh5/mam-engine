import assert from "node:assert/strict";
import test from "node:test";

import { runCombatRuntimeTest } from "../../src/application/runtime/runCombatRuntimeTest";
import { discoverGodot } from "../../src/infrastructure/runtime/godotDiscovery";
import { projectRoot } from "../testUtils";

const availability = discoverGodot().then(() => null, (error: Error) => error.message);

test("real Godot default combat exchange matches the TypeScript orchestration", async (context) => {
  const reason = await availability; if (reason) { context.skip(`Godot unavailable: ${reason}`); return; }
  const result = await runCombatRuntimeTest(projectRoot(), "examples/health/default.json", "examples/offensive-action/default.json");
  assert.equal(result.status, "passed", JSON.stringify(result));
  assert.deepEqual(result.changedFiles, []);
  assert.equal((result.data as any).runtime.fixtureId, "combat/basic-exchange");
  assert.equal((result.data as any).runtime.scenarioId, "default");
  assert.equal((result.data as any).comparison.passed, true);
});
