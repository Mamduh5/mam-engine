import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { validateDefinition } from "../src/application/definitions/definitionValidationRegistry";
import { setActionTimelineValue } from "../src/application/actionTimeline/setActionTimelineValue";
import { rollbackSnapshot } from "../src/application/snapshots/rollbackSnapshot";
import { executeCli } from "../src/cli/main";
import { simulateActionTimeline } from "../src/domain/actionTimeline/actionTimelineSimulation";
import type { ActionTimelineProfile } from "../src/domain/actionTimeline/actionTimelineTypes";
import { validateActionTimelineDefinition } from "../src/domain/actionTimeline/actionTimelineValidation";
import { listSnapshotSummaries } from "../src/infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../src/shared/errorCodes";

const root = path.resolve(__dirname, "../..");
async function defaultProfile(): Promise<ActionTimelineProfile> { return JSON.parse(await readFile(path.join(root, "examples", "action-timeline", "default.json"), "utf8")) as ActionTimelineProfile; }
async function workspace(context: TestContext) { const workspaceRoot = await mkdtemp(path.join(tmpdir(), "mam-action-timeline-test-")); context.after(async () => rm(workspaceRoot, { recursive: true, force: true })); const relativeFile = "examples/action-timeline/default.json"; const file = path.join(workspaceRoot, ...relativeFile.split("/")); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, await readFile(path.join(root, ...relativeFile.split("/")), "utf8"), "utf8"); await writeFile(path.join(workspaceRoot, "unrelated.txt"), "unchanged\n", "utf8"); return { root: workspaceRoot, relativeFile, file }; }

test("action timeline v1 schema, semantics, and definition registry accept the canonical shape", async () => {
  const profile = await defaultProfile(); assert.equal(validateActionTimelineDefinition(profile).valid, true); assert.equal(validateDefinition(profile).kind, "action-timeline-profile");
  assert.equal(validateActionTimelineDefinition({ ...profile, damage: 1 }).errors[0]?.code, ErrorCodes.ActionTimelineSchemaInvalid);
  assert.equal(validateActionTimelineDefinition({ ...profile, events: [...profile.events, { id: "begin", timeSeconds: 0.2, name: "duplicate" }] }).errors[0]?.code, ErrorCodes.ActionTimelineSemanticInvalid);
  assert.equal(validateActionTimelineDefinition({ ...profile, events: [{ id: "late", timeSeconds: 0.7, name: "late" }] }).errors[0]?.code, ErrorCodes.ActionTimelineSemanticInvalid);
});

test("action timeline simulation emits each event once by authored time and declaration order", async () => {
  const profile = await defaultProfile(); profile.events = [profile.events[2]!, { id: "tie-a", timeSeconds: 0.3, name: "tie_a" }, profile.events[0]!, { id: "tie-b", timeSeconds: 0.3, name: "tie_b" }];
  const first = simulateActionTimeline(profile, 0.1); assert.deepEqual(first, simulateActionTimeline(profile, 0.1));
  assert.deepEqual(first, { fixedDeltaSeconds: 0.1, durationSeconds: 0.6, animationName: "interact", totalSteps: 6, authoredEventCount: 4, emittedEvents: [
    { id: "begin", name: "interaction_begin", authoredTimeSeconds: 0, emittedStep: 1 },
    { id: "tie-a", name: "tie_a", authoredTimeSeconds: 0.3, emittedStep: 3 },
    { id: "tie-b", name: "tie_b", authoredTimeSeconds: 0.3, emittedStep: 3 },
    { id: "finish", name: "interaction_finish", authoredTimeSeconds: 0.6, emittedStep: 6 }
  ], completionStep: 6, finalActionState: "complete" });
  assert.throws(() => simulateActionTimeline(profile, 0));
});

test("action timeline inspect validate and simulate commands are structured and read-only", async (context) => {
  const target = await workspace(context); for (const action of ["inspect", "validate", "simulate"] as const) { const execution = await executeCli(["action-timeline", action, target.relativeFile, "--json"], target.root); assert.equal(execution.result.status, "passed", action); assert.equal(execution.result.command, `action-timeline.${action}`); assert.deepEqual(execution.result.changedFiles, []); }
  const invalidDelta = await executeCli(["action-timeline", "simulate", target.relativeFile, "--fixed-delta", "0", "--json"], target.root); assert.equal(invalidDelta.result.status, "failed"); assert.equal(invalidDelta.result.errors[0]?.code, ErrorCodes.CliArgumentInvalid);
});

test("action timeline set is transactional, kind-aware, dry-run safe, and rollback compatible", async (context) => {
  const target = await workspace(context); const original = await readFile(target.file, "utf8"); assert.equal((await setActionTimelineValue(target.root, target.relativeFile, "animationName", "interact_alt", true)).status, "dry_run"); assert.equal(await readFile(target.file, "utf8"), original);
  const set = await setActionTimelineValue(target.root, target.relativeFile, "displayName", "Updated Interact", false); assert.equal(set.status, "passed"); assert.equal((JSON.parse(await readFile(target.file, "utf8")) as ActionTimelineProfile).displayName, "Updated Interact"); assert.equal((await listSnapshotSummaries(target.root))[0]?.definitionKind, "action-timeline-profile"); assert.equal((await rollbackSnapshot(target.root, set.snapshotId as string)).status, "rolled_back"); assert.equal(await readFile(target.file, "utf8"), original);
});

test("action timeline set rejects unknown and semantically invalid edits without writes", async (context) => {
  const target = await workspace(context); const original = await readFile(target.file, "utf8"); assert.equal((await setActionTimelineValue(target.root, target.relativeFile, "missing", 1, false)).errors[0]?.code, ErrorCodes.ActionTimelinePropertyNotFound); assert.equal((await setActionTimelineValue(target.root, target.relativeFile, "durationSeconds", 0.5, false)).errors[0]?.code, ErrorCodes.ActionTimelineSemanticInvalid); assert.equal(await readFile(target.file, "utf8"), original); assert.equal((await listSnapshotSummaries(target.root)).length, 0);
});
