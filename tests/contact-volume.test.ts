import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { validateDefinition } from "../src/application/definitions/definitionValidationRegistry";
import { setContactVolumeValue } from "../src/application/contactVolume/setContactVolumeValue";
import { rollbackSnapshot } from "../src/application/snapshots/rollbackSnapshot";
import { executeCli } from "../src/cli/main";
import { simulateContact } from "../src/domain/contactVolume/contactVolumeSimulation";
import type { ContactVolumeProfile } from "../src/domain/contactVolume/contactVolumeTypes";
import { validateContactVolumeDefinition } from "../src/domain/contactVolume/contactVolumeValidation";
import { listSnapshotSummaries } from "../src/infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../src/shared/errorCodes";

const root = path.resolve(__dirname, "../..");
const hitboxRelative = "examples/contact-volume/default-hitbox.json";
const hurtboxRelative = "examples/contact-volume/default-hurtbox.json";

async function profile(relativeFile: string): Promise<ContactVolumeProfile> { return JSON.parse(await readFile(path.join(root, ...relativeFile.split("/")), "utf8")) as ContactVolumeProfile; }
async function workspace(context: TestContext) {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "mam-contact-volume-test-"));
  context.after(async () => rm(workspaceRoot, { recursive: true, force: true }));
  for (const relativeFile of [hitboxRelative, hurtboxRelative]) { const file = path.join(workspaceRoot, ...relativeFile.split("/")); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, await readFile(path.join(root, ...relativeFile.split("/")), "utf8"), "utf8"); }
  await writeFile(path.join(workspaceRoot, "unrelated.txt"), "unchanged\n", "utf8");
  return { root: workspaceRoot, hitboxFile: path.join(workspaceRoot, ...hitboxRelative.split("/")) };
}

test("contact volume v1 schema, semantics, roles, and definition registry accept both canonical examples", async () => {
  const hitbox = await profile(hitboxRelative); const hurtbox = await profile(hurtboxRelative);
  for (const value of [hitbox, hurtbox]) { assert.equal(validateContactVolumeDefinition(value).valid, true); assert.equal(validateDefinition(value).kind, "contact-volume-profile"); }
  assert.equal(validateContactVolumeDefinition({ ...hitbox, damage: 1 }).errors[0]?.code, ErrorCodes.ContactVolumeSchemaInvalid);
  assert.equal(validateContactVolumeDefinition({ ...hitbox, role: "trigger" }).errors[0]?.code, ErrorCodes.ContactVolumeSchemaInvalid);
  assert.equal(validateContactVolumeDefinition({ ...hitbox, radius: 0 }).errors[0]?.code, ErrorCodes.ContactVolumeSemanticInvalid);
  assert.equal(validateContactVolumeDefinition({ ...hitbox, activeStartSeconds: -1 }).errors[0]?.code, ErrorCodes.ContactVolumeSemanticInvalid);
  assert.equal(validateContactVolumeDefinition({ ...hitbox, activeEndSeconds: 0.05 }).errors[0]?.code, ErrorCodes.ContactVolumeSemanticInvalid);
});

test("contact simulation deterministically reports each overlapping active fixed step once", async () => {
  const hitbox = await profile(hitboxRelative); const hurtbox = await profile(hurtboxRelative);
  const result = simulateContact(hitbox, hurtbox, 0.1);
  assert.deepEqual(result, simulateContact(hitbox, hurtbox, 0.1));
  assert.deepEqual(result, { totalSteps: 5, hitboxActiveStartStep: 1, hitboxActiveEndStep: 4, hurtboxActiveStartStep: 2, hurtboxActiveEndStep: 5, spatialOverlap: true, contactOccurred: true, firstContactStep: 2, lastContactStep: 4, contactStepCount: 3, finalContactState: "contacted" });
  assert.throws(() => simulateContact(hitbox, hurtbox, 0));
  assert.throws(() => simulateContact(hurtbox, hitbox, 0.1));
});

