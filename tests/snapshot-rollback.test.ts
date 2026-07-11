import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { setMovementValue } from "../src/application/movement/setMovementValue";
import { createSnapshot } from "../src/application/snapshots/createSnapshot";
import { listSnapshots } from "../src/application/snapshots/listSnapshots";
import { rollbackSnapshot } from "../src/application/snapshots/rollbackSnapshot";
import { ErrorCodes } from "../src/shared/errorCodes";
import { createTestWorkspace } from "./testUtils";

test("rollback restores exact prior content and leaves unrelated files unchanged", async (context) => {
  const workspace = await createTestWorkspace(context);
  const original = await readFile(workspace.movementFile, "utf8");
  const unrelatedPath = `${workspace.root}/unrelated.txt`;
  const unrelated = await readFile(unrelatedPath, "utf8");
  const setResult = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false);
  assert.equal(typeof setResult.snapshotId, "string");

  const rollback = await rollbackSnapshot(workspace.root, setResult.snapshotId as string);
  assert.equal(rollback.status, "rolled_back");
  assert.deepEqual(rollback.changedFiles, [workspace.relativeFile]);
  assert.equal(await readFile(workspace.movementFile, "utf8"), original);
  assert.equal(await readFile(unrelatedPath, "utf8"), unrelated);
});

test("unknown snapshots fail cleanly", async (context) => {
  const workspace = await createTestWorkspace(context);
  const result = await rollbackSnapshot(workspace.root, "does-not-exist");
  assert.equal(result.status, "failed");
  assert.equal(result.errors[0]?.code, ErrorCodes.SnapshotNotFound);
  assert.deepEqual(result.changedFiles, []);
});

test("explicit snapshot creation does not modify the target and appears in listing", async (context) => {
  const workspace = await createTestWorkspace(context);
  const original = await readFile(workspace.movementFile, "utf8");
  const created = await createSnapshot(workspace.root, workspace.relativeFile);
  assert.equal(created.status, "passed");
  assert.equal(await readFile(workspace.movementFile, "utf8"), original);
  assert.equal(created.changedFiles.length, 1);

  const listed = await listSnapshots(workspace.root);
  assert.equal(listed.status, "passed");
  const snapshots = (listed.data as { snapshots: Array<{ snapshotId: string }> }).snapshots;
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.snapshotId, created.snapshotId);
  assert.deepEqual(listed.changedFiles, []);
});
