import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { resolveWorkspacePath, toRepositoryPath } from "../../infrastructure/files/changedFileAudit";
import type { OperationError, OperationResult } from "../../shared/operationResult";
import { inspectRegisteredDefinition } from "../definitions/definitionInspectionRegistry";
import { SUPPORTED_DEFINITION_KINDS, type DefinitionKind } from "../definitions/definitionValidationRegistry";

export const EDITOR_PROTOCOL_VERSION = "mam.editor/v1";
const protectedDirectories = new Set([".git", ".mam-engine", "node_modules", "dist"]);
const supportedKinds = new Set<string>(SUPPORTED_DEFINITION_KINDS);

export interface EditorResolvedReference { field: string; relativePath: string }
export interface EditorUnresolvedReference { field: string | null; authoredPath: string | null; code: string; message: string }
export interface EditorDefinitionSummary {
  relativePath: string;
  kind: DefinitionKind;
  schemaVersion: number | null;
  id: string | null;
  displayName: string | null;
  valid: boolean;
  errorCount: number;
  referencedRelativePaths: string[];
  unresolvedReferenceCount: number;
}
export interface EditorAuthoredField { path: string; value: unknown }
export interface EditorDefinitionInspection {
  summary: EditorDefinitionSummary;
  authoredFields: EditorAuthoredField[];
  validationFindings: OperationError[];
  resolvedReferences: EditorResolvedReference[];
  unresolvedReferences: EditorUnresolvedReference[];
  raw: unknown;
}

export class EditorInspectionError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export async function discoverEditorDefinitions(workspaceRoot: string): Promise<EditorDefinitionSummary[]> {
  const files: string[] = [];
  await visit(path.resolve(workspaceRoot), path.resolve(workspaceRoot), files);
  const definitions: EditorDefinitionSummary[] = [];
  for (const relativePath of files) {
    const raw = await parseCandidate(path.join(workspaceRoot, relativePath));
    const kind = definitionKind(raw);
    if (kind === null) continue;
    definitions.push((await inspectEditorDefinition(workspaceRoot, relativePath, raw)).summary);
  }
  return definitions.sort((left, right) => compare(left.relativePath, right.relativePath));
}

export async function inspectEditorDefinition(workspaceRoot: string, inputFile: string, suppliedRaw?: unknown): Promise<EditorDefinitionInspection> {
  if (path.isAbsolute(inputFile)) throw new EditorInspectionError("EDITOR_PATH_INVALID", "Definition path must be workspace-relative");
  let resolved: { absolutePath: string; relativePath: string };
  try { resolved = resolveWorkspacePath(workspaceRoot, inputFile); }
  catch { throw new EditorInspectionError("EDITOR_PATH_INVALID", "Definition path must identify an unprotected JSON file inside the workspace"); }
  let raw = suppliedRaw;
  if (raw === undefined) {
    let content: string;
    try { content = await readFile(resolved.absolutePath, "utf8"); }
    catch { throw new EditorInspectionError("EDITOR_DEFINITION_NOT_FOUND", "Definition file could not be read"); }
    try { raw = JSON.parse(content) as unknown; }
    catch { throw new EditorInspectionError("EDITOR_DEFINITION_INVALID_JSON", "Definition file contains malformed JSON"); }
  }
  const kind = definitionKind(raw);
  if (kind === null) throw new EditorInspectionError("EDITOR_DEFINITION_UNSUPPORTED", "Definition kind is not supported");
  const inspection = await inspectRegisteredDefinition(workspaceRoot, resolved.relativePath, kind);
  const resolvedReferences = collectResolvedReferences(inspection);
  const unresolvedReferences = collectUnresolvedReferences(inspection.errors);
  return {
    summary: summarize(resolved.relativePath, kind, raw, inspection, resolvedReferences, unresolvedReferences),
    authoredFields: collectAuthoredFields(raw),
    validationFindings: inspection.errors,
    resolvedReferences,
    unresolvedReferences,
    raw
  };
}

async function visit(root: string, directory: string, files: string[]): Promise<void> {
  let entries: Dirent[];
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (caught) { if (isEnoent(caught)) return; throw caught; }
  entries.sort((left, right) => compare(left.name, right.name));
  for (const entry of entries) {
    if (entry.isDirectory() && protectedDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(root, absolute, files);
    else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".json") files.push(toRepositoryPath(root, absolute));
  }
}

async function parseCandidate(absolutePath: string): Promise<unknown> {
  try { return JSON.parse(await readFile(absolutePath, "utf8")) as unknown; }
  catch { return null; }
}

function definitionKind(value: unknown): DefinitionKind | null {
  if (!isRecord(value) || typeof value.kind !== "string" || !supportedKinds.has(value.kind)) return null;
  return value.kind as DefinitionKind;
}

function summarize(relativePath: string, kind: DefinitionKind, raw: unknown, inspection: OperationResult, resolved: EditorResolvedReference[], unresolved: EditorUnresolvedReference[]): EditorDefinitionSummary {
  const record = isRecord(raw) ? raw : {};
  return {
    relativePath,
    kind,
    schemaVersion: typeof record.schemaVersion === "number" ? record.schemaVersion : null,
    id: typeof record.id === "string" ? record.id : null,
    displayName: typeof record.displayName === "string" ? record.displayName : null,
    valid: inspection.status === "passed",
    errorCount: inspection.errors.length,
    referencedRelativePaths: [...new Set(resolved.map((reference) => reference.relativePath))].sort(compare),
    unresolvedReferenceCount: unresolved.length
  };
}

function collectResolvedReferences(inspection: OperationResult): EditorResolvedReference[] {
  if (!isRecord(inspection.data) || !("resolvedDefinitionPaths" in inspection.data)) return [];
  const references: EditorResolvedReference[] = [];
  flattenStrings(inspection.data.resolvedDefinitionPaths, "", references);
  return references.sort((left, right) => compare(left.field, right.field));
}

function flattenStrings(value: unknown, field: string, output: EditorResolvedReference[]): void {
  if (typeof value === "string") { output.push({ field, relativePath: value }); return; }
  if (Array.isArray(value)) { value.forEach((entry, index) => flattenStrings(entry, field ? `${field}.${index}` : String(index), output)); return; }
  if (isRecord(value)) for (const [key, entry] of Object.entries(value)) flattenStrings(entry, field ? `${field}.${key}` : key, output);
}

function collectUnresolvedReferences(errors: OperationError[]): EditorUnresolvedReference[] {
  return errors.filter((error) => String(error.code).includes("REFERENCE_INVALID")).map((error) => ({ field: error.path ?? null, authoredPath: typeof error.actual === "string" ? error.actual : null, code: error.code, message: error.message }));
}

function collectAuthoredFields(value: unknown): EditorAuthoredField[] {
  const fields: EditorAuthoredField[] = [];
  flattenFields(value, "", fields);
  return fields;
}

function flattenFields(value: unknown, currentPath: string, output: EditorAuthoredField[]): void {
  if (Array.isArray(value)) { if (value.length === 0) output.push({ path: currentPath, value }); else value.forEach((entry, index) => flattenFields(entry, `${currentPath}.${index}`, output)); return; }
  if (isRecord(value)) { const entries = Object.entries(value); if (entries.length === 0) output.push({ path: currentPath, value }); else for (const [key, entry] of entries) flattenFields(entry, currentPath ? `${currentPath}.${key}` : key, output); return; }
  output.push({ path: currentPath, value });
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function compare(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
function isEnoent(caught: unknown): boolean { return typeof caught === "object" && caught !== null && "code" in caught && (caught as NodeJS.ErrnoException).code === "ENOENT"; }
