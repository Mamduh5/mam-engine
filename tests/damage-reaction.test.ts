import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { validateDefinition } from "../src/application/definitions/definitionValidationRegistry";
import { setDamageReactionValue } from "../src/application/damageReaction/setDamageReactionValue";
import { simulateDamageReactionFiles } from "../src/application/damageReaction/simulateDamageReaction";
import { rollbackSnapshot } from "../src/application/snapshots/rollbackSnapshot";
import { executeCli } from "../src/cli/main";
import { simulateDamageReactionHit } from "../src/domain/damageReaction/damageReactionSimulation";
import type { DamageReactionProfile } from "../src/domain/damageReaction/damageReactionTypes";
import { validateDamageReactionDefinition } from "../src/domain/damageReaction/damageReactionValidation";
import type { HealthProfile } from "../src/domain/health/healthTypes";
import type { OffensiveActionProfile } from "../src/domain/offensiveAction/offensiveActionTypes";
import { listSnapshotSummaries } from "../src/infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../src/shared/errorCodes";

const root = path.resolve(__dirname, "../..");
const reactionRelative = "examples/damage-reaction/default.json";
const healthRelative = "examples/health/default.json";
const actionRelative = "examples/offensive-action/default.json";

async function profiles(): Promise<{ reaction: DamageReactionProfile; health: HealthProfile; action: OffensiveActionProfile }> { return { reaction: JSON.parse(await readFile(path.join(root, ...reactionRelative.split("/")), "utf8")) as DamageReactionProfile, health: JSON.parse(await readFile(path.join(root, ...healthRelative.split("/")), "utf8")) as HealthProfile, action: JSON.parse(await readFile(path.join(root, ...actionRelative.split("/")), "utf8")) as OffensiveActionProfile }; }
async function workspace(context: TestContext) { const workspaceRoot = await mkdtemp(path.join(tmpdir(), "mam-damage-reaction-test-")); context.after(async () => rm(workspaceRoot, { recursive: true, force: true })); const files = { reaction: path.join(workspaceRoot, ...reactionRelative.split("/")), health: path.join(workspaceRoot, ...healthRelative.split("/")), action: path.join(workspaceRoot, ...actionRelative.split("/")) }; for (const [file, relative] of [[files.reaction, reactionRelative], [files.health, healthRelative], [files.action, actionRelative]] as const) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, await readFile(path.join(root, ...relative.split("/")), "utf8"), "utf8"); } await writeFile(path.join(workspaceRoot, "unrelated.txt"), "unchanged\n", "utf8"); return { root: workspaceRoot, files }; }

test("damage reaction v1 schema, semantics, and definition registry accept only the canonical shape", async () => {
  const { reaction } = await profiles(); assert.equal(validateDamageReactionDefinition(reaction).valid, true); assert.equal(validateDefinition(reaction).kind, "damage-reaction-profile");
  assert.equal(validateDamageReactionDefinition({ ...reaction, extra: true }).errors[0]?.code, ErrorCodes.DamageReactionSchemaInvalid);
  for (const invalid of [{ staggerThreshold: 0 }, { hitReactionDurationSeconds: 0 }, { staggerDurationSeconds: 0 }]) assert.equal(validateDamageReactionDefinition({ ...reaction, ...invalid }).errors[0]?.code, ErrorCodes.DamageReactionSemanticInvalid);
});

test("damage reaction simulation selects none, hit, stagger, and defeat with deterministic interruption timing", async () => {
  const { reaction, health, action } = await profiles(); const hit = simulateDamageReactionHit(reaction, health, action);
  assert.deepEqual(hit, simulateDamageReactionHit(reaction, health, action));
  assert.deepEqual(hit, { startingHealth: 100, incomingDamage: 20, appliedDamage: 20, remainingHealth: 80, defeated: false, staggerThreshold: 25, staggered: false, reactionType: "hit", reactionDurationSeconds: 0.2, reactionTotalSteps: 12, targetActionWasActive: false, targetActionInterrupted: false, finalTargetActionState: "inactive", finalTargetState: "alive" });
  const continuing = simulateDamageReactionHit(reaction, health, action, true); assert.equal(continuing.reactionType, "hit"); assert.equal(continuing.targetActionInterrupted, false); assert.equal(continuing.finalTargetActionState, "continuing");
  const stagger = simulateDamageReactionHit({ ...reaction, staggerThreshold: 20 }, health, action, true); assert.equal(stagger.reactionType, "stagger"); assert.equal(stagger.staggered, true); assert.equal(stagger.reactionDurationSeconds, 0.6); assert.equal(stagger.reactionTotalSteps, 36); assert.equal(stagger.targetActionInterrupted, true); assert.equal(stagger.finalTargetActionState, "interrupted");
  const defeat = simulateDamageReactionHit(reaction, { ...health, startingHealth: 15 }, action, true); assert.equal(defeat.reactionType, "defeat"); assert.equal(defeat.reactionDurationSeconds, 0); assert.equal(defeat.reactionTotalSteps, 0); assert.equal(defeat.finalTargetActionState, "interrupted"); assert.equal(defeat.finalTargetState, "defeated");
  const none = simulateDamageReactionHit(reaction, { ...health, startingHealth: 0 }, action, true); assert.equal(none.appliedDamage, 0); assert.equal(none.reactionType, "none"); assert.equal(none.targetActionInterrupted, false); assert.equal(none.finalTargetActionState, "continuing");
  assert.throws(() => simulateDamageReactionHit(reaction, health, action, false, 0));
});

