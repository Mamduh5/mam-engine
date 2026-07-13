import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { MovementProfile } from "../../domain/movement/movementTypes";
import { resolveWorkspacePath } from "../../infrastructure/files/changedFileAudit";
import { readSnapshot } from "../../infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError, OperationResult } from "../../shared/operationResult";
import { setMovementValue } from "../movement/setMovementValue";
import { rollbackSnapshot } from "../snapshots/rollbackSnapshot";
import { inspectEditorDefinition, type EditorDefinitionInspection, type EditorDefinitionSummary } from "./editorDefinitionExplorer";

export type EditorPrimitiveType = "number" | "string" | "boolean";
export interface MovementEditorField { path: string; label: string; value: string | number | boolean; valueType: EditorPrimitiveType }
export interface MovementEditModel {
  relativePath: string;
  kind: "movement-profile";
  id: string;
  displayName: string;
  revision: string;
  editableFields: MovementEditorField[];
  readOnlyFields: MovementEditorField[];
  validation: { valid: true; findings: OperationError[] };
}
export interface MovementEditRequest { file: string; expectedRevision: string; path: string; value: unknown }
export interface MovementRollbackRequest { file: string; snapshotId: string; expectedRevision: string }

interface MovementEditContext { model: MovementEditModel; inspection: EditorDefinitionInspection; content: Buffer; profile: MovementProfile }

export class EditorEditError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number, public readonly validationFindings: OperationError[] = []) { super(message); }
}

export async function getMovementEditModel(workspaceRoot: string, inputFile: string): Promise<MovementEditModel> {
  return (await loadContext(workspaceRoot, inputFile)).model;
}

export async function previewMovementEdit(workspaceRoot: string, body: unknown): Promise<Record<string, unknown>> {
  const request = parseEditRequest(body);
  const current = await loadContext(workspaceRoot, request.file);
  assertRevision(current.model.revision, request.expectedRevision);
  assertEditableValue(current.model, request.path, request.value);
  const result = await setMovementValue(workspaceRoot, current.model.relativePath, request.path, request.value, true);
  return {
    previewStatus: result.status === "dry_run" ? "passed" : "failed",
    candidateAuthoredValue: request.value,
    changedPropertyPath: request.path,
    validationFindings: result.errors,
    resultingInspectionSummary: candidateSummary(current.inspection.summary, result),
    currentRevision: current.model.revision
  };
}

export async function saveMovementEdit(workspaceRoot: string, body: unknown): Promise<Record<string, unknown>> {
  const request = parseEditRequest(body);
  return withEditorMutation(workspaceRoot, request.file, async () => {
    const current = await loadContext(workspaceRoot, request.file);
    assertRevision(current.model.revision, request.expectedRevision);
    assertEditableValue(current.model, request.path, request.value);
    const result = await setMovementValue(workspaceRoot, current.model.relativePath, request.path, request.value, false);
    if (result.status !== "passed") {
      return { saveStatus: "failed", previousRevision: current.model.revision, currentRevision: current.model.revision, snapshotId: result.snapshotId, changedFiles: result.changedFiles, savedPropertyPath: request.path, savedValue: request.value, inspection: current.inspection, validationFindings: result.errors };
    }
    const refreshed = await loadContext(workspaceRoot, current.model.relativePath);
    return { saveStatus: "passed", previousRevision: current.model.revision, currentRevision: refreshed.model.revision, snapshotId: result.snapshotId, changedFiles: result.changedFiles, savedPropertyPath: request.path, savedValue: request.value, inspection: refreshed.inspection, validationFindings: refreshed.inspection.validationFindings };
  });
}

export async function rollbackMovementEdit(workspaceRoot: string, body: unknown): Promise<Record<string, unknown>> {
  const request = parseRollbackRequest(body);
  return withEditorMutation(workspaceRoot, request.file, async () => {
    const current = await loadContext(workspaceRoot, request.file);
    assertRevision(current.model.revision, request.expectedRevision);
    const snapshot = await readSnapshot(workspaceRoot, request.snapshotId);
    if (snapshot === null || snapshot.targetPath !== current.model.relativePath || (snapshot.definitionKind !== undefined && snapshot.definitionKind !== "movement-profile")) {
      throw new EditorEditError("EDITOR_SNAPSHOT_MISMATCH", "Snapshot does not apply to the requested movement definition", 400);
    }
    const result = await rollbackSnapshot(workspaceRoot, request.snapshotId);
    if (result.status !== "rolled_back") {
      return { rollbackStatus: "failed", restoredSnapshotId: request.snapshotId, safetySnapshotId: result.snapshotId, previousRevision: current.model.revision, currentRevision: current.model.revision, changedFiles: result.changedFiles, inspection: current.inspection, validationFindings: result.errors };
    }
    const refreshed = await loadContext(workspaceRoot, current.model.relativePath);
    const data = isRecord(result.data) ? result.data : {};
    return { rollbackStatus: "rolled_back", restoredSnapshotId: data.sourceSnapshotId ?? request.snapshotId, safetySnapshotId: data.preRollbackSnapshotId ?? result.snapshotId, previousRevision: current.model.revision, currentRevision: refreshed.model.revision, changedFiles: result.changedFiles, inspection: refreshed.inspection };
  });
}

