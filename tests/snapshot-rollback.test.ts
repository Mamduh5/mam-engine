import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { setMovementValue } from "../src/application/movement/setMovementValue";
import type { ContentVerification } from "../src/application/persistence/transactionalFileReplace";
import { createSnapshot } from "../src/application/snapshots/createSnapshot";
import { listSnapshots } from "../src/application/snapshots/listSnapshots";
import { rollbackSnapshot } from "../src/application/snapshots/rollbackSnapshot";
import { validateMovementDefinition } from "../src/domain/movement/movementValidation";
import type { MovementProfile } from "../src/domain/movement/movementTypes";
import { auditChangedFiles } from "../src/infrastructure/files/changedFileAudit";
import { atomicWriteText } from "../src/infrastructure/files/jsonFileStore";
import { listSnapshotSummaries, snapshotDirectory } from "../src/infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../src/shared/errorCodes";
import { createTestWorkspace } from "./testUtils";

function verifyMovement(content: string): ContentVerification<MovementProfile> {
  try {
    const validation = validateMovementDefinition(JSON.parse(content) as unknown);
    return validation.valid && validation.profile
      ? { validationPassed: true, value: validation.profile }
      : { validationPassed: false, errors: validation.errors };
  } catch {
    return { validationPassed: false };
  }
}

test("rollback creates a safety snapshot and returns both snapshot identities", async (context) => {
  const workspace = await createTestWorkspace(context);
  const original = await readFile(workspace.movementFile, "utf8");
  const unrelatedPath = `${workspace.root}/unrelated.txt`;
  const unrelated = await readFile(unrelatedPath, "utf8");
  const setResult = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false);
  const sourceSnapshotId = setResult.snapshotId as string;

  const rollback = await rollbackSnapshot(workspace.root, sourceSnapshotId);
  assert.equal(rollback.status, "rolled_back");
  const data = rollback.data as { sourceSnapshotId: string; preRollbackSnapshotId: string };
  assert.equal(data.sourceSnapshotId, sourceSnapshotId);
  assert.equal(data.preRollbackSnapshotId, rollback.snapshotId);
  assert.notEqual(data.preRollbackSnapshotId, sourceSnapshotId);
  assert(rollback.changedFiles.includes(workspace.relativeFile));
  assert(rollback.changedFiles.some((file) => file.startsWith(".mam-engine/snapshots/")));
  assert.equal(await readFile(workspace.movementFile, "utf8"), original);
  assert.equal(await readFile(unrelatedPath, "utf8"), unrelated);
});

test("rolling back to the safety snapshot restores the prior current state", async (context) => {
  const workspace = await createTestWorkspace(context);
  const setResult = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false);
  const updated = await readFile(workspace.movementFile, "utf8");
  const firstRollback = await rollbackSnapshot(workspace.root, setResult.snapshotId as string);
  const safetyId = firstRollback.snapshotId as string;
  const safetyPath = path.join(snapshotDirectory(workspace.root), `${safetyId}.json`);
  const safetyRecordBefore = await readFile(safetyPath, "utf8");

  const secondRollback = await rollbackSnapshot(workspace.root, safetyId);
  assert.equal(secondRollback.status, "rolled_back");
  assert.equal((secondRollback.data as { sourceSnapshotId: string }).sourceSnapshotId, safetyId);
  assert.equal(await readFile(workspace.movementFile, "utf8"), updated);
  assert.equal(await readFile(safetyPath, "utf8"), safetyRecordBefore);
});

test("invalid current target blocks rollback before overwrite", async (context) => {
  const workspace = await createTestWorkspace(context);
  const setResult = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false);
  await writeFile(workspace.movementFile, "{invalid-current", "utf8");
  const invalid = await readFile(workspace.movementFile, "utf8");
  const snapshotsBefore = await listSnapshotSummaries(workspace.root);

  const result = await rollbackSnapshot(workspace.root, setResult.snapshotId as string);
  assert.equal(result.status, "failed");
  assert.equal(result.errors[0]?.code, ErrorCodes.SnapshotPreRollbackFailed);
  assert.equal(await readFile(workspace.movementFile, "utf8"), invalid);
  assert.equal((await listSnapshotSummaries(workspace.root)).length, snapshotsBefore.length);
});