test("contact simulation distinguishes spatial separation from non-overlapping activation windows", async () => {
  const hitbox = await profile(hitboxRelative); const hurtbox = await profile(hurtboxRelative);
  const separated = simulateContact(hitbox, { ...hurtbox, center: { x: 10, y: 0, z: 0 } }, 0.1);
  assert.equal(separated.spatialOverlap, false); assert.equal(separated.contactOccurred, false); assert.equal(separated.contactStepCount, 0);
  const mistimed = simulateContact({ ...hitbox, activeStartSeconds: 0.1, activeEndSeconds: 0.2 }, { ...hurtbox, activeStartSeconds: 0.4, activeEndSeconds: 0.5 }, 0.1);
  assert.equal(mistimed.spatialOverlap, true); assert.equal(mistimed.contactOccurred, false); assert.equal(mistimed.firstContactStep, null); assert.equal(mistimed.finalContactState, "no-contact");
});

test("contact volume CLI inspection, validation, and simulation are structured and read-only", async (context) => {
  const target = await workspace(context);
  for (const action of ["inspect", "validate"] as const) { const execution = await executeCli(["contact-volume", action, hitboxRelative, "--json"], target.root); assert.equal(execution.result.status, "passed", action); assert.equal(execution.result.command, `contact-volume.${action}`); assert.deepEqual(execution.result.changedFiles, []); }
  const simulation = await executeCli(["contact-volume", "simulate-contact", hitboxRelative, hurtboxRelative, "--fixed-delta", "0.1", "--json"], target.root);
  assert.equal(simulation.result.status, "passed"); assert.equal(simulation.result.command, "contact-volume.simulate-contact"); assert.equal((simulation.result.data as { contactStepCount: number }).contactStepCount, 3); assert.deepEqual(simulation.result.changedFiles, []);
  const invalidDelta = await executeCli(["contact-volume", "simulate-contact", hitboxRelative, hurtboxRelative, "--fixed-delta", "0", "--json"], target.root); assert.equal(invalidDelta.result.errors[0]?.code, ErrorCodes.CliArgumentInvalid);
  const reversed = await executeCli(["contact-volume", "simulate-contact", hurtboxRelative, hitboxRelative, "--json"], target.root); assert.equal(reversed.result.errors[0]?.code, ErrorCodes.ContactVolumeRoleInvalid);
});

test("contact volume set supports dotted properties, snapshots, dry runs, and rollback", async (context) => {
  const target = await workspace(context); const original = await readFile(target.hitboxFile, "utf8");
  assert.equal((await setContactVolumeValue(target.root, hitboxRelative, "center.x", 0.5, true)).status, "dry_run"); assert.equal(await readFile(target.hitboxFile, "utf8"), original);
  const set = await setContactVolumeValue(target.root, hitboxRelative, "radius", 1.25, false); assert.equal(set.status, "passed"); assert.equal((JSON.parse(await readFile(target.hitboxFile, "utf8")) as ContactVolumeProfile).radius, 1.25);
  assert.equal((await listSnapshotSummaries(target.root))[0]?.definitionKind, "contact-volume-profile"); assert.equal((await rollbackSnapshot(target.root, set.snapshotId as string)).status, "rolled_back"); assert.equal(await readFile(target.hitboxFile, "utf8"), original);
});

test("contact volume set rejects unknown and invalid edits without writes", async (context) => {
  const target = await workspace(context); const original = await readFile(target.hitboxFile, "utf8");
  assert.equal((await setContactVolumeValue(target.root, hitboxRelative, "missing", 1, false)).errors[0]?.code, ErrorCodes.ContactVolumePropertyNotFound);
  assert.equal((await setContactVolumeValue(target.root, hitboxRelative, "radius", 0, false)).errors[0]?.code, ErrorCodes.ContactVolumeSemanticInvalid);
  assert.equal(await readFile(target.hitboxFile, "utf8"), original); assert.equal((await listSnapshotSummaries(target.root)).length, 0);
});
