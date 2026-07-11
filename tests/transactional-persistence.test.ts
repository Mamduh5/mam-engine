import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { inspectMovement } from "../src/application/movement/inspectMovement";
import { setMovementValue } from "../src/application/movement/setMovementValue";
import type { ContentVerification } from "../src/application/persistence/transactionalFileReplace";
import { validateMovementDefinition } from "../src/domain/movement/movementValidation";
import type { MovementProfile } from "../src/domain/movement/movementTypes";
import { auditChangedFiles } from "../src/infrastructure/files/changedFileAudit";
import { atomicWriteText } from "../src/infrastructure/files/jsonFileStore";
import { listSnapshotSummaries } from "../src/infrastructure/snapshots/fileSnapshotStore";
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

test("atomic write failure leaves the original target and retained snapshot", async (context) => {
  const workspace = await createTestWorkspace(context);
  const original = await readFile(workspace.movementFile, "utf8");
  const unrelated = await readFile(`${workspace.root}/unrelated.txt`, "utf8");
  const result = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false, {
    transaction: { writeText: async () => { throw new Error("injected atomic write failure"); } }
  });

  assert.equal(result.status, "failed");
  assert.equal(result.errors[0]?.code, ErrorCodes.MovementWriteVerificationFailed);
  assert.equal((result.data as { recovery: { status: string } }).recovery.status, "not_required");
  assert.equal(await readFile(workspace.movementFile, "utf8"), original);
  assert.equal(await readFile(`${workspace.root}/unrelated.txt`, "utf8"), unrelated);
  assert.equal((await listSnapshotSummaries(workspace.root)).length, 1);
});

test("post-write read failure restores exact original content", async (context) => {
  const workspace = await createTestWorkspace(context);
  const original = await readFile(workspace.movementFile, "utf8");
  let reads = 0;
  const result = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false, {
    transaction: {
      readText: async (filePath) => {
        reads += 1;
        if (reads === 1) {
          throw new Error("injected post-write read failure");
        }
        return readFile(filePath, "utf8");
      }
    }
  });

  assert.equal(result.status, "failed");
  assert.equal((result.data as { failureStage: string }).failureStage, "post_write_read");
  assert.equal((result.data as { recovery: { status: string } }).recovery.status, "restored");
  assert.equal(await readFile(workspace.movementFile, "utf8"), original);
});

test("post-write validation failure restores exact original content and reports recovery", async (context) => {
  const workspace = await createTestWorkspace(context);
  const original = await readFile(workspace.movementFile, "utf8");
  let validations = 0;
  const result = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false, {
    verifyContent: (content) => {
      validations += 1;
      return validations === 1 ? { validationPassed: false } : verifyMovement(content);
    }
  });

  assert.equal(result.status, "failed");
  assert.equal(result.errors[0]?.code, ErrorCodes.MovementWriteVerificationFailed);
  const data = result.data as { failureStage: string; recovery: { status: string; contentHashVerified: boolean; validationPassed: boolean } };
  assert.equal(data.failureStage, "post_write_validation");
  assert.deepEqual(data.recovery, {
    attempted: true,
    status: "restored",
    restoredFile: workspace.relativeFile,
    contentHashVerified: true,
    validationPassed: true,
    scopeAuditPassed: true
  });
  assert.equal(await readFile(workspace.movementFile, "utf8"), original);
  assert.equal((await listSnapshotSummaries(workspace.root)).length, 1);
});

test("post-write audit failure restores exact original content", async (context) => {
  const workspace = await createTestWorkspace(context);
  const original = await readFile(workspace.movementFile, "utf8");
  let audits = 0;
  const result = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false, {
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
  assert.equal(result.errors[0]?.code, ErrorCodes.MovementWriteScopeAuditFailed);
  assert.equal((result.data as { recovery: { status: string } }).recovery.status, "restored");
  assert.equal(await readFile(workspace.movementFile, "utf8"), original);
});

test("recovery write failure is reported explicitly", async (context) => {
  const workspace = await createTestWorkspace(context);
  let writes = 0;
  const result = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false, {
    verifyContent: () => ({ validationPassed: false }),
    transaction: {
      writeText: async (filePath, content) => {
        writes += 1;
        if (writes === 2) {
          throw new Error("injected recovery write failure");
        }
        await atomicWriteText(filePath, content);
      }
    }
  });

  assert.equal(result.status, "failed");
  assert(result.errors.some((error) => error.code === ErrorCodes.MovementWriteRecoveryFailed));
  assert.equal((result.data as { recovery: { status: string } }).recovery.status, "failed");
});

test("recovery validation failure is reported even when original bytes are restored", async (context) => {
  const workspace = await createTestWorkspace(context);
  const original = await readFile(workspace.movementFile, "utf8");
  const result = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false, {
    verifyContent: () => ({ validationPassed: false })
  });

  assert.equal(result.status, "failed");
  assert(result.errors.some((error) => error.code === ErrorCodes.MovementWriteRecoveryFailed));
  assert.equal((result.data as { recovery: { contentHashVerified: boolean; validationPassed: boolean } }).recovery.contentHashVerified, true);
  assert.equal((result.data as { recovery: { validationPassed: boolean } }).recovery.validationPassed, false);
  assert.equal(await readFile(workspace.movementFile, "utf8"), original);
});

test("same-target writes serialize and the lock releases after success", async (context) => {
  const workspace = await createTestWorkspace(context);
  let activeWrites = 0;
  let maximumActiveWrites = 0;
  const delayedWrite = async (filePath: string, content: string) => {
    activeWrites += 1;
    maximumActiveWrites = Math.max(maximumActiveWrites, activeWrites);
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    await atomicWriteText(filePath, content);
    activeWrites -= 1;
  };

  const [first, second] = await Promise.all([
    setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6, false, { transaction: { writeText: delayedWrite } }),
    setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false, { transaction: { writeText: delayedWrite } })
  ]);
  assert.equal(first.status, "passed");
  assert.equal(second.status, "passed");
  assert.equal(maximumActiveWrites, 1);
  const profile = JSON.parse(await readFile(workspace.movementFile, "utf8")) as MovementProfile;
  assert.equal(profile.ground.runSpeed, 6.5);
});

test("same-target lock releases after failure", async (context) => {
  const workspace = await createTestWorkspace(context);
  const failed = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6, false, {
    transaction: { writeText: async () => { throw new Error("injected failure"); } }
  });
  const succeeded = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false);
  assert.equal(failed.status, "failed");
  assert.equal(succeeded.status, "passed");
});

test("read-only inspection remains available while a write holds the target lock", async (context) => {
  const workspace = await createTestWorkspace(context);
  let releaseWrite: () => void = () => undefined;
  let announceWrite: () => void = () => undefined;
  const writeStarted = new Promise<void>((resolve) => { announceWrite = resolve; });
  const waitForRelease = new Promise<void>((resolve) => { releaseWrite = resolve; });
  const pendingWrite = setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false, {
    transaction: {
      writeText: async (filePath, content) => {
        announceWrite();
        await waitForRelease;
        await atomicWriteText(filePath, content);
      }
    }
  });
  await writeStarted;
  const inspection = await inspectMovement(workspace.root, workspace.relativeFile);
  assert.equal(inspection.status, "passed");
  releaseWrite();
  assert.equal((await pendingWrite).status, "passed");
});
