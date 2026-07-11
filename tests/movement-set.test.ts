import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { inspectMovement } from "../src/application/movement/inspectMovement";
import { setMovementValue } from "../src/application/movement/setMovementValue";
import { auditChangedFiles, captureWorkspaceState, diffFileStates } from "../src/infrastructure/files/changedFileAudit";
import { ErrorCodes } from "../src/shared/errorCodes";
import { createTestWorkspace } from "./testUtils";

test("inspection returns derived metrics and changes zero files", async (context) => {
  const workspace = await createTestWorkspace(context);
  const before = await captureWorkspaceState(workspace.root);
  const result = await inspectMovement(workspace.root, workspace.relativeFile);
  const after = await captureWorkspaceState(workspace.root);
  assert.equal(result.status, "passed");
  assert.equal(result.changedFiles.length, 0);
  assert.deepEqual(diffFileStates(before, after), []);
  assert.equal(typeof (result.data as { derivedMetrics: { dodgeAverageTravelSpeed: number } }).derivedMetrics.dodgeAverageTravelSpeed, "number");
});

test("valid property update creates a snapshot and only allowed files change", async (context) => {
  const workspace = await createTestWorkspace(context);
  const result = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false);
  assert.equal(result.status, "passed");
  assert.equal(typeof result.snapshotId, "string");
  assert(result.changedFiles.includes(workspace.relativeFile));
  assert(result.changedFiles.some((file) => file.startsWith(".mam-engine/snapshots/")));
  assert.equal(result.changedFiles.length, 2);
  const profile = JSON.parse(await readFile(workspace.movementFile, "utf8")) as { ground: { runSpeed: number } };
  assert.equal(profile.ground.runSpeed, 6.5);
});

test("unknown property paths are rejected without writes", async (context) => {
  const workspace = await createTestWorkspace(context);
  const before = await captureWorkspaceState(workspace.root);
  const result = await setMovementValue(workspace.root, workspace.relativeFile, "ground.teleportSpeed", 9, false);
  assert.equal(result.errors[0]?.code, ErrorCodes.MovementPropertyNotFound);
  assert.deepEqual(diffFileStates(before, await captureWorkspaceState(workspace.root)), []);
});

test("invalid proposed types fail without writes", async (context) => {
  const workspace = await createTestWorkspace(context);
  const before = await captureWorkspaceState(workspace.root);
  const result = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", "fast", false);
  assert.equal(result.errors[0]?.code, ErrorCodes.MovementPropertyValueInvalid);
  assert.deepEqual(diffFileStates(before, await captureWorkspaceState(workspace.root)), []);
});

test("semantic validation failure causes zero target writes", async (context) => {
  const workspace = await createTestWorkspace(context);
  const initial = await readFile(workspace.movementFile, "utf8");
  const result = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 9, false);
  assert.equal(result.status, "failed");
  assert.equal(result.errors[0]?.code, ErrorCodes.MovementSpeedOrderInvalid);
  assert.equal(await readFile(workspace.movementFile, "utf8"), initial);
});

test("dry run returns the candidate and creates no files", async (context) => {
  const workspace = await createTestWorkspace(context);
  const before = await captureWorkspaceState(workspace.root);
  const result = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, true);
  assert.equal(result.status, "dry_run");
  assert.equal(result.snapshotId, null);
  assert.deepEqual(diffFileStates(before, await captureWorkspaceState(workspace.root)), []);
});

test("changed-file audit rejects a path outside the operation allowlist", () => {
  const before = new Map([
    ["examples/movement/default.json", "before"],
    ["unrelated.txt", "before"]
  ]);
  const after = new Map([
    ["examples/movement/default.json", "after"],
    ["unrelated.txt", "after"]
  ]);
  const audit = auditChangedFiles(before, after, ["examples/movement/default.json"]);
  assert.equal(audit.ok, false);
  assert.deepEqual(audit.unexpectedFiles, ["unrelated.txt"]);
});
