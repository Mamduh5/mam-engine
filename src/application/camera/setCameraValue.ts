import { validateCameraDefinition } from "../../domain/camera/cameraValidation";
import type { CameraProfile } from "../../domain/camera/cameraTypes";
import { auditChangedFiles, captureWorkspaceState, resolveWorkspacePath } from "../../infrastructure/files/changedFileAudit";
import { formatJson } from "../../infrastructure/files/jsonFileStore";
import { createFileSnapshot, type CreatedSnapshot } from "../../infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationError, type OperationResult } from "../../shared/operationResult";
import { transactionalFileReplace, type ContentVerification, type TransactionalFileReplaceDependencies, type TransactionalReplaceFailure } from "../persistence/transactionalFileReplace";
import { withTargetOperationLock } from "../persistence/targetOperationLock";
import { isLoadedCamera, loadValidCamera } from "./cameraOperationSupport";

export interface SetCameraValueDependencies {
  createSnapshot: typeof createFileSnapshot;
  transaction: Partial<TransactionalFileReplaceDependencies>;
  verifyContent: (content: string) => ContentVerification<CameraProfile>;
}
const productionDependencies: SetCameraValueDependencies = { createSnapshot: createFileSnapshot, transaction: {}, verifyContent: verifyCameraContent };

export async function setCameraValue(workspaceRoot: string, inputFile: string, propertyPath: string, value: unknown, dryRun: boolean, injected: Partial<SetCameraValueDependencies> = {}): Promise<OperationResult> {
  const dependencies = { ...productionDependencies, ...injected, transaction: { ...productionDependencies.transaction, ...injected.transaction } };
  if (dryRun) return executeSet(workspaceRoot, inputFile, propertyPath, value, true, dependencies);
  let relativePath: string;
  try { relativePath = resolveWorkspacePath(workspaceRoot, inputFile).relativePath; }
  catch (caught) { return operationResult({ command: "camera.set", status: "failed", input: { file: inputFile, propertyPath, value, dryRun }, errors: [{ code: ErrorCodes.CameraWriteBlocked, path: inputFile, message: caught instanceof Error ? caught.message : String(caught) }] }); }
  return withTargetOperationLock(workspaceRoot, relativePath, () => executeSet(workspaceRoot, inputFile, propertyPath, value, false, dependencies));
}

async function executeSet(workspaceRoot: string, inputFile: string, propertyPath: string, value: unknown, dryRun: boolean, dependencies: SetCameraValueDependencies): Promise<OperationResult> {
  const command = "camera.set"; const input = { file: inputFile, propertyPath, value, dryRun };
  const before = await captureWorkspaceState(workspaceRoot); const loaded = await loadValidCamera(workspaceRoot, inputFile);
  if (!isLoadedCamera(loaded)) return operationResult({ command, status: "failed", input, errors: loaded.errors });
  const candidate = structuredClone(loaded.profile) as CameraProfile;
  const pathError = applyExistingProperty(candidate, propertyPath, value);
  if (pathError) return operationResult({ command, status: "failed", input: { ...input, file: loaded.relativePath }, errors: [pathError] });
  const validation = validateCameraDefinition(candidate);
  if (!validation.valid || validation.profile === null) {
    return operationResult({ command, status: "failed", input: { ...input, file: loaded.relativePath }, errors: validation.errors.map((error) => error.code === ErrorCodes.CameraSchemaInvalid ? { ...error, code: ErrorCodes.CameraPropertyValueInvalid } : error) });
  }
  if (dryRun) {
    const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []);
    if (!audit.ok) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.CameraWriteScopeAuditFailed, message: "Camera dry run changed files outside its zero-write scope", details: { unexpectedFiles: audit.unexpectedFiles } }], changedFiles: audit.changedFiles });
    return operationResult({ command, status: "dry_run", input: { ...input, file: loaded.relativePath }, data: { profile: validation.profile, proposedChange: { path: propertyPath, value } } });
  }
  let snapshot: CreatedSnapshot;
  try { snapshot = await dependencies.createSnapshot(workspaceRoot, loaded.relativePath, loaded.content, command, "camera-profile"); }
  catch (caught) {
    const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []);
    return operationResult({ command, status: "failed", input: { ...input, file: loaded.relativePath }, errors: [{ code: ErrorCodes.CameraWriteBlocked, path: loaded.relativePath, message: `Pre-write snapshot could not be created: ${caught instanceof Error ? caught.message : String(caught)}` }], changedFiles: audit.changedFiles });
  }
  const transaction = await transactionalFileReplace({ workspaceRoot, operationStartState: before, targetAbsolutePath: loaded.absolutePath, targetRelativePath: loaded.relativePath, replacementContent: formatJson(validation.profile), originalContent: loaded.content, allowedPaths: [loaded.relativePath, snapshot.relativePath], verifyContent: dependencies.verifyContent, dependencies: dependencies.transaction });
  if (!transaction.ok) return cameraTransactionFailure(command, { ...input, file: loaded.relativePath }, transaction, snapshot.record.snapshotId);
  return operationResult({ command, status: "passed", input: { ...input, file: loaded.relativePath }, data: { profile: transaction.value, appliedChange: { path: propertyPath, value } }, changedFiles: transaction.changedFiles, snapshotId: snapshot.record.snapshotId });
}

