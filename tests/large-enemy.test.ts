import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { validateDefinition } from "../src/application/definitions/definitionValidationRegistry";
import { isLoadedLargeEnemyBundle, loadValidLargeEnemyBundle } from "../src/application/largeEnemy/largeEnemyOperationSupport";
import { setLargeEnemyValue } from "../src/application/largeEnemy/setLargeEnemyValue";
import { rollbackSnapshot } from "../src/application/snapshots/rollbackSnapshot";
import { executeCli } from "../src/cli/main";
import type { LargeEnemyBehaviorSimulation, LargeEnemyProfile } from "../src/domain/largeEnemy/largeEnemyTypes";
import { validateLargeEnemyDefinition } from "../src/domain/largeEnemy/largeEnemyValidation";
import { listSnapshotSummaries } from "../src/infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../src/shared/errorCodes";

const root = path.resolve(__dirname, "../..");
const relative = { enemy: "examples/large-enemy/training-behemoth.json", health: "examples/health/default.json", reaction: "examples/damage-reaction/default.json", head: "examples/contact-volume/default-hurtbox.json", core: "examples/contact-volume/window-miss-hurtbox.json", hitbox: "examples/contact-volume/training-weapon-hitbox.json" } as const;

async function createWorkspace(context: TestContext) {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "mam-large-enemy-test-")); context.after(async () => rm(workspaceRoot, { recursive: true, force: true }));
  const files = Object.fromEntries(await Promise.all(Object.entries(relative).map(async ([key, file]) => { const target = path.join(workspaceRoot, ...file.split("/")); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, await readFile(path.join(root, ...file.split("/")), "utf8"), "utf8"); return [key, target]; }))) as Record<keyof typeof relative, string>;
  await writeFile(path.join(workspaceRoot, "unrelated.txt"), "unchanged\n", "utf8"); return { root: workspaceRoot, files };
}

test("large-enemy v1 schema semantics references roles and registry accept training-behemoth", async (context) => {
  const target = await createWorkspace(context); const profile = JSON.parse(await readFile(target.files.enemy, "utf8")) as LargeEnemyProfile;
  assert.equal(validateLargeEnemyDefinition(profile).valid, true); assert.equal(validateDefinition(profile).kind, "large-enemy-profile");
  assert.equal(validateLargeEnemyDefinition({ ...profile, extra: true }).errors[0]?.code, ErrorCodes.LargeEnemySchemaInvalid);
  assert.equal(validateLargeEnemyDefinition({ ...profile, bodyParts: profile.bodyParts.map((part) => ({ ...part, targetable: false })) }).errors.at(-1)?.code, ErrorCodes.LargeEnemySemanticInvalid);
  assert.equal(validateLargeEnemyDefinition({ ...profile, idleDurationSeconds: 0, telegraphDurationSeconds: 0, attackDurationSeconds: 0, recoveryDurationSeconds: 0 }).errors[0]?.code, ErrorCodes.LargeEnemySemanticInvalid);
  assert.equal(validateLargeEnemyDefinition({ ...profile, bodyParts: [profile.bodyParts[0], { ...profile.bodyParts[1], id: profile.bodyParts[0]?.id }] }).errors[0]?.code, ErrorCodes.LargeEnemySemanticInvalid);
  const bundle = await loadValidLargeEnemyBundle(target.root, relative.enemy); assert.equal(isLoadedLargeEnemyBundle(bundle), true); if (!isLoadedLargeEnemyBundle(bundle)) return;
  assert.deepEqual(bundle.resolvedDefinitionPaths, { healthFile: relative.health, reactionFile: relative.reaction, bodyParts: [{ id: "head", hurtboxFile: relative.head }, { id: "core", hurtboxFile: relative.core }] });
});