test("damage reaction inspect validate and simulate-hit commands are structured and read-only", async (context) => {
  const target = await workspace(context);
  for (const action of ["inspect", "validate"] as const) { const execution = await executeCli(["damage-reaction", action, reactionRelative, "--json"], target.root); assert.equal(execution.result.status, "passed", action); assert.deepEqual(execution.result.changedFiles, []); }
  const inactive = await executeCli(["damage-reaction", "simulate-hit", reactionRelative, healthRelative, actionRelative, "--json"], target.root); assert.equal(inactive.result.status, "passed"); assert.equal((inactive.result.data as any).finalTargetActionState, "inactive"); assert.deepEqual(inactive.result.changedFiles, []);
  const active = await executeCli(["damage-reaction", "simulate-hit", reactionRelative, healthRelative, actionRelative, "--target-action-active", "--json"], target.root); assert.equal(active.result.status, "passed"); assert.equal((active.result.data as any).targetActionWasActive, true); assert.equal((active.result.data as any).finalTargetActionState, "continuing"); assert.deepEqual(active.result.changedFiles, []);
});

test("damage reaction set is transactional, kind-aware, dry-run safe, and rollback compatible", async (context) => {
  const target = await workspace(context); const original = await readFile(target.files.reaction, "utf8"); assert.equal((await setDamageReactionValue(target.root, reactionRelative, "staggerThreshold", 30, true)).status, "dry_run"); assert.equal(await readFile(target.files.reaction, "utf8"), original);
  const set = await setDamageReactionValue(target.root, reactionRelative, "staggerThreshold", 30, false); assert.equal(set.status, "passed"); assert.equal((JSON.parse(await readFile(target.files.reaction, "utf8")) as DamageReactionProfile).staggerThreshold, 30); assert.equal((await listSnapshotSummaries(target.root))[0]?.definitionKind, "damage-reaction-profile"); assert.equal((await rollbackSnapshot(target.root, set.snapshotId as string)).status, "rolled_back"); assert.equal(await readFile(target.files.reaction, "utf8"), original);
});

test("damage reaction edits and simulation reject invalid definitions without writes", async (context) => {
  const target = await workspace(context); const originals = { reaction: await readFile(target.files.reaction, "utf8"), health: await readFile(target.files.health, "utf8"), action: await readFile(target.files.action, "utf8") };
  assert.equal((await setDamageReactionValue(target.root, reactionRelative, "missing", 1, false)).errors[0]?.code, ErrorCodes.DamageReactionPropertyNotFound); assert.equal((await setDamageReactionValue(target.root, reactionRelative, "staggerThreshold", 0, false)).errors[0]?.code, ErrorCodes.DamageReactionSemanticInvalid);
  const reaction = JSON.parse(originals.reaction) as DamageReactionProfile; await writeFile(target.files.reaction, JSON.stringify({ ...reaction, staggerThreshold: 0 }), "utf8"); assert.equal((await simulateDamageReactionFiles(target.root, reactionRelative, healthRelative, actionRelative)).errors[0]?.code, ErrorCodes.DamageReactionSemanticInvalid); await writeFile(target.files.reaction, originals.reaction, "utf8");
  const health = JSON.parse(originals.health) as HealthProfile; await writeFile(target.files.health, JSON.stringify({ ...health, startingHealth: health.maxHealth + 1 }), "utf8"); assert.equal((await simulateDamageReactionFiles(target.root, reactionRelative, healthRelative, actionRelative)).errors[0]?.code, ErrorCodes.HealthSemanticInvalid); await writeFile(target.files.health, originals.health, "utf8");
  const action = JSON.parse(originals.action) as OffensiveActionProfile; await writeFile(target.files.action, JSON.stringify({ ...action, damage: 0 }), "utf8"); assert.equal((await simulateDamageReactionFiles(target.root, reactionRelative, healthRelative, actionRelative)).errors[0]?.code, ErrorCodes.OffensiveActionSemanticInvalid);
  assert.equal(await readFile(target.files.reaction, "utf8"), originals.reaction); assert.equal(await readFile(target.files.health, "utf8"), originals.health); assert.equal((await listSnapshotSummaries(target.root)).length, 0);
});
