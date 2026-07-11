import { validateMovementDefinition } from "../../domain/movement/movementValidation";
import type { MovementProfile } from "../../domain/movement/movementTypes";
import { auditChangedFiles, captureWorkspaceState, resolveWorkspacePath } from "../../infrastructure/files/changedFileAudit";
import { formatJson } from "../../infrastructure/files/jsonFileStore";
import { createFileSnapshot, type CreatedSnapshot } from "../../infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationError, type OperationResult } from "../../shared/operationResult";
import {
  transactionalFileReplace,
  type ContentVerification,
  type TransactionalFileReplaceDependencies,
  type TransactionalReplaceFailure
} from "../persistence/transactionalFileReplace";
import { withTargetOperationLock } from "../persistence/targetOperationLock";
import { isLoadedMovement, loadErrors, loadValidMovement } from "./movementOperationSupport";

export interface SetMovementValueDependencies {
  createSnapshot: typeof createFileSnapshot;
  transaction: Partial<TransactionalFileReplaceDependencies>;
  verifyContent: (content: string) => ContentVerification<MovementProfile>;
}

const productionDependencies: SetMovementValueDependencies = {
  createSnapshot: createFileSnapshot,
  transaction: {},
  verifyContent: verifyMovementContent
};

export async function setMovementValue(
  workspaceRoot: string,
  inputFile: string,
  propertyPath: string,
  value: unknown,
  dryRun: boolean,
  injectedDependencies: Partial<SetMovementValueDependencies> = {}
): Promise<OperationResult> {
  const dependencies = {
    ...productionDependencies,
    ...injectedDependencies,
    transaction: { ...productionDependencies.transaction, ...injectedDependencies.transaction }
  };

  if (dryRun) {
    return executeSet(workspaceRoot, inputFile, propertyPath, value, true, dependencies);
  }

  let targetRelativePath: string;
  try {
    targetRelativePath = resolveWorkspacePath(workspaceRoot, inputFile).relativePath;
  } catch (caught) {
    return operationResult({
      command: "movement.set",
      status: "failed",
      input: { file: inputFile, propertyPath, value, dryRun },
      errors: [{
        code: ErrorCodes.MovementWriteBlocked,
        path: inputFile,
        message: caught instanceof Error ? caught.message : String(caught)
      }]
    });
  }

  return withTargetOperationLock(workspaceRoot, targetRelativePath, () =>
    executeSet(workspaceRoot, inputFile, propertyPath, value, false, dependencies)
  );
}

