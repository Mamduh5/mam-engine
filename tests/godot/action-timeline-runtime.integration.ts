import assert from "node:assert/strict";
import test from "node:test";

import { executeCli } from "../../src/cli/main";
import { discoverGodot } from "../../src/infrastructure/runtime/godotDiscovery";
import { projectRoot } from "../testUtils";

const availability = discoverGodot().then(() => null, (error: Error) => error.message);

test("real Godot AnimationPlayer timeline events match the TypeScript simulation", async (context) => {
  const reason = await availability; if (reason) { context.skip(`Godot unavailable: ${reason}`); return; }
  const execution = await executeCli(["action-timeline", "runtime-test", "examples/action-timeline/default.json", "--fixed-delta", "0.1", "--json"], projectRoot()); const data = execution.result.data as any;
  assert.equal(execution.result.status, "passed", JSON.stringify(execution.result)); assert.deepEqual(execution.result.changedFiles, []);
  assert.equal(data.runtime.fixtureId, "action-timeline/basic-animation-events"); assert.equal(data.runtime.evidence.fixtureScene, "res://scenes/action_timeline_fixture.tscn");
  assert.equal(data.runtime.metrics.emittedEventCount, 3); assert.deepEqual(data.runtime.metrics.emittedEvents.map((event: any) => event.id), ["begin", "commit", "finish"]); assert.equal(data.comparison.passed, true);
});
