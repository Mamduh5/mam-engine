import { validateMovementDefinition } from "../../domain/movement/movementValidation";
import type { MovementProfile } from "../../domain/movement/movementTypes";
import { auditChangedFiles, captureWorkspaceState, resolveWorkspacePath } from "../../infrastructure/files/changedFileAudit";
import { createFileSnapshot, readSnapshot, verifySnapshot, type CreatedSnapshot } from "../../infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationError, type OperationResult } from "../../shared/operationResult";
import {
  transactionalFileReplace,
  type ContentVerification,
  type TransactionalFileReplaceDependencies,
  type TransactionalReplaceFailure
} from "../persistence/transactionalFileReplace";
import { withTargetOperationLock } from "../persistence/targetOperationLock";
import { isLoadedMovement, loadErrors, loadValidMovement } from "../movement/movementOperationSupport";

export interface RollbackSnapshotDependencies {
  createSnapshot: typeof createFileSnapshot;
  transaction: Partial<TransactionalFileReplaceDependencies>;
  verifyContent: (content: string) => ContentVerification<MovementProfile>;
}

const productionDependencies: RollbackSnapshotDependencies = {
  createSnapshot: createFileSnapshot,
  transaction: {},
  verifyContent: verifyMovementContent
};

export async function rollbackSnapshot(
  workspaceRoot: string,
  sourceSnapshotId: string,
  injectedDependencies: Partial<RollbackSnapshotDependencies> = {}
): Promise<OperationResult> {
  const command = "snapshot.rollback";
  const input = { snapshotId: sourceSnapshotId };
  const sourceRecord = await readSnapshot(workspaceRoot, sourceSnapshotId);
  if (sourceRecord === null) {
    return operationResult({
      command,
      status: "failed",
      input,
      errors: [{ code: ErrorCodes.SnapshotNotFound, path: sourceSnapshotId, message: "Snapshot was not found or its metadata is invalid" }]
    });
  }
  if (!verifySnapshot(sourceRecord)) {
    return operationResult({
      command,
      status: "failed",
      input,
      errors: [{ code: ErrorCodes.SnapshotRollbackFailed, path: sourceSnapshotId, message: "Source snapshot content hash verification failed" }]
    });
  }
  const sourceVerification = verifyMovementContent(sourceRecord.previousContent);
  if (!sourceVerification.validationPassed) {
    return operationResult({
      command,
      status: "failed",
      input,
      errors: [{
        code: ErrorCodes.SnapshotRollbackFailed,
        path: sourceRecord.targetPath,
        message: "Source snapshot does not contain a valid movement profile",
        details: { validationErrors: sourceVerification.errors }
      }]
    });
  }

  let target: { absolutePath: string; relativePath: string };
  try {
    target = resolveWorkspacePath(workspaceRoot, sourceRecord.targetPath);
  } catch (caught) {
    return rollbackFailure(input, ErrorCodes.SnapshotRollbackFailed, caught instanceof Error ? caught.message : String(caught));
  }

  const dependencies = {
    ...productionDependencies,
    ...injectedDependencies,
    transaction: { ...productionDependencies.transaction, ...injectedDependencies.transaction }
  };
  return withTargetOperationLock(workspaceRoot, target.relativePath, () =>
    executeRollback(workspaceRoot, sourceSnapshotId, sourceRecord.previousContent, target, dependencies)
  );
}

