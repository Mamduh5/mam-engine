import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { executeCli } from "../src/cli/main";
import { simulateCombatExchange } from "../src/domain/combat/combatExchangeSimulation";
import type { HealthProfile } from "../src/domain/health/healthTypes";
import type { OffensiveActionProfile } from "../src/domain/offensiveAction/offensiveActionTypes";
import { ErrorCodes } from "../src/shared/errorCodes";

const root = path.resolve(__dirname, "../..");

async function profiles(): Promise<{ health: HealthProfile; action: OffensiveActionProfile }> {
  return {
    health: JSON.parse(await readFile(path.join(root, "examples", "health", "default.json"), "utf8")) as HealthProfile,
    action: JSON.parse(await readFile(path.join(root, "examples", "offensive-action", "default.json"), "utf8")) as OffensiveActionProfile
  };
}

async function workspace(context: TestContext) {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "mam-combat-test-"));
  context.after(async () => rm(workspaceRoot, { recursive: true, force: true }));
  const healthRelative = "examples/health/default.json";
  const actionRelative = "examples/offensive-action/default.json";
  for (const relative of [healthRelative, actionRelative]) {
    const target = path.join(workspaceRoot, ...relative.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await readFile(path.join(root, ...relative.split("/")), "utf8"), "utf8");
  }
  await writeFile(path.join(workspaceRoot, "unrelated.txt"), "unchanged\n", "utf8");
  return { root: workspaceRoot, healthRelative, actionRelative };
}

test("combat exchange resolves one hit at the first active step", async () => {
  const { health, action } = await profiles();
  assert.deepEqual(simulateCombatExchange(health, action), {
    actionTotalSteps: 51,
    activeStartStep: 10,
    activeEndStep: 18,
    hitStep: 10,
    hitAccepted: true,
    startingHealth: 100,
    incomingDamage: 20,
    appliedDamage: 20,
    remainingHealth: 80,
    overkillDamage: 0,
    defeated: false,
    finalActionState: "ready",
    finalTargetState: "alive"
  });
});

test("combat exchange reuses clamped health damage and rejects an empty fixed-step active window", async () => {
  const { health, action } = await profiles();
  assert.equal(simulateCombatExchange({ ...health, startingHealth: 5 }, action)?.overkillDamage, 15);
  assert.equal(simulateCombatExchange(health, { ...action, activeStartSeconds: 0.1, activeEndSeconds: 0.1 }), null);
});

test("combat simulate-exchange is structured and read-only", async (context) => {
  const target = await workspace(context);
  const execution = await executeCli(["combat", "simulate-exchange", target.healthRelative, target.actionRelative, "--json"], target.root);
  assert.equal(execution.result.command, "combat.simulate-exchange");
  assert.equal(execution.result.status, "passed");
  assert.deepEqual(execution.result.changedFiles, []);
  assert.equal((execution.result.data as { hitStep: number }).hitStep, 10);
});

test("combat simulate-exchange reports an invalid discrete active window", async (context) => {
  const target = await workspace(context);
  const actionFile = path.join(target.root, ...target.actionRelative.split("/"));
  const action = JSON.parse(await readFile(actionFile, "utf8")) as OffensiveActionProfile;
  await writeFile(actionFile, JSON.stringify({ ...action, activeStartSeconds: 0.1, activeEndSeconds: 0.1 }), "utf8");
  const execution = await executeCli(["combat", "simulate-exchange", target.healthRelative, target.actionRelative, "--json"], target.root);
  assert.equal(execution.result.status, "failed");
  assert.equal(execution.result.errors[0]?.code, ErrorCodes.OffensiveActionSemanticInvalid);
});
