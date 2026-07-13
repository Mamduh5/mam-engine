import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { validateDefinition } from "../src/application/definitions/definitionValidationRegistry";
import { isLoadedEncounterBundle, loadValidEncounterBundle } from "../src/application/encounter/encounterOperationSupport";
import { setEncounterValue } from "../src/application/encounter/setEncounterValue";
import { rollbackSnapshot } from "../src/application/snapshots/rollbackSnapshot";
import { executeCli } from "../src/cli/main";
import type { EncounterProfile } from "../src/domain/encounter/encounterTypes";
import { validateEncounterDefinition } from "../src/domain/encounter/encounterValidation";
import { listSnapshotSummaries } from "../src/infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../src/shared/errorCodes";

const root = path.resolve(__dirname, "../..");
const encounterFile = "examples/encounter/training-hunt.json";
const files = [encounterFile, "examples/hunter/training-hunter.json", "examples/weapon/default.json", "examples/large-enemy/training-behemoth.json", "examples/arena/training-arena.json", "examples/health/default.json", "examples/stamina/default.json", "examples/damage-reaction/default.json", "examples/contact-volume/default-hitbox.json", "examples/contact-volume/default-hurtbox.json", "examples/contact-volume/window-miss-hurtbox.json", "examples/contact-volume/training-weapon-hitbox.json", "examples/offensive-action/training-weapon-strike.json", "examples/action-timeline/training-weapon-strike.json"];

async function createWorkspace(context: TestContext) { const workspace = await mkdtemp(path.join(tmpdir(), "mam-encounter-test-")); context.after(async () => rm(workspace, { recursive: true, force: true })); for (const file of files) { const target = path.join(workspace, ...file.split("/")); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, await readFile(path.join(root, ...file.split("/")), "utf8"), "utf8"); } await writeFile(path.join(workspace, "unrelated.txt"), "unchanged\n", "utf8"); return workspace; }

test("encounter schema registry references and inspection expose the composed hunt", async (context) => {
  const workspace = await createWorkspace(context); const profile = JSON.parse(await readFile(path.join(workspace, ...encounterFile.split("/")), "utf8")) as EncounterProfile;
  assert.equal(validateEncounterDefinition(profile).valid, true); assert.equal(validateDefinition(profile).kind, "encounter-profile"); assert.equal(validateEncounterDefinition({ ...profile, maxRounds: 0 }).valid, false); assert.equal(validateEncounterDefinition({ ...profile, hiddenState: true }).errors[0]?.code, ErrorCodes.EncounterSchemaInvalid);
  const bundle = await loadValidEncounterBundle(workspace, encounterFile); assert.equal(isLoadedEncounterBundle(bundle), true); if (!isLoadedEncounterBundle(bundle)) return; assert.equal(bundle.selectedBodyPartId, "head");
  const execution = await executeCli(["encounter", "inspect", encounterFile, "--json"], workspace); assert.equal(execution.result.status, "passed"); assert.deepEqual(execution.result.changedFiles, []); const data = execution.result.data as Record<string, unknown>; assert.equal(data.encounterId, "training-hunt"); assert.equal(data.selectedBodyPartId, "head");
});

test("successful-hunt composes deterministic cycles and strikes until victory", async (context) => {
  const workspace = await createWorkspace(context); const execution = await executeCli(["encounter", "simulate", encounterFile, "--scenario", "successful-hunt", "--fixed-delta", "0.1", "--json"], workspace); assert.equal(execution.result.status, "passed"); const data = execution.result.data as Record<string, unknown>;
  assert.equal(data.outcome, "victory"); assert.equal(data.failureReason, "none"); assert.equal(data.roundsStarted, 5); assert.equal(data.roundsCompleted, 5); assert.equal(data.enemyBehaviorCyclesCompleted, 5); assert.equal(data.acceptedStrikeCount, 5); assert.equal(data.contactCount, 5); assert.equal(data.hunterConsumedStamina, 50); assert.equal(data.hunterRemainingStamina, 50); assert.equal(data.enemyRemainingHealth, 0); assert.equal(data.totalDamageApplied, 100); assert.equal(data.lastReactionType, "defeat"); assert.equal(data.hunterStartingHealth, data.hunterFinalHealth); assert.deepEqual(execution.result.changedFiles, []);
});

test("stamina-exhausted carries state across rounds and fails before another strike", async (context) => {
  const workspace = await createWorkspace(context); const execution = await executeCli(["encounter", "simulate", encounterFile, "--scenario", "stamina-exhausted", "--json"], workspace); assert.equal(execution.result.status, "passed"); const data = execution.result.data as Record<string, unknown>;
  assert.equal(data.outcome, "failed"); assert.equal(data.failureReason, "insufficient-stamina"); assert.equal(data.roundsStarted, 5); assert.equal(data.roundsCompleted, 5); assert.equal(data.enemyBehaviorCyclesCompleted, 5); assert.equal(data.strikeCount, 5); assert.equal(data.acceptedStrikeCount, 4); assert.equal(data.contactCount, 4); assert.equal(data.hunterStartingStamina, 40); assert.equal(data.hunterConsumedStamina, 40); assert.equal(data.hunterRemainingStamina, 0); assert.equal(data.enemyRemainingHealth, 20); assert.equal((data.roundSummaries as Array<Record<string, unknown>>).at(-1)?.actionAccepted, false);
});

test("encounter set is transactional snapshot-aware and rollback compatible", async (context) => {
  const workspace = await createWorkspace(context); const target = path.join(workspace, ...encounterFile.split("/")); const original = await readFile(target, "utf8"); assert.equal((await setEncounterValue(workspace, encounterFile, "displayName", "Updated Hunt", true)).status, "dry_run"); assert.equal(await readFile(target, "utf8"), original); const result = await setEncounterValue(workspace, encounterFile, "displayName", "Updated Hunt", false); assert.equal(result.status, "passed"); assert.equal((await listSnapshotSummaries(workspace))[0]?.definitionKind, "encounter-profile"); assert.equal((await rollbackSnapshot(workspace, result.snapshotId as string)).status, "rolled_back"); assert.equal(await readFile(target, "utf8"), original);
});

test("encounter rejects invalid references compatibility scenarios and property edits", async (context) => {
  const workspace = await createWorkspace(context); const target = path.join(workspace, ...encounterFile.split("/")); const profile = JSON.parse(await readFile(target, "utf8")) as EncounterProfile;
  await writeFile(target, JSON.stringify({ ...profile, hunterFile: "../outside.json" }), "utf8"); let execution = await executeCli(["encounter", "validate", encounterFile, "--json"], workspace); assert.equal(execution.result.errors[0]?.code, ErrorCodes.EncounterReferenceInvalid); await writeFile(target, JSON.stringify(profile), "utf8");
  const hurtboxPath = path.join(workspace, "examples", "contact-volume", "default-hurtbox.json"); const hurtbox = JSON.parse(await readFile(hurtboxPath, "utf8")); await writeFile(hurtboxPath, JSON.stringify({ ...hurtbox, center: { x: 100, y: 0, z: 0 } }), "utf8"); execution = await executeCli(["encounter", "validate", encounterFile, "--json"], workspace); assert.equal(execution.result.errors[0]?.code, ErrorCodes.EncounterCompatibilityInvalid);
  assert.equal((await setEncounterValue(workspace, encounterFile, "nested.value", 1, false)).errors[0]?.code, ErrorCodes.EncounterPropertyNotFound); execution = await executeCli(["encounter", "simulate", encounterFile, "--scenario", "bad", "--json"], workspace); assert.equal(execution.exitCode, 2);
});