async function executeSet(
  workspaceRoot: string,
  inputFile: string,
  propertyPath: string,
  value: unknown,
  dryRun: boolean,
  dependencies: SetMovementValueDependencies
): Promise<OperationResult> {
  const command = "movement.set";
  const input = { file: inputFile, propertyPath, value, dryRun };
  const before = await captureWorkspaceState(workspaceRoot);
  const loaded = await loadValidMovement(workspaceRoot, inputFile);
  if (!isLoadedMovement(loaded)) {
    return operationResult({ command, status: "failed", input, errors: loadErrors(loaded) });
  }

  const candidate = structuredClone(loaded.profile) as MovementProfile;
  const pathError = applyExistingProperty(candidate, propertyPath, value);
  if (pathError) {
    return operationResult({ command, status: "failed", input: { ...input, file: loaded.relativePath }, errors: [pathError] });
  }
  const validation = validateMovementDefinition(candidate);
  if (!validation.valid || validation.profile === null) {
    return operationResult({
      command,
      status: "failed",
      input: { ...input, file: loaded.relativePath },
      errors: validation.errors.map((error) => error.code === ErrorCodes.MovementSchemaInvalid
        ? { ...error, code: ErrorCodes.MovementPropertyValueInvalid }
        : error)
    });
  }

  if (dryRun) {
    const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []);
    if (!audit.ok) {
      return operationResult({
        command,
        status: "failed",
        input,
        errors: [{
          code: ErrorCodes.MovementWriteScopeAuditFailed,
          message: "Dry-run operation changed files outside its zero-write scope",
          details: { unexpectedFiles: audit.unexpectedFiles }
        }],
        changedFiles: audit.changedFiles
      });
    }
    return operationResult({
      command,
      status: "dry_run",
      input: { ...input, file: loaded.relativePath },
      data: { profile: validation.profile, proposedChange: { path: propertyPath, value } }
    });
  }

  let snapshot: CreatedSnapshot;
  try {
    snapshot = await dependencies.createSnapshot(workspaceRoot, loaded.relativePath, loaded.content, command, "movement-profile");
  } catch (caught) {
    const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []);
    return operationResult({
      command,
      status: "failed",
      input: { ...input, file: loaded.relativePath },
      errors: [{
        code: ErrorCodes.MovementWriteBlocked,
        path: loaded.relativePath,
        message: `Pre-write snapshot could not be created: ${caught instanceof Error ? caught.message : String(caught)}`
      }],
      changedFiles: audit.changedFiles
    });
  }

  const transaction = await transactionalFileReplace({
    workspaceRoot,
    operationStartState: before,
    targetAbsolutePath: loaded.absolutePath,
    targetRelativePath: loaded.relativePath,
    replacementContent: formatJson(validation.profile),
    originalContent: loaded.content,
    allowedPaths: [loaded.relativePath, snapshot.relativePath],
    verifyContent: dependencies.verifyContent,
    dependencies: dependencies.transaction
  });

  if (!transaction.ok) {
    return movementTransactionFailure(command, { ...input, file: loaded.relativePath }, transaction, snapshot.record.snapshotId);
  }

  return operationResult({
    command,
    status: "passed",
    input: { ...input, file: loaded.relativePath },
    data: { profile: transaction.value, appliedChange: { path: propertyPath, value } },
    changedFiles: transaction.changedFiles,
    snapshotId: snapshot.record.snapshotId
  });
}

function verifyMovementContent(content: string): ContentVerification<MovementProfile> {
  let value: unknown;
  try {
    value = JSON.parse(content) as unknown;
  } catch {
    return { validationPassed: false, errors: [{ code: ErrorCodes.MovementJsonInvalid, message: "Persisted movement content is not valid JSON" }] };
  }
  const validation = validateMovementDefinition(value);
  return validation.valid && validation.profile !== null
    ? { validationPassed: true, value: validation.profile }
    : { validationPassed: false, errors: validation.errors };
}

function movementTransactionFailure(
  command: string,
  input: Record<string, unknown>,
  transaction: TransactionalReplaceFailure,
  snapshotId: string
): OperationResult {
  const primaryCode = transaction.failureStage === "scope_audit"
    ? ErrorCodes.MovementWriteScopeAuditFailed
    : ErrorCodes.MovementWriteVerificationFailed;
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
      code: ErrorCodes.MovementWriteRecoveryFailed,
      path: transaction.recovery.restoredFile,
      message: "Movement write recovery could not verify the exact original target state",
      details: { recovery: transaction.recovery }
    });
  }
  return operationResult({
    command,
    status: "failed",
    input,
    data: { failureStage: transaction.failureStage, recovery: transaction.recovery },
    errors,
    changedFiles: transaction.changedFiles,
    snapshotId
  });
}

function applyExistingProperty(profile: MovementProfile, propertyPath: string, value: unknown): OperationError | null {
  const segments = propertyPath.split(".");
  if (segments.length === 0 || segments.some((segment) => !segment || ["__proto__", "prototype", "constructor"].includes(segment))) {
    return propertyNotFound(propertyPath);
  }
  let current: Record<string, unknown> = profile as unknown as Record<string, unknown>;
  for (const segment of segments.slice(0, -1)) {
    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      return propertyNotFound(propertyPath);
    }
    const next = current[segment];
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      return propertyNotFound(propertyPath);
    }
    current = next as Record<string, unknown>;
  }
  const leaf = segments.at(-1) as string;
  if (!Object.prototype.hasOwnProperty.call(current, leaf)) {
    return propertyNotFound(propertyPath);
  }
  current[leaf] = value;
  return null;
}

function propertyNotFound(propertyPath: string): OperationError {
  return {
    code: ErrorCodes.MovementPropertyNotFound,
    path: propertyPath,
    message: "Only existing schema-defined movement properties may be edited"
  };
}