async function executeRollback(
  workspaceRoot: string,
  sourceSnapshotId: string,
  sourceContent: string,
  target: { absolutePath: string; relativePath: string },
  dependencies: RollbackSnapshotDependencies
): Promise<OperationResult> {
  const command = "snapshot.rollback";
  const input = { snapshotId: sourceSnapshotId };
  const before = await captureWorkspaceState(workspaceRoot);
  const current = await loadValidMovement(workspaceRoot, target.relativePath);
  if (!isLoadedMovement(current)) {
    return operationResult({
      command,
      status: "failed",
      input,
      errors: [{
        code: ErrorCodes.SnapshotPreRollbackFailed,
        path: target.relativePath,
        message: "Current target must be a valid movement profile before rollback",
        details: { validationErrors: loadErrors(current) }
      }]
    });
  }

  let safetySnapshot: CreatedSnapshot;
  try {
    safetySnapshot = await dependencies.createSnapshot(
      workspaceRoot,
      target.relativePath,
      current.content,
      "snapshot.rollback.pre_restore"
    );
  } catch (caught) {
    const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []);
    return operationResult({
      command,
      status: "failed",
      input,
      errors: [{
        code: ErrorCodes.SnapshotPreRollbackFailed,
        path: target.relativePath,
        message: `Pre-rollback safety snapshot could not be created: ${caught instanceof Error ? caught.message : String(caught)}`
      }],
      changedFiles: audit.changedFiles
    });
  }

  const transaction = await transactionalFileReplace({
    workspaceRoot,
    operationStartState: before,
    targetAbsolutePath: target.absolutePath,
    targetRelativePath: target.relativePath,
    replacementContent: sourceContent,
    originalContent: current.content,
    allowedPaths: [target.relativePath, safetySnapshot.relativePath],
    verifyContent: dependencies.verifyContent,
    dependencies: dependencies.transaction
  });

  if (!transaction.ok) {
    return rollbackTransactionFailure(
      input,
      transaction,
      sourceSnapshotId,
      safetySnapshot.record.snapshotId
    );
  }

  return operationResult({
    command,
    status: "rolled_back",
    input,
    data: {
      restoredFile: target.relativePath,
      profile: transaction.value,
      sourceSnapshotId,
      preRollbackSnapshotId: safetySnapshot.record.snapshotId
    },
    changedFiles: transaction.changedFiles,
    snapshotId: safetySnapshot.record.snapshotId
  });
}

function rollbackTransactionFailure(
  input: Record<string, unknown>,
  transaction: TransactionalReplaceFailure,
  sourceSnapshotId: string,
  preRollbackSnapshotId: string
): OperationResult {
  const primaryCode = transaction.failureStage === "scope_audit"
    ? ErrorCodes.SnapshotRollbackScopeAuditFailed
    : ErrorCodes.SnapshotRollbackVerificationFailed;
  const errors: OperationError[] = [{
    code: primaryCode,
    message: transaction.failureMessage,
    details: {
      failureStage: transaction.failureStage,
      unexpectedFiles: transaction.unexpectedFiles,
      verificationErrors: transaction.verificationErrors
    }
  }];
  if (transaction.recovery.status === "failed") {
    errors.push({
      code: ErrorCodes.SnapshotRollbackRecoveryFailed,
      path: transaction.recovery.restoredFile,
      message: "Rollback recovery could not verify the exact pre-rollback target state",
      details: { recovery: transaction.recovery }
    });
  }
  return operationResult({
    command: "snapshot.rollback",
    status: "failed",
    input,
    data: {
      failureStage: transaction.failureStage,
      recovery: transaction.recovery,
      sourceSnapshotId,
      preRollbackSnapshotId
    },
    errors,
    changedFiles: transaction.changedFiles,
    snapshotId: preRollbackSnapshotId
  });
}

function verifyMovementContent(content: string): ContentVerification<MovementProfile> {
  let value: unknown;
  try {
    value = JSON.parse(content) as unknown;
  } catch {
    return { validationPassed: false, errors: [{ code: ErrorCodes.MovementJsonInvalid, message: "Movement content is not valid JSON" }] };
  }
  const validation = validateMovementDefinition(value);
  return validation.valid && validation.profile !== null
    ? { validationPassed: true, value: validation.profile }
    : { validationPassed: false, errors: validation.errors };
}

function rollbackFailure(input: Record<string, unknown>, code: OperationError["code"], message: string): OperationResult {
  return operationResult({
    command: "snapshot.rollback",
    status: "failed",
    input,
    errors: [{ code, message }]
  });
}
