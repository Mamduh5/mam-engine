import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { validateDefinition } from "../src/application/definitions/definitionValidationRegistry";
import { rollbackSnapshot } from "../src/application/snapshots/rollbackSnapshot";
import { setWeaponValue } from "../src/application/weapon/setWeaponValue";
import { isLoadedWeaponBundle, loadValidWeaponBundle } from "../src/application/weapon/weaponOperationSupport";
import { executeCli } from "../src/cli/main";
import type { ActionTimelineProfile } from "../src/domain/actionTimeline/actionTimelineTypes";
import type { OffensiveActionProfile } from "../src/domain/offensiveAction/offensiveActionTypes";
import type { WeaponProfile, WeaponStrikeSimulation } from "../src/domain/weapon/weaponTypes";
import { validateWeaponCompatibility, validateWeaponDefinition } from "../src/domain/weapon/weaponValidation";
import { listSnapshotSummaries } from "../src/infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../src/shared/errorCodes";

const root = path.resolve(__dirname, "../..");
const relative = {
  weapon: "examples/weapon/default.json",
  action: "examples/offensive-action/training-weapon-strike.json",
  timeline: "examples/action-timeline/training-weapon-strike.json",
  hitbox: "examples/contact-volume/training-weapon-hitbox.json",
  stamina: "examples/stamina/default.json",
  health: "examples/health/default.json",
  hurtbox: "examples/contact-volume/default-hurtbox.json",
  reaction: "examples/damage-reaction/default.json"
} as const;

async function createWorkspace(context: TestContext) {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "mam-weapon-test-")); context.after(async () => rm(workspaceRoot, { recursive: true, force: true }));
  const files = Object.fromEntries(await Promise.all(Object.entries(relative).map(async ([key, file]) => { const target = path.join(workspaceRoot, ...file.split("/")); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, await readFile(path.join(root, ...file.split("/")), "utf8"), "utf8"); return [key, target]; }))) as Record<keyof typeof relative, string>;
  await writeFile(path.join(workspaceRoot, "unrelated.txt"), "unchanged\n", "utf8"); return { root: workspaceRoot, files };
}

test("weapon v1 schema, semantics, references, compatibility, and registry accept the training weapon", async (context) => {
  const target = await createWorkspace(context); const weapon = JSON.parse(await readFile(target.files.weapon, "utf8")) as WeaponProfile;
  assert.equal(validateWeaponDefinition(weapon).valid, true); assert.equal(validateDefinition(weapon).kind, "weapon-profile"); assert.equal(validateWeaponDefinition({ ...weapon, extra: true }).errors[0]?.code, ErrorCodes.WeaponSchemaInvalid); assert.equal(validateWeaponDefinition({ ...weapon, hitboxFile: "  " }).errors[0]?.code, ErrorCodes.WeaponSemanticInvalid);
  const bundle = await loadValidWeaponBundle(target.root, relative.weapon); assert.equal(isLoadedWeaponBundle(bundle), true); if (!isLoadedWeaponBundle(bundle)) return;
  assert.deepEqual(bundle.resolvedDefinitionPaths, { offensiveActionFile: relative.action, actionTimelineFile: relative.timeline, hitboxFile: relative.hitbox }); assert.deepEqual(validateWeaponCompatibility(weapon, bundle.offensiveAction, bundle.actionTimeline, bundle.hitbox), []);
});

test("weapon CLI inspection validation and accepted strike are deterministic and read-only", async (context) => {
  const target = await createWorkspace(context); for (const action of ["inspect", "validate"] as const) { const result = await executeCli(["weapon", action, relative.weapon, "--json"], target.root); assert.equal(result.result.status, "passed"); assert.deepEqual(result.result.changedFiles, []); }
  const execution = await executeCli(["weapon", "simulate-strike", relative.weapon, relative.stamina, relative.health, relative.hurtbox, relative.reaction, "--fixed-delta", "0.05", "--json"], target.root); assert.equal(execution.result.status, "passed"); assert.deepEqual(execution.result.changedFiles, []); const strike = execution.result.data as WeaponStrikeSimulation;
  assert.equal(strike.weaponId, "default-training-weapon"); assert.equal(strike.actionAccepted, true); assert.equal(strike.consumedStamina, 10); assert.equal(strike.remainingStamina, 90); assert.equal(strike.timelineTotalSteps, 10); assert.deepEqual(strike.emittedEvents.map((event) => event.id), ["strike-start", "hitbox-enable", "hitbox-disable", "strike-finish"]); assert.equal(strike.offensiveActiveStartStep, 4); assert.equal(strike.hitboxActiveStartStep, 3); assert.equal(strike.contactOccurred, true); assert.equal(strike.firstContactStep, 4); assert.equal(strike.appliedDamage, 20); assert.equal(strike.remainingHealth, 80); assert.equal(strike.reactionType, "hit"); assert.equal(strike.targetActionInterrupted, false); assert.equal(strike.finalActionState, "ready"); assert.equal(strike.finalTargetActionState, "continuing"); assert.equal(strike.finalTargetState, "alive");
});

