import { JsonFileReadError, readJsonFile } from "../../infrastructure/files/jsonFileStore";
import { resolveWorkspacePath } from "../../infrastructure/files/changedFileAudit";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import { validateDefinition, type DefinitionKind, type SupportedDefinition } from "./definitionValidationRegistry";

export interface LoadedDefinition {
  absolutePath: string;
  relativePath: string;
  content: string;
  kind: DefinitionKind;
  definition: SupportedDefinition;
  schemaVersion: number;
}
export interface LoadDefinitionFailure { errors: OperationError[]; absolutePath?: string; relativePath?: string }

export async function loadValidDefinition(workspaceRoot: string, inputFile: string): Promise<LoadedDefinition | LoadDefinitionFailure> {
  let resolved: { absolutePath: string; relativePath: string };
  try { resolved = resolveWorkspacePath(workspaceRoot, inputFile); }
  catch (caught) { return { errors: [{ code: ErrorCodes.DefinitionFileInvalid, path: inputFile, message: caught instanceof Error ? caught.message : String(caught) }] }; }
  let read: Awaited<ReturnType<typeof readJsonFile>>;
  try { read = await readJsonFile(resolved.absolutePath); }
  catch (caught) {
    if (caught instanceof JsonFileReadError) return { ...resolved, errors: [{ code: caught.kind === "not_found" ? ErrorCodes.DefinitionFileNotFound : ErrorCodes.DefinitionFileInvalid, path: resolved.relativePath, message: caught.message }] };
    throw caught;
  }
  const validation = validateDefinition(read.value);
  if (!validation.valid || validation.definition === null || validation.kind === null || validation.schemaVersion === null) return { ...resolved, errors: validation.errors };
  return { ...resolved, content: read.content, kind: validation.kind, definition: validation.definition, schemaVersion: validation.schemaVersion };
}
export function isLoadedDefinition(value: LoadedDefinition | LoadDefinitionFailure): value is LoadedDefinition { return "definition" in value; }
