import assert from "node:assert/strict";
import test from "node:test";

import { executeCli } from "../../src/cli/main";
import type { EncounterScenario } from "../../src/domain/encounter/encounterTypes";
import { discoverGodot } from "../../src/infrastructure/runtime/godotDiscovery";
import { projectRoot } from "../testUtils";

const availability = discoverGodot().then(() => null, (error: Error) => error.message);

test("real Godot training encounter matches TypeScript through victory and stamina exhaustion", async (context) => {
  const reason = await availability; if (reason) { context.skip(`Godot unavailable: ${reason}`); return; }
  const scenarios: Array<{ id: EncounterScenario; outcome: string; failure: string; rounds: number; accepted: number; contacts: number; stamina: number; health: number }> = [
    { id: "successful-hunt", outcome: "victory", failure: "none", rounds: 5, accepted: 5, contacts: 5, stamina: 50, health: 0 },
    { id: "stamina-exhausted", outcome: "failed", failure: "insufficient-stamina", rounds: 5, accepted: 4, contacts: 4, stamina: 0, health: 20 }
  ];
  for (const scenario of scenarios) {
    const execution = await executeCli(["encounter", "runtime-test", "examples/encounter/training-hunt.json", "--scenario", scenario.id, "--fixed-delta", "0.1", "--json"], projectRoot()); const data = execution.result.data as any; const metrics = data?.runtime?.metrics;
    assert.equal(execution.result.status, "passed", JSON.stringify(execution.result)); assert.deepEqual(execution.result.changedFiles, []); assert.equal(data.runtime.fixtureId, "encounter/training-hunt"); assert.equal(data.runtime.evidence.fixtureScene, "res://scenes/encounter_fixture.tscn"); assert.equal(data.comparison.passed, true);
    assert.equal(metrics.encounterId, "training-hunt"); assert.deepEqual(metrics.resolvedDefinitionPaths, { hunterFile: "examples/hunter/training-hunter.json", weaponFile: "examples/weapon/default.json", enemyFile: "examples/large-enemy/training-behemoth.json", arenaFile: "examples/arena/training-arena.json" });
    assert.deepEqual(metrics.hunterSpawn, { x: -5, y: 0, z: 0 }); assert.deepEqual(metrics.enemySpawn, { x: 5, y: 0, z: 0 }); assert.equal(metrics.selectedBodyPartId, "head"); assert.equal(metrics.roundsStarted, scenario.rounds); assert.equal(metrics.roundsCompleted, scenario.rounds); assert.equal(metrics.enemyBehaviorCyclesCompleted, scenario.rounds); assert.equal(metrics.acceptedStrikeCount, scenario.accepted); assert.equal(metrics.contactCount, scenario.contacts); assert.equal(metrics.hunterRemainingStamina, scenario.stamina); assert.equal(metrics.enemyRemainingHealth, scenario.health); assert.equal(metrics.outcome, scenario.outcome); assert.equal(metrics.failureReason, scenario.failure); assert.equal(metrics.roundSummaries.length, scenario.rounds);
    if (scenario.id === "stamina-exhausted") { const rejected = metrics.roundSummaries.at(-1); assert.equal(rejected.actionAccepted, false); assert.equal(rejected.consumedStamina, 0); assert.equal(rejected.damageApplied, 0); assert.equal(rejected.remainingEnemyHealth, 20); }
  }
});