export function verifyCameraContent(content: string): ContentVerification<CameraProfile> {
  let value: unknown;
  try { value = JSON.parse(content) as unknown; }
  catch { return { validationPassed: false, errors: [{ code: ErrorCodes.CameraJsonInvalid, message: "Persisted camera content is not valid JSON" }] }; }
  const validation = validateCameraDefinition(value);
  return validation.valid && validation.profile ? { validationPassed: true, value: validation.profile } : { validationPassed: false, errors: validation.errors };
}

function cameraTransactionFailure(command: string, input: Record<string, unknown>, transaction: TransactionalReplaceFailure, snapshotId: string): OperationResult {
  const errors: OperationError[] = [{ code: transaction.failureStage === "scope_audit" ? ErrorCodes.CameraWriteScopeAuditFailed : ErrorCodes.CameraWriteVerificationFailed, message: transaction.failureMessage, details: { failureStage: transaction.failureStage, unexpectedFiles: transaction.unexpectedFiles, verificationErrors: transaction.verificationErrors } }];
  if (transaction.recovery.status === "failed") errors.push({ code: ErrorCodes.CameraWriteRecoveryFailed, path: transaction.recovery.restoredFile, message: "Camera write recovery could not verify the exact original target state", details: { recovery: transaction.recovery } });
  return operationResult({ command, status: "failed", input, data: { failureStage: transaction.failureStage, recovery: transaction.recovery }, errors, changedFiles: transaction.changedFiles, snapshotId });
}

function applyExistingProperty(profile: CameraProfile, propertyPath: string, value: unknown): OperationError | null {
  const segments = propertyPath.split(".");
  if (segments.length === 0 || segments.some((segment) => !segment || ["__proto__", "prototype", "constructor"].includes(segment))) return propertyNotFound(propertyPath);
  let current = profile as unknown as Record<string, unknown>;
  for (const segment of segments.slice(0, -1)) {
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return propertyNotFound(propertyPath);
    const next = current[segment]; if (typeof next !== "object" || next === null || Array.isArray(next)) return propertyNotFound(propertyPath);
    current = next as Record<string, unknown>;
  }
  const leaf = segments.at(-1) as string;
  if (!Object.prototype.hasOwnProperty.call(current, leaf)) return propertyNotFound(propertyPath);
  current[leaf] = value; return null;
}
function propertyNotFound(path: string): OperationError { return { code: ErrorCodes.CameraPropertyNotFound, path, message: "Only existing schema-defined camera properties may be edited" }; }
