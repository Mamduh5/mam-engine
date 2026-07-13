import assert from "node:assert/strict";
import test from "node:test";

import { executeCli } from "../../src/cli/main";
import type { LargeEnemyScenario } from "../../src/domain/largeEnemy/largeEnemyTypes";
import { discoverGodot } from "../../src/infrastructure/runtime/godotDiscovery";
import { projectRoot } from "../testUtils";

const availability = discoverGodot().then(() => null, (error: Error) => error.message);

test("real Godot training behemoth matches TypeScript for authored and disabled-primary targeting", async (context) => {
  const reason = await availability; if (reason) { context.skip(`Godot unavailable: ${reason}`); return; }
  const scenarios: Array<{ id: LargeEnemyScenario; targetable: string[]; selected: string }> = [
    { id: "full-cycle", targetable: ["head", "core"], selected: "head" },
    { id: "primary-part-disabled", targetable: ["core"], selected: "core" }
  ];
  for (const scenario of scenarios) {
    const execution = await executeCli(["large-enemy", "runtime-test", "examples/large-enemy/training-behemoth.json", "--scenario", scenario.id, "--fixed-delta", "0.1", "--json"], projectRoot()); const data = execution.result.data as any; const metrics = data?.runtime?.metrics;
    assert.equal(execution.result.status, "passed", JSON.stringify(execution.result)); assert.deepEqual(execution.result.changedFiles, []); assert.equal(data.runtime.fixtureId, "large-enemy/training-behemoth"); assert.equal(data.runtime.evidence.fixtureScene, "res://scenes/large_enemy_fixture.tscn"); assert.equal(data.comparison.passed, true);
    assert.equal(metrics.enemyId, "training-behemoth"); assert.deepEqual(metrics.resolvedDefinitionPaths, { healthFile: "examples/health/default.json", reactionFile: "examples/damage-reaction/default.json", bodyParts: [{ id: "head", hurtboxFile: "examples/contact-volume/default-hurtbox.json" }, { id: "core", hurtboxFile: "examples/contact-volume/window-miss-hurtbox.json" }] });
    assert.deepEqual(metrics.bodyPartIds, ["head", "core"]); assert.deepEqual(metrics.targetableBodyPartIds, scenario.targetable); assert.equal(metrics.selectedBodyPartId, scenario.selected); assert.equal(metrics.bodyPartNodeCount, 2); assert.equal(metrics.targetPointMarkerCount, 2); assert.equal(metrics.hurtboxAreaCount, 2);
    assert.deepEqual(metrics.stateTransitions, [{ state: "idle", step: 1 }, { state: "telegraph", step: 5 }, { state: "attack", step: 8 }, { state: "recovery", step: 12 }, { state: "complete", step: 17 }]); assert.equal(metrics.finalBehaviorState, "complete");
    assert.deepEqual(metrics.runtimeBodyParts.map((part: any) => ({ id: part.id, targetPoint: part.targetPoint, hurtboxCenter: part.hurtboxCenter, hurtboxRadius: part.hurtboxRadius })), [
      { id: "head", targetPoint: { x: 0, y: 2, z: 0 }, hurtboxCenter: { x: 1.5, y: 0, z: 0 }, hurtboxRadius: 0.75 },
      { id: "core", targetPoint: { x: 0, y: 1, z: 0 }, hurtboxCenter: { x: 1.5, y: 0, z: 0 }, hurtboxRadius: 0.75 }
    ]);
  }
});
