import { validateMovementDefinition } from "../../domain/movement/movementValidation";
import type { MovementProfile } from "../../domain/movement/movementTypes";
import { auditChangedFiles, captureWorkspaceState } from "../../infrastructure/files/changedFileAudit";
import { atomicWriteText, formatJson, readJsonFile } from "../../infrastructure/files/jsonFileStore";
import { createFileSnapshot } from "../../infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationError, type OperationResult } from "../../shared/operationResult";
import { isLoadedMovement, loadErrors, loadValidMovement } from "./movementOperationSupport";

export async function setMovementValue(
  workspaceRoot: string,
  inputFile: string,
  propertyPath: string,
  value: unknown,
  dryRun: boolean
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
      return unexpectedChangeResult(command, input, audit.changedFiles, audit.unexpectedFiles);
    }
    return operationResult({
      command,
      status: "dry_run",
      input: { ...input, file: loaded.relativePath },
      data: { profile: validation.profile, proposedChange: { path: propertyPath, value } }
    });
  }

  let snapshot: Awaited<ReturnType<typeof createFileSnapshot>> | undefined;
  try {
    snapshot = await createFileSnapshot(workspaceRoot, loaded.relativePath, loaded.content, command);
    await atomicWriteText(loaded.absolutePath, formatJson(validation.profile));
  } catch (caught) {
    const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), snapshot ? [snapshot.relativePath] : []);
    return operationResult({
      command,
      status: "failed",
      input: { ...input, file: loaded.relativePath },
      errors: [{
        code: ErrorCodes.MovementWriteBlocked,
        path: loaded.relativePath,
        message: `Movement profile could not be written atomically: ${caught instanceof Error ? caught.message : String(caught)}`
      }],
      changedFiles: audit.changedFiles,
      snapshotId: snapshot?.record.snapshotId ?? null
    });
  }

  const persisted = await readJsonFile(loaded.absolutePath);
  const persistedValidation = validateMovementDefinition(persisted.value);
  const after = await captureWorkspaceState(workspaceRoot);
  const audit = auditChangedFiles(before, after, [loaded.relativePath, snapshot.relativePath]);
  if (!audit.ok) {
    return unexpectedChangeResult(command, { ...input, file: loaded.relativePath }, audit.changedFiles, audit.unexpectedFiles, snapshot.record.snapshotId);
  }
  if (!persistedValidation.valid) {
    return operationResult({
      command,
      status: "failed",
      input: { ...input, file: loaded.relativePath },
      errors: persistedValidation.errors,
      changedFiles: audit.changedFiles,
      snapshotId: snapshot.record.snapshotId
    });
  }
  return operationResult({
    command,
    status: "passed",
    input: { ...input, file: loaded.relativePath },
    data: { profile: persistedValidation.profile, appliedChange: { path: propertyPath, value } },
    changedFiles: audit.changedFiles,
    snapshotId: snapshot.record.snapshotId
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

function unexpectedChangeResult(
  command: string,
  input: Record<string, unknown>,
  changedFiles: string[],
  unexpectedFiles: string[],
  snapshotId: string | null = null
): OperationResult {
  return operationResult({
    command,
    status: "failed",
    input,
    errors: [{
      code: ErrorCodes.MovementWriteBlocked,
      message: "Operation changed files outside its declared write scope",
      details: { unexpectedFiles }
    }],
    changedFiles,
    snapshotId
  });
}
