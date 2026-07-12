import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { executeCli } from "../src/cli/main";
import { simulateStaminaCombatExchange } from "../src/domain/combat/staminaCombatExchangeSimulation";
import type { HealthProfile } from "../src/domain/health/healthTypes";
import type { OffensiveActionProfile } from "../src/domain/offensiveAction/offensiveActionTypes";
import type { StaminaProfile } from "../src/domain/stamina/staminaTypes";
import { ErrorCodes } from "../src/shared/errorCodes";

const root = path.resolve(__dirname, "../..");

async function profiles(): Promise<{ stamina: StaminaProfile; health: HealthProfile; action: OffensiveActionProfile }> {
  return {
    stamina: JSON.parse(await readFile(path.join(root, "examples", "stamina", "default.json"), "utf8")) as StaminaProfile,
    health: JSON.parse(await readFile(path.join(root, "examples", "health", "default.json"), "utf8")) as HealthProfile,
    action: JSON.parse(await readFile(path.join(root, "examples", "offensive-action", "default.json"), "utf8")) as OffensiveActionProfile
  };
}

async function workspace(context: TestContext) {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "mam-stamina-combat-test-")); context.after(async () => rm(workspaceRoot, { recursive: true, force: true }));
  const staminaRelative = "examples/stamina/default.json"; const healthRelative = "examples/health/default.json"; const actionRelative = "examples/offensive-action/default.json";
  for (const relative of [staminaRelative, healthRelative, actionRelative]) { const target = path.join(workspaceRoot, ...relative.split("/")); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, await readFile(path.join(root, ...relative.split("/")), "utf8"), "utf8"); }
  await writeFile(path.join(workspaceRoot, "unrelated.txt"), "unchanged\n", "utf8");
  return { root: workspaceRoot, staminaRelative, healthRelative, actionRelative };
}

test("accepted stamina combat consumes once and reuses the combat exchange", async () => {
  const { stamina, health, action } = await profiles();
  assert.deepEqual(simulateStaminaCombatExchange(stamina, health, action), {
    actionAccepted: true, sufficientStamina: true, startingStamina: 100, requestedStaminaCost: 10, consumedStamina: 10, remainingStamina: 90, finalStaminaState: "available",
    actionTotalSteps: 51, activeStartStep: 10, activeEndStep: 18, hitStep: 10, hitAccepted: true,
    startingHealth: 100, incomingDamage: 20, appliedDamage: 20, remainingHealth: 80, overkillDamage: 0, defeated: false, finalActionState: "ready", finalTargetState: "alive"
  });
});

test("insufficient stamina rejects before combat with zero damage", async () => {
  const { stamina, health, action } = await profiles();
  assert.deepEqual(simulateStaminaCombatExchange({ ...stamina, startingStamina: 5 }, health, action), {
    actionAccepted: false, sufficientStamina: false, startingStamina: 5, requestedStaminaCost: 10, consumedStamina: 0, remainingStamina: 5, finalStaminaState: "insufficient",
    actionTotalSteps: 51, activeStartStep: 10, activeEndStep: 18, hitStep: 10, hitAccepted: false,
    startingHealth: 100, incomingDamage: 0, appliedDamage: 0, remainingHealth: 100, overkillDamage: 0, defeated: false, finalActionState: "ready", finalTargetState: "alive"
  });
});

test("combat simulate-stamina-exchange is structured and read-only for accepted and rejected attacks", async (context) => {
  const target = await workspace(context); const command = ["combat", "simulate-stamina-exchange", target.staminaRelative, target.healthRelative, target.actionRelative, "--json"];
  const accepted = await executeCli(command, target.root); assert.equal(accepted.result.status, "passed"); assert.deepEqual(accepted.result.changedFiles, []); assert.equal((accepted.result.data as any).hitAccepted, true);
  const staminaFile = path.join(target.root, ...target.staminaRelative.split("/")); const stamina = JSON.parse(await readFile(staminaFile, "utf8")) as StaminaProfile; await writeFile(staminaFile, JSON.stringify({ ...stamina, startingStamina: 5 }), "utf8");
  const rejected = await executeCli(command, target.root); assert.equal(rejected.result.status, "passed"); assert.deepEqual(rejected.result.changedFiles, []); assert.equal((rejected.result.data as any).appliedDamage, 0); assert.equal((rejected.result.data as any).remainingHealth, 100);
});

test("stamina combat rejects invalid definitions before orchestration", async (context) => {
  const target = await workspace(context); const staminaFile = path.join(target.root, ...target.staminaRelative.split("/")); const stamina = JSON.parse(await readFile(staminaFile, "utf8")) as StaminaProfile; await writeFile(staminaFile, JSON.stringify({ ...stamina, startingStamina: 101 }), "utf8");
  const result = await executeCli(["combat", "simulate-stamina-exchange", target.staminaRelative, target.healthRelative, target.actionRelative, "--json"], target.root);
  assert.equal(result.result.status, "failed"); assert.equal(result.result.errors[0]?.code, ErrorCodes.StaminaSemanticInvalid);
});
