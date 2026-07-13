import assert from "node:assert/strict";
import test from "node:test";

import { executeCli } from "../../src/cli/main";
import type { ContactVolumeRuntimeScenario } from "../../src/domain/runtime/runtimeProtocol";
import { discoverGodot } from "../../src/infrastructure/runtime/godotDiscovery";
import { projectRoot } from "../testUtils";

const availability = discoverGodot().then(() => null, (error: Error) => error.message);
const hitbox = "examples/contact-volume/default-hitbox.json";

test("real Godot Area3D contact matches TypeScript for active overlap and window miss", async (context) => {
  const reason = await availability; if (reason) { context.skip(`Godot unavailable: ${reason}`); return; }
  const scenarios: Array<{ id: ContactVolumeRuntimeScenario; hurtbox: string; contact: boolean; count: number }> = [
    { id: "overlapping-active", hurtbox: "examples/contact-volume/default-hurtbox.json", contact: true, count: 3 },
    { id: "window-miss", hurtbox: "examples/contact-volume/window-miss-hurtbox.json", contact: false, count: 0 }
  ];
  for (const scenario of scenarios) {
    const execution = await executeCli(["contact-volume", "runtime-test", hitbox, scenario.hurtbox, "--scenario", scenario.id, "--fixed-delta", "0.1", "--json"], projectRoot()); const data = execution.result.data as any;
    assert.equal(execution.result.status, "passed", JSON.stringify(execution.result)); assert.deepEqual(execution.result.changedFiles, []);
    assert.equal(data.runtime.fixtureId, "contact-volume/basic-sphere-overlap"); assert.equal(data.runtime.evidence.fixtureScene, "res://scenes/contact_volume_fixture.tscn");
    assert.equal(data.runtime.metrics.spatialOverlap, true); assert.equal(data.runtime.metrics.contactOccurred, scenario.contact); assert.equal(data.runtime.metrics.contactStepCount, scenario.count); assert.equal(data.comparison.passed, true);
  }
});
