import { validateMovementDefinition } from "../../domain/movement/movementValidation";
import { auditChangedFiles, captureWorkspaceState, resolveWorkspacePath } from "../../infrastructure/files/changedFileAudit";
import { atomicWriteText, readJsonFile } from "../../infrastructure/files/jsonFileStore";
import { readSnapshot, verifySnapshot } from "../../infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";

export async function rollbackSnapshot(workspaceRoot: string, snapshotId: string): Promise<OperationResult> {
  const command = "snapshot.rollback";
  const input = { snapshotId };
  const record = await readSnapshot(workspaceRoot, snapshotId);
  if (record === null) {
    return operationResult({
      command,
      status: "failed",
      input,
      errors: [{ code: ErrorCodes.SnapshotNotFound, path: snapshotId, message: "Snapshot was not found or its metadata is invalid" }]
    });
  }
  if (!verifySnapshot(record)) {
    return operationResult({
      command,
      status: "failed",
      input,
      errors: [{ code: ErrorCodes.SnapshotRollbackFailed, path: snapshotId, message: "Snapshot content hash verification failed" }]
    });
  }

  let restoredValue: unknown;
  try {
    restoredValue = JSON.parse(record.previousContent) as unknown;
  } catch {
    return invalidSnapshotResult(command, input, "Snapshot does not contain valid JSON");
  }
  const snapshotValidation = validateMovementDefinition(restoredValue);
  if (!snapshotValidation.valid) {
    return operationResult({
      command,
      status: "failed",
      input,
      errors: [{
        code: ErrorCodes.SnapshotRollbackFailed,
        path: record.targetPath,
        message: "Snapshot does not contain a valid movement profile",
        details: { validationErrors: snapshotValidation.errors }
      }]
    });
  }

  let target: { absolutePath: string; relativePath: string };
  try {
    target = resolveWorkspacePath(workspaceRoot, record.targetPath);
  } catch (caught) {
    return invalidSnapshotResult(command, input, caught instanceof Error ? caught.message : String(caught));
  }

  const before = await captureWorkspaceState(workspaceRoot);
  try {
    await atomicWriteText(target.absolutePath, record.previousContent);
  } catch (caught) {
    return invalidSnapshotResult(command, input, `Atomic restore failed: ${caught instanceof Error ? caught.message : String(caught)}`);
  }

  const restored = await readJsonFile(target.absolutePath);
  const validation = validateMovementDefinition(restored.value);
  const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), [target.relativePath]);
  if (!audit.ok) {
    return operationResult({
      command,
      status: "failed",
      input,
      errors: [{
        code: ErrorCodes.SnapshotRollbackFailed,
        message: "Rollback changed files outside its declared scope",
        details: { unexpectedFiles: audit.unexpectedFiles }
      }],
      changedFiles: audit.changedFiles,
      snapshotId
    });
  }
  if (!validation.valid) {
    return operationResult({
      command,
      status: "failed",
      input,
      errors: [{
        code: ErrorCodes.SnapshotRollbackFailed,
        path: target.relativePath,
        message: "Restored movement profile failed validation",
        details: { validationErrors: validation.errors }
      }],
      changedFiles: audit.changedFiles,
      snapshotId
    });
  }
  return operationResult({
    command,
    status: "rolled_back",
    input,
    data: { restoredFile: target.relativePath, profile: validation.profile },
    changedFiles: audit.changedFiles,
    snapshotId
  });
}

function invalidSnapshotResult(command: string, input: Record<string, unknown>, message: string): OperationResult {
  return operationResult({
    command,
    status: "failed",
    input,
    errors: [{ code: ErrorCodes.SnapshotRollbackFailed, message }]
  });
}
