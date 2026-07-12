import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { validateDefinition } from "../src/application/definitions/definitionValidationRegistry";
import { rollbackSnapshot } from "../src/application/snapshots/rollbackSnapshot";
import { executeCli } from "../src/cli/main";
import { simulateStaminaAction } from "../src/domain/stamina/staminaSimulation";
import type { StaminaProfile } from "../src/domain/stamina/staminaTypes";
import { validateStaminaDefinition } from "../src/domain/stamina/staminaValidation";
import { listSnapshotSummaries } from "../src/infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../src/shared/errorCodes";

const root = path.resolve(__dirname, "../..");

async function workspace(context: TestContext) {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "mam-stamina-test-"));
  context.after(async () => rm(workspaceRoot, { recursive: true, force: true }));
  const files = ["examples/stamina/default.json", "examples/offensive-action/default.json", "examples/defensive-action/default.json", "examples/health/default.json"];
  for (const relative of files) { const target = path.join(workspaceRoot, ...relative.split("/")); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, await readFile(path.join(root, ...relative.split("/")), "utf8"), "utf8"); }
  return { root: workspaceRoot, stamina: files[0] as string, offensive: files[1] as string, defensive: files[2] as string, health: files[3] as string };
}

test("stamina profile v1 schema semantics and registry accept only the canonical shape", async () => {
  const profile = JSON.parse(await readFile(path.join(root, "examples/stamina/default.json"), "utf8")) as StaminaProfile;
  assert.equal(validateStaminaDefinition(profile).valid, true);
  assert.equal(validateDefinition(profile).kind, "stamina-profile");
  assert.equal(validateStaminaDefinition({ ...profile, extra: true }).errors[0]?.code, ErrorCodes.StaminaSchemaInvalid);
  assert.equal(validateStaminaDefinition({ ...profile, startingStamina: 101 }).errors[0]?.code, ErrorCodes.StaminaSemanticInvalid);
});

test("action cost simulation accepts, depletes, or rejects deterministically", async () => {
  const stamina = JSON.parse(await readFile(path.join(root, "examples/stamina/default.json"), "utf8")) as StaminaProfile;
  const offensive = JSON.parse(await readFile(path.join(root, "examples/offensive-action/default.json"), "utf8"));
  const defensive = JSON.parse(await readFile(path.join(root, "examples/defensive-action/default.json"), "utf8"));
  assert.deepEqual(simulateStaminaAction({ ...stamina, startingStamina: 10 }, offensive), { actionKind: "offensive-action-profile", startingStamina: 10, requestedStaminaCost: 10, consumedStamina: 10, remainingStamina: 0, sufficientStamina: true, actionAccepted: true, finalStaminaState: "depleted" });
  assert.deepEqual(simulateStaminaAction({ ...stamina, startingStamina: 10 }, defensive), { actionKind: "defensive-action-profile", startingStamina: 10, requestedStaminaCost: 25, consumedStamina: 0, remainingStamina: 10, sufficientStamina: false, actionAccepted: false, finalStaminaState: "insufficient" });
});

test("stamina CLI inspect validate and both action simulations are read-only", async (context) => {
  const target = await workspace(context);
  for (const action of ["inspect", "validate"] as const) { const result = await executeCli(["stamina", action, target.stamina, "--json"], target.root); assert.equal(result.result.status, "passed"); assert.deepEqual(result.result.changedFiles, []); }
  for (const actionFile of [target.offensive, target.defensive]) { const result = await executeCli(["stamina", "simulate-action", target.stamina, actionFile, "--json"], target.root); assert.equal(result.result.status, "passed"); assert.deepEqual(result.result.changedFiles, []); }
  const wrongKind = await executeCli(["stamina", "simulate-action", target.stamina, target.health, "--json"], target.root); assert.equal(wrongKind.result.errors[0]?.code, ErrorCodes.DefinitionKindUnsupported);
});

test("stamina set is transactional and rollback-compatible", async (context) => {
  const target = await workspace(context); const staminaFile = path.join(target.root, ...target.stamina.split("/")); const original = await readFile(staminaFile, "utf8");
  const dryRun = await executeCli(["stamina", "set", target.stamina, "startingStamina", "50", "--dry-run", "--json"], target.root); assert.equal(dryRun.result.status, "dry_run"); assert.equal(await readFile(staminaFile, "utf8"), original);
  const set = await executeCli(["stamina", "set", target.stamina, "startingStamina", "50", "--json"], target.root); assert.equal(set.result.status, "passed"); assert.equal((await listSnapshotSummaries(target.root))[0]?.definitionKind, "stamina-profile");
  const rollback = await rollbackSnapshot(target.root, set.result.snapshotId as string); assert.equal(rollback.status, "rolled_back"); assert.equal(await readFile(staminaFile, "utf8"), original);
});