test("large-enemy CLI inspect validate and both behavior scenarios are deterministic and read-only", async (context) => {
  const target = await createWorkspace(context); for (const action of ["inspect", "validate"] as const) { const result = await executeCli(["large-enemy", action, relative.enemy, "--json"], target.root); assert.equal(result.result.status, "passed"); assert.deepEqual(result.result.changedFiles, []); }
  const full = await executeCli(["large-enemy", "simulate", relative.enemy, "--scenario", "full-cycle", "--fixed-delta", "0.1", "--json"], target.root); const simulation = full.result.data as LargeEnemyBehaviorSimulation;
  assert.equal(full.result.status, "passed"); assert.deepEqual(full.result.changedFiles, []); assert.equal(simulation.enemyId, "training-behemoth"); assert.equal(simulation.totalCycleDurationSeconds, 1.7); assert.equal(simulation.totalSteps, 17); assert.deepEqual([simulation.idleStartStep, simulation.idleEndStep], [1, 5]); assert.deepEqual([simulation.telegraphStartStep, simulation.telegraphEndStep], [5, 8]); assert.deepEqual([simulation.attackStartStep, simulation.attackEndStep], [8, 12]); assert.deepEqual([simulation.recoveryStartStep, simulation.recoveryCompletionStep], [12, 17]); assert.deepEqual(simulation.targetableBodyPartIds, ["head", "core"]); assert.equal(simulation.selectedBodyPartId, "head"); assert.equal(simulation.finalBehaviorState, "complete");
  const disabled = await executeCli(["large-enemy", "simulate", relative.enemy, "--scenario", "primary-part-disabled", "--fixed-delta", "0.1", "--json"], target.root); const second = disabled.result.data as LargeEnemyBehaviorSimulation; assert.equal(disabled.result.status, "passed"); assert.deepEqual(second.targetableBodyPartIds, ["core"]); assert.equal(second.selectedBodyPartId, "core"); assert.equal(second.totalSteps, simulation.totalSteps);
});

test("large-enemy set supports nested body-part paths and snapshot rollback", async (context) => {
  const target = await createWorkspace(context); const original = await readFile(target.files.enemy, "utf8"); const dryRun = await setLargeEnemyValue(target.root, relative.enemy, "bodyParts.0.targetPoint.y", 2.5, true); assert.equal(dryRun.status, "dry_run"); assert.equal(await readFile(target.files.enemy, "utf8"), original);
  const set = await setLargeEnemyValue(target.root, relative.enemy, "bodyParts.0.targetPoint.y", 2.5, false); assert.equal(set.status, "passed"); assert.equal((await listSnapshotSummaries(target.root))[0]?.definitionKind, "large-enemy-profile"); assert.equal((await rollbackSnapshot(target.root, set.snapshotId as string)).status, "rolled_back"); assert.equal(await readFile(target.files.enemy, "utf8"), original);
});

test("large-enemy commands reject unsafe invalid and non-hurtbox references before orchestration", async (context) => {
  const target = await createWorkspace(context); const original = JSON.parse(await readFile(target.files.enemy, "utf8")) as LargeEnemyProfile;
  await writeFile(target.files.enemy, JSON.stringify({ ...original, healthFile: "../outside.json" }), "utf8"); let result = await executeCli(["large-enemy", "validate", relative.enemy, "--json"], target.root); assert.equal(result.result.errors[0]?.code, ErrorCodes.LargeEnemyReferenceInvalid);
  await writeFile(target.files.enemy, JSON.stringify({ ...original, bodyParts: [{ ...original.bodyParts[0], hurtboxFile: relative.hitbox }, original.bodyParts[1]] }), "utf8"); result = await executeCli(["large-enemy", "validate", relative.enemy, "--json"], target.root); assert.equal(result.result.errors[0]?.code, ErrorCodes.LargeEnemyReferenceInvalid);
  const health = JSON.parse(await readFile(target.files.health, "utf8")); await writeFile(target.files.enemy, JSON.stringify(original), "utf8"); await writeFile(target.files.health, JSON.stringify({ ...health, startingHealth: health.maxHealth + 1 }), "utf8"); result = await executeCli(["large-enemy", "simulate", relative.enemy, "--scenario", "full-cycle", "--json"], target.root); assert.equal(result.result.errors[0]?.code, ErrorCodes.LargeEnemyReferenceInvalid); assert.equal((await listSnapshotSummaries(target.root)).length, 0);
});

test("large-enemy simulation rejects invalid delta disabled-only targetability and unknown property paths", async (context) => {
  const target = await createWorkspace(context); let result = await executeCli(["large-enemy", "simulate", relative.enemy, "--scenario", "full-cycle", "--fixed-delta", "0", "--json"], target.root); assert.equal(result.result.errors[0]?.code, ErrorCodes.CliArgumentInvalid);
  const original = JSON.parse(await readFile(target.files.enemy, "utf8")) as LargeEnemyProfile; await writeFile(target.files.enemy, JSON.stringify({ ...original, bodyParts: original.bodyParts.map((part, index) => ({ ...part, targetable: index === 0 })) }), "utf8"); result = await executeCli(["large-enemy", "simulate", relative.enemy, "--scenario", "primary-part-disabled", "--json"], target.root); assert.equal(result.result.errors[0]?.code, ErrorCodes.LargeEnemyScenarioInvalid);
  assert.equal((await setLargeEnemyValue(target.root, relative.enemy, "bodyParts.9.id", "missing", false)).errors[0]?.code, ErrorCodes.LargeEnemyPropertyNotFound); assert.equal((await listSnapshotSummaries(target.root)).length, 0);
});