test("pre-rollback snapshot failure causes zero target writes", async (context) => {
  const workspace = await createTestWorkspace(context);
  const setResult = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false);
  const current = await readFile(workspace.movementFile, "utf8");
  const result = await rollbackSnapshot(workspace.root, setResult.snapshotId as string, {
    createSnapshot: async () => { throw new Error("injected snapshot failure"); }
  });
  assert.equal(result.status, "failed");
  assert.equal(result.errors[0]?.code, ErrorCodes.SnapshotPreRollbackFailed);
  assert.equal(await readFile(workspace.movementFile, "utf8"), current);
});

test("post-rollback verification failure recovers the previous current state", async (context) => {
  const workspace = await createTestWorkspace(context);
  const setResult = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false);
  const current = await readFile(workspace.movementFile, "utf8");
  let validations = 0;
  const result = await rollbackSnapshot(workspace.root, setResult.snapshotId as string, {
    verifyContent: (content) => {
      validations += 1;
      return validations === 1 ? { validationPassed: false } : verifyMovement(content);
    }
  });
  assert.equal(result.status, "failed");
  assert.equal(result.errors[0]?.code, ErrorCodes.SnapshotRollbackVerificationFailed);
  assert.equal((result.data as { recovery: { status: string } }).recovery.status, "restored");
  assert.equal(await readFile(workspace.movementFile, "utf8"), current);
});

test("post-rollback scope failure recovers the previous current state", async (context) => {
  const workspace = await createTestWorkspace(context);
  const setResult = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false);
  const current = await readFile(workspace.movementFile, "utf8");
  let audits = 0;
  const result = await rollbackSnapshot(workspace.root, setResult.snapshotId as string, {
    transaction: {
      audit: (before, after, allowed) => {
        audits += 1;
        return audits === 1
          ? { ok: false, changedFiles: [...allowed], unexpectedFiles: ["injected-unexpected.txt"] }
          : auditChangedFiles(before, after, allowed);
      }
    }
  });
  assert.equal(result.status, "failed");
  assert.equal(result.errors[0]?.code, ErrorCodes.SnapshotRollbackScopeAuditFailed);
  assert.equal((result.data as { recovery: { status: string } }).recovery.status, "restored");
  assert.equal(await readFile(workspace.movementFile, "utf8"), current);
});

test("rollback recovery failure is reported explicitly", async (context) => {
  const workspace = await createTestWorkspace(context);
  const setResult = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false);
  let writes = 0;
  const result = await rollbackSnapshot(workspace.root, setResult.snapshotId as string, {
    verifyContent: () => ({ validationPassed: false }),
    transaction: {
      writeText: async (filePath, content) => {
        writes += 1;
        if (writes === 2) {
          throw new Error("injected rollback recovery failure");
        }
        await atomicWriteText(filePath, content);
      }
    }
  });
  assert.equal(result.status, "failed");
  assert(result.errors.some((error) => error.code === ErrorCodes.SnapshotRollbackRecoveryFailed));
  assert.equal((result.data as { recovery: { status: string } }).recovery.status, "failed");
});

test("source snapshot remains unchanged after failed rollback", async (context) => {
  const workspace = await createTestWorkspace(context);
  const setResult = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false);
  const sourceId = setResult.snapshotId as string;
  const sourcePath = path.join(snapshotDirectory(workspace.root), `${sourceId}.json`);
  const before = await readFile(sourcePath, "utf8");
  await rollbackSnapshot(workspace.root, sourceId, { verifyContent: () => ({ validationPassed: false }) });
  assert.equal(await readFile(sourcePath, "utf8"), before);
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
