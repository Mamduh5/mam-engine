import type { DefinitionKind } from "../../domain/definitions/definitionTypes";
import { auditChangedFiles, captureWorkspaceState, resolveWorkspacePath } from "../../infrastructure/files/changedFileAudit";
import { createFileSnapshot, readSnapshot, verifySnapshot, type CreatedSnapshot } from "../../infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationError, type OperationResult } from "../../shared/operationResult";
import { verifyDefinitionContent, type SupportedDefinition } from "../definitions/definitionValidationRegistry";
import { isLoadedDefinition, loadValidDefinition } from "../definitions/loadValidDefinition";
import { transactionalFileReplace, type ContentVerification, type TransactionalFileReplaceDependencies, type TransactionalReplaceFailure } from "../persistence/transactionalFileReplace";
import { withTargetOperationLock } from "../persistence/targetOperationLock";

export interface RollbackSnapshotDependencies {
  createSnapshot: typeof createFileSnapshot;
  transaction: Partial<TransactionalFileReplaceDependencies>;
  verifyContent?: (content: string) => ContentVerification<SupportedDefinition>;
}

export async function rollbackSnapshot(workspaceRoot: string, sourceSnapshotId: string, injected: Partial<RollbackSnapshotDependencies> = {}): Promise<OperationResult> {
  const command = "snapshot.rollback"; const input = { snapshotId: sourceSnapshotId };
  const sourceRecord = await readSnapshot(workspaceRoot, sourceSnapshotId);
  if (sourceRecord === null) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.SnapshotNotFound, path: sourceSnapshotId, message: "Snapshot was not found or its metadata is invalid" }] });
  if (!verifySnapshot(sourceRecord)) return rollbackFailure(input, ErrorCodes.SnapshotRollbackFailed, "Source snapshot content hash verification failed");
  const sourceVerification = verifyDefinitionContent(sourceRecord.previousContent);
  if (!sourceVerification.validationPassed || sourceVerification.value === undefined) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.SnapshotRollbackFailed, path: sourceRecord.targetPath, message: "Source snapshot does not contain a supported valid definition", details: { validationErrors: sourceVerification.errors } }] });
  const sourceKind = sourceVerification.value.kind as DefinitionKind;
  if (sourceRecord.definitionKind !== undefined && sourceRecord.definitionKind !== sourceKind) return rollbackFailure(input, ErrorCodes.SnapshotRollbackFailed, "Snapshot definition-kind metadata does not match its validated content");
  let target: { absolutePath: string; relativePath: string };
  try { target = resolveWorkspacePath(workspaceRoot, sourceRecord.targetPath); }
  catch (caught) { return rollbackFailure(input, ErrorCodes.SnapshotRollbackFailed, caught instanceof Error ? caught.message : String(caught)); }
  const dependencies: RollbackSnapshotDependencies = {
    createSnapshot: injected.createSnapshot ?? createFileSnapshot,
    transaction: { ...injected.transaction },
    ...(injected.verifyContent === undefined ? {} : { verifyContent: injected.verifyContent })
  };
  return withTargetOperationLock(workspaceRoot, target.relativePath, () => executeRollback(workspaceRoot, sourceSnapshotId, sourceRecord.previousContent, sourceKind, target, dependencies));
}

async function executeRollback(workspaceRoot: string, sourceSnapshotId: string, sourceContent: string, sourceKind: DefinitionKind, target: { absolutePath: string; relativePath: string }, dependencies: RollbackSnapshotDependencies): Promise<OperationResult> {
  const command = "snapshot.rollback"; const input = { snapshotId: sourceSnapshotId }; const before = await captureWorkspaceState(workspaceRoot);
  const current = await loadValidDefinition(workspaceRoot, target.relativePath);
  if (!isLoadedDefinition(current)) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.SnapshotPreRollbackFailed, path: target.relativePath, message: "Current target must be a supported valid definition before rollback", details: { validationErrors: current.errors } }] });
  if (current.kind !== sourceKind) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.SnapshotRollbackFailed, path: "kind", message: "Snapshot and current target definition kinds must match", actual: sourceKind, expected: current.kind }] });
  let safetySnapshot: CreatedSnapshot;
  try { safetySnapshot = await dependencies.createSnapshot(workspaceRoot, target.relativePath, current.content, "snapshot.rollback.pre_restore", current.kind); }
  catch (caught) {
    const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []);
    return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.SnapshotPreRollbackFailed, path: target.relativePath, message: `Pre-rollback safety snapshot could not be created: ${caught instanceof Error ? caught.message : String(caught)}` }], changedFiles: audit.changedFiles });
  }
  const verifyContent = dependencies.verifyContent ?? ((content: string) => verifyDefinitionContent(content, sourceKind));
  const transaction = await transactionalFileReplace({ workspaceRoot, operationStartState: before, targetAbsolutePath: target.absolutePath, targetRelativePath: target.relativePath, replacementContent: sourceContent, originalContent: current.content, allowedPaths: [target.relativePath, safetySnapshot.relativePath], verifyContent, dependencies: dependencies.transaction });
  if (!transaction.ok) return rollbackTransactionFailure(input, transaction, sourceSnapshotId, safetySnapshot.record.snapshotId);
  return operationResult({ command, status: "rolled_back", input, data: { restoredFile: target.relativePath, profile: transaction.value, definitionKind: sourceKind, sourceSnapshotId, preRollbackSnapshotId: safetySnapshot.record.snapshotId }, changedFiles: transaction.changedFiles, snapshotId: safetySnapshot.record.snapshotId });
}

function rollbackTransactionFailure(input: Record<string, unknown>, transaction: TransactionalReplaceFailure, sourceSnapshotId: string, preRollbackSnapshotId: string): OperationResult {
  const errors: OperationError[] = [{ code: transaction.failureStage === "scope_audit" ? ErrorCodes.SnapshotRollbackScopeAuditFailed : ErrorCodes.SnapshotRollbackVerificationFailed, message: transaction.failureMessage, details: { failureStage: transaction.failureStage, unexpectedFiles: transaction.unexpectedFiles, verificationErrors: transaction.verificationErrors } }];
  if (transaction.recovery.status === "failed") errors.push({ code: ErrorCodes.SnapshotRollbackRecoveryFailed, path: transaction.recovery.restoredFile, message: "Rollback recovery could not verify the exact pre-rollback target state", details: { recovery: transaction.recovery } });
  return operationResult({ command: "snapshot.rollback", status: "failed", input, data: { failureStage: transaction.failureStage, recovery: transaction.recovery, sourceSnapshotId, preRollbackSnapshotId }, errors, changedFiles: transaction.changedFiles, snapshotId: preRollbackSnapshotId });
}
function rollbackFailure(input: Record<string, unknown>, code: OperationError["code"], message: string): OperationResult { return operationResult({ command: "snapshot.rollback", status: "failed", input, errors: [{ code, message }] }); }
