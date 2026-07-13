import assert from "node:assert/strict";
import test from "node:test";

import { executeCli } from "../../src/cli/main";
import type { DamageReactionRuntimeScenario } from "../../src/domain/runtime/runtimeProtocol";
import { discoverGodot } from "../../src/infrastructure/runtime/godotDiscovery";
import { projectRoot } from "../testUtils";

const availability = discoverGodot().then(() => null, (error: Error) => error.message);
const action = "examples/offensive-action/default.json";

test("real Godot damage reactions match TypeScript for hit, stagger, and defeat interruption", async (context) => {
  const reason = await availability; if (reason) { context.skip(`Godot unavailable: ${reason}`); return; }
  const scenarios: Array<{ id: DamageReactionRuntimeScenario; reaction: string; health: string; reactionType: string; interrupted: boolean; finalAction: string; steps: number }> = [
    { id: "hit-continues", reaction: "examples/damage-reaction/default.json", health: "examples/health/default.json", reactionType: "hit", interrupted: false, finalAction: "continuing", steps: 2 },
    { id: "stagger-interrupts", reaction: "examples/damage-reaction/stagger.json", health: "examples/health/default.json", reactionType: "stagger", interrupted: true, finalAction: "interrupted", steps: 6 },
    { id: "defeat-interrupts", reaction: "examples/damage-reaction/default.json", health: "examples/health/defeat.json", reactionType: "defeat", interrupted: true, finalAction: "interrupted", steps: 0 }
  ];
  for (const scenario of scenarios) {
    const execution = await executeCli(["damage-reaction", "runtime-test", scenario.reaction, scenario.health, action, "--scenario", scenario.id, "--fixed-delta", "0.1", "--json"], projectRoot()); const data = execution.result.data as any;
    assert.equal(execution.result.status, "passed", JSON.stringify(execution.result)); assert.deepEqual(execution.result.changedFiles, []);
    assert.equal(data.runtime.fixtureId, "damage-reaction/basic-resolution"); assert.equal(data.runtime.evidence.fixtureScene, "res://scenes/damage_reaction_fixture.tscn");
    assert.equal(data.runtime.metrics.reactionType, scenario.reactionType); assert.equal(data.runtime.metrics.targetActionWasActive, true); assert.equal(data.runtime.metrics.targetActionInterrupted, scenario.interrupted); assert.equal(data.runtime.metrics.finalTargetActionState, scenario.finalAction); assert.equal(data.runtime.metrics.reactionTotalSteps, scenario.steps); assert.equal(data.comparison.passed, true);
  }
});