async function loadContext(workspaceRoot: string, inputFile: string): Promise<MovementEditContext> {
  const inspection = await inspectEditorDefinition(workspaceRoot, inputFile);
  if (inspection.summary.kind !== "movement-profile") throw new EditorEditError("EDITOR_EDIT_UNSUPPORTED", "Only movement-profile editing is supported", 400);
  if (!inspection.summary.valid || !isRecord(inspection.raw)) throw new EditorEditError("EDITOR_DEFINITION_INVALID", "Movement definition must be valid before editing", 422, inspection.validationFindings);
  const resolved = resolveWorkspacePath(workspaceRoot, inputFile);
  const content = await readFile(resolved.absolutePath);
  const fields = inspection.authoredFields.filter((field): field is { path: string; value: string | number | boolean } => isPrimitive(field.value)).map(toEditorField);
  const immutable = new Set(["schemaVersion", "kind", "id"]);
  const readOnlyFields = fields.filter((field) => immutable.has(field.path));
  const editableFields = fields.filter((field) => !immutable.has(field.path));
  const profile = inspection.raw as unknown as MovementProfile;
  return {
    content,
    inspection,
    profile,
    model: {
      relativePath: resolved.relativePath,
      kind: "movement-profile",
      id: profile.id,
      displayName: profile.displayName,
      revision: createHash("sha256").update(content).digest("hex"),
      editableFields,
      readOnlyFields,
      validation: { valid: true, findings: inspection.validationFindings }
    }
  };
}

function parseEditRequest(value: unknown): MovementEditRequest {
  if (!isRecord(value) || typeof value.file !== "string" || typeof value.expectedRevision !== "string" || typeof value.path !== "string" || !("value" in value)) throw new EditorEditError("EDITOR_REQUEST_INVALID", "Edit request must include file, expectedRevision, path, and value", 400);
  return { file: value.file, expectedRevision: value.expectedRevision, path: value.path, value: value.value };
}

function parseRollbackRequest(value: unknown): MovementRollbackRequest {
  if (!isRecord(value) || typeof value.file !== "string" || typeof value.expectedRevision !== "string" || typeof value.snapshotId !== "string") throw new EditorEditError("EDITOR_REQUEST_INVALID", "Rollback request must include file, snapshotId, and expectedRevision", 400);
  return { file: value.file, expectedRevision: value.expectedRevision, snapshotId: value.snapshotId };
}

function assertRevision(current: string, expected: string): void {
  if (current !== expected) throw new EditorEditError("EDITOR_REVISION_CONFLICT", "Definition changed since it was loaded", 409);
}

function assertEditableValue(model: MovementEditModel, propertyPath: string, value: unknown): void {
  const field = model.editableFields.find((candidate) => candidate.path === propertyPath);
  if (field === undefined) throw new EditorEditError("EDITOR_PROPERTY_NOT_EDITABLE", "Property path is not an editable movement primitive", 400, [{ code: ErrorCodes.MovementPropertyNotFound, path: propertyPath, message: "Only existing editable movement properties may be changed" }]);
  if (typeof value !== field.valueType) throw new EditorEditError("EDITOR_VALUE_TYPE_INVALID", `Property '${propertyPath}' requires a ${field.valueType} value`, 400, [{ code: ErrorCodes.MovementPropertyValueInvalid, path: propertyPath, message: `Expected ${field.valueType} value`, actual: typeof value, expected: field.valueType }]);
}

function candidateSummary(current: EditorDefinitionSummary, result: OperationResult): EditorDefinitionSummary {
  const data = isRecord(result.data) ? result.data : {};
  const profile = isRecord(data.profile) ? data.profile : {};
  return { ...current, displayName: typeof profile.displayName === "string" ? profile.displayName : current.displayName, valid: result.status === "dry_run", errorCount: result.errors.length };
}

function toEditorField(field: { path: string; value: string | number | boolean }): MovementEditorField { return { path: field.path, label: fieldLabel(field.path), value: field.value, valueType: primitiveType(field.value) }; }
function primitiveType(value: string | number | boolean): EditorPrimitiveType { return typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string"; }
function fieldLabel(propertyPath: string): string { const leaf = propertyPath.split(".").at(-1) ?? propertyPath; return `${leaf.charAt(0).toUpperCase()}${leaf.slice(1).replace(/([A-Z])/g, " $1").toLowerCase()}`; }
function isPrimitive(value: unknown): value is string | number | boolean { return typeof value === "string" || typeof value === "number" || typeof value === "boolean"; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

const editorMutationQueues = new Map<string, Promise<void>>();
async function withEditorMutation<T>(workspaceRoot: string, inputFile: string, operation: () => Promise<T>): Promise<T> {
  const key = `${workspaceRoot.toLowerCase()}::${inputFile.replaceAll("\\", "/").toLowerCase()}`;
  const previous = editorMutationQueues.get(key) ?? Promise.resolve();
  let release = (): void => undefined;
  const current = new Promise<void>((resolve) => { release = resolve; });
  editorMutationQueues.set(key, current);
  await previous;
  try { return await operation(); }
  finally { release(); if (editorMutationQueues.get(key) === current) editorMutationQueues.delete(key); }
}