test("weapon strike rejects insufficient stamina and applies no-contact zero damage", async (context) => {
  const target = await createWorkspace(context); const stamina = JSON.parse(await readFile(target.files.stamina, "utf8")); await writeFile(target.files.stamina, JSON.stringify({ ...stamina, startingStamina: 5 }), "utf8");
  let execution = await executeCli(["weapon", "simulate-strike", relative.weapon, relative.stamina, relative.health, relative.hurtbox, relative.reaction, "--json"], target.root); let strike = execution.result.data as WeaponStrikeSimulation; assert.equal(strike.actionAccepted, false); assert.equal(strike.consumedStamina, 0); assert.equal(strike.timelineTotalSteps, 0); assert.equal(strike.contactOccurred, false); assert.equal(strike.appliedDamage, 0); assert.equal(strike.remainingHealth, 100); assert.equal(strike.reactionType, "none"); assert.equal(strike.finalActionState, "rejected");
  await writeFile(target.files.stamina, JSON.stringify(stamina), "utf8"); const hurtbox = JSON.parse(await readFile(target.files.hurtbox, "utf8")); await writeFile(target.files.hurtbox, JSON.stringify({ ...hurtbox, center: { x: 10, y: 0, z: 0 } }), "utf8"); execution = await executeCli(["weapon", "simulate-strike", relative.weapon, relative.stamina, relative.health, relative.hurtbox, relative.reaction, "--json"], target.root); strike = execution.result.data as WeaponStrikeSimulation; assert.equal(strike.actionAccepted, true); assert.equal(strike.contactOccurred, false); assert.equal(strike.incomingDamage, 0); assert.equal(strike.appliedDamage, 0); assert.equal(strike.finalTargetActionState, "continuing");
});

test("weapon set is reference-safe, transactional, snapshot-aware, and rollback compatible", async (context) => {
  const target = await createWorkspace(context); const original = await readFile(target.files.weapon, "utf8"); assert.equal((await setWeaponValue(target.root, relative.weapon, "displayName", "Updated Training Weapon", true)).status, "dry_run"); assert.equal(await readFile(target.files.weapon, "utf8"), original);
  const set = await setWeaponValue(target.root, relative.weapon, "displayName", "Updated Training Weapon", false); assert.equal(set.status, "passed"); assert.equal((await listSnapshotSummaries(target.root))[0]?.definitionKind, "weapon-profile"); assert.equal((await rollbackSnapshot(target.root, set.snapshotId as string)).status, "rolled_back"); assert.equal(await readFile(target.files.weapon, "utf8"), original);
});

test("weapon commands reject unsafe references, incompatible definitions, invalid inputs, and fixed delta", async (context) => {
  const target = await createWorkspace(context); const originalWeapon = JSON.parse(await readFile(target.files.weapon, "utf8")) as WeaponProfile;
  await writeFile(target.files.weapon, JSON.stringify({ ...originalWeapon, offensiveActionFile: "../outside.json" }), "utf8"); let result = await executeCli(["weapon", "validate", relative.weapon, "--json"], target.root); assert.equal(result.result.errors[0]?.code, ErrorCodes.WeaponReferenceInvalid); await writeFile(target.files.weapon, JSON.stringify(originalWeapon), "utf8");
  const timeline = JSON.parse(await readFile(target.files.timeline, "utf8")) as ActionTimelineProfile; await writeFile(target.files.timeline, JSON.stringify({ ...timeline, durationSeconds: 0.6 }), "utf8"); result = await executeCli(["weapon", "validate", relative.weapon, "--json"], target.root); assert.equal(result.result.errors[0]?.code, ErrorCodes.WeaponCompatibilityInvalid); await writeFile(target.files.timeline, JSON.stringify(timeline), "utf8");
  const action = JSON.parse(await readFile(target.files.action, "utf8")) as OffensiveActionProfile; await writeFile(target.files.action, JSON.stringify({ ...action, damage: 0 }), "utf8"); result = await executeCli(["weapon", "simulate-strike", relative.weapon, relative.stamina, relative.health, relative.hurtbox, relative.reaction, "--json"], target.root); assert.equal(result.result.errors[0]?.code, ErrorCodes.WeaponReferenceInvalid); await writeFile(target.files.action, JSON.stringify(action), "utf8");
  result = await executeCli(["weapon", "simulate-strike", relative.weapon, relative.stamina, relative.health, relative.hurtbox, relative.reaction, "--fixed-delta", "0", "--json"], target.root); assert.equal(result.result.errors[0]?.code, ErrorCodes.CliArgumentInvalid); assert.equal((await setWeaponValue(target.root, relative.weapon, "missing", 1, false)).errors[0]?.code, ErrorCodes.WeaponPropertyNotFound); assert.equal((await listSnapshotSummaries(target.root)).length, 0);
});
