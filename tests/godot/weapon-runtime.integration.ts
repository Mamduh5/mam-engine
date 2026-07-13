import assert from "node:assert/strict";
import test from "node:test";

import { executeCli } from "../../src/cli/main";
import type { WeaponRuntimeScenario } from "../../src/domain/runtime/runtimeProtocol";
import { discoverGodot } from "../../src/infrastructure/runtime/godotDiscovery";
import { projectRoot } from "../testUtils";

const availability = discoverGodot().then(() => null, (error: Error) => error.message);

test("real Godot training weapon matches TypeScript for successful and stamina-rejected strikes", async (context) => {
  const reason = await availability; if (reason) { context.skip(`Godot unavailable: ${reason}`); return; }
  const scenarios: Array<{ id: WeaponRuntimeScenario; stamina: string; accepted: boolean; animation: boolean; contact: boolean; damage: number }> = [
    { id: "successful-strike", stamina: "examples/stamina/default.json", accepted: true, animation: true, contact: true, damage: 20 },
    { id: "insufficient-stamina", stamina: "examples/stamina/insufficient-weapon.json", accepted: false, animation: false, contact: false, damage: 0 }
  ];
  for (const scenario of scenarios) {
    const execution = await executeCli(["weapon", "runtime-test", "examples/weapon/default.json", scenario.stamina, "examples/health/default.json", "examples/contact-volume/default-hurtbox.json", "examples/damage-reaction/default.json", "--scenario", scenario.id, "--fixed-delta", "0.1", "--json"], projectRoot()); const data = execution.result.data as any;
    assert.equal(execution.result.status, "passed", JSON.stringify(execution.result)); assert.deepEqual(execution.result.changedFiles, []); assert.equal(data.runtime.fixtureId, "weapon/training-strike"); assert.equal(data.runtime.evidence.fixtureScene, "res://scenes/weapon_fixture.tscn"); assert.equal(data.runtime.metrics.actionAccepted, scenario.accepted); assert.equal(data.runtime.metrics.animationStarted, scenario.animation); assert.equal(data.runtime.metrics.contactOccurred, scenario.contact); assert.equal(data.runtime.metrics.appliedDamage, scenario.damage); assert.equal(data.runtime.metrics.hitboxEnableCount, scenario.accepted ? 1 : 0); assert.equal(data.runtime.metrics.damageApplicationCount, scenario.accepted ? 1 : 0); assert.equal(data.comparison.passed, true);
  }
});
