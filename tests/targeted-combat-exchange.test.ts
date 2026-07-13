import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { executeCli } from "../src/cli/main";
import { ErrorCodes } from "../src/shared/errorCodes";

const root = path.resolve(__dirname, "../..");
const files = ["examples/targeting/default.json", "examples/stamina/default.json", "examples/health/default.json", "examples/offensive-action/default.json"];

async function workspace(context: TestContext) {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "mam-targeted-combat-test-")); context.after(async () => rm(workspaceRoot, { recursive: true, force: true }));
  for (const relative of files) { const target = path.join(workspaceRoot, ...relative.split("/")); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, await readFile(path.join(root, ...relative.split("/")), "utf8"), "utf8"); }
  await writeFile(path.join(workspaceRoot, "unrelated.txt"), "unchanged\n", "utf8");
  return workspaceRoot;
}

function command(scenario?: string): string[] {
  return ["combat", "simulate-targeted-exchange", ...files, ...(scenario ? ["--scenario", scenario] : []), "--json"];
}

test("target available acquires once and executes the existing stamina combat exchange", async (context) => {
  const workspaceRoot = await workspace(context); const result = await executeCli(command(), workspaceRoot); const data = result.result.data as any;
  assert.equal(result.result.status, "passed"); assert.deepEqual(result.result.changedFiles, []);
  assert.deepEqual(data, {
    scenario: "target-available", targetAcquired: true, selectedTargetId: "target-1", targetingFinalState: "locked",
    actionAccepted: true, sufficientStamina: true, startingStamina: 100, requestedStaminaCost: 10, consumedStamina: 10, remainingStamina: 90, finalStaminaState: "available",
    actionTotalSteps: 51, activeStartStep: 10, activeEndStep: 18, hitStep: 10, hitAccepted: true,
    startingHealth: 100, incomingDamage: 20, appliedDamage: 20, remainingHealth: 80, overkillDamage: 0, defeated: false, finalActionState: "ready", finalTargetState: "alive"
  });
});

test("no valid target rejects before stamina and damage", async (context) => {
  const workspaceRoot = await workspace(context); const result = await executeCli(command("no-valid-target"), workspaceRoot); const data = result.result.data as any;
  assert.equal(result.result.status, "passed"); assert.deepEqual(result.result.changedFiles, []);
  assert.equal(data.targetAcquired, false); assert.equal(data.selectedTargetId, null); assert.equal(data.targetingFinalState, "unlocked"); assert.equal(data.actionAccepted, false);
  assert.equal(data.consumedStamina, 0); assert.equal(data.remainingStamina, 100); assert.equal(data.hitAccepted, false); assert.equal(data.incomingDamage, 0); assert.equal(data.appliedDamage, 0); assert.equal(data.remainingHealth, 100);
});

test("insufficient stamina rejects a targeted attack with zero damage", async (context) => {
  const workspaceRoot = await workspace(context); const staminaPath = path.join(workspaceRoot, ...files[1]!.split("/")); const stamina = JSON.parse(await readFile(staminaPath, "utf8")); await writeFile(staminaPath, JSON.stringify({ ...stamina, startingStamina: 5 }), "utf8");
  const result = await executeCli(command(), workspaceRoot); const data = result.result.data as any;
  assert.equal(result.result.status, "passed"); assert.equal(data.targetAcquired, true); assert.equal(data.sufficientStamina, false); assert.equal(data.actionAccepted, false); assert.equal(data.consumedStamina, 0); assert.equal(data.appliedDamage, 0);
});

test("targeted exchange rejects invalid definitions before orchestration", async (context) => {
  const workspaceRoot = await workspace(context); const targetingPath = path.join(workspaceRoot, ...files[0]!.split("/")); const targeting = JSON.parse(await readFile(targetingPath, "utf8")); targeting.acquisition.maximumDistance = 0; await writeFile(targetingPath, JSON.stringify(targeting), "utf8");
  const result = await executeCli(command(), workspaceRoot);
  assert.equal(result.result.status, "failed"); assert.equal(result.result.errors[0]?.code, ErrorCodes.TargetingAcquisitionInvalid);
});
