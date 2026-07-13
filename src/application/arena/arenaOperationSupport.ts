import type { ArenaProfile } from "../../domain/arena/arenaTypes";
import { validateArenaDefinition } from "../../domain/arena/arenaValidation";
import { resolveWorkspacePath } from "../../infrastructure/files/changedFileAudit";
import { JsonFileReadError, readJsonFile } from "../../infrastructure/files/jsonFileStore";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";

export interface LoadedArena { absolutePath: string; relativePath: string; content: string; profile: ArenaProfile }
export interface LoadArenaFailure { errors: OperationError[]; absolutePath?: string; relativePath?: string }

export async function loadValidArena(workspaceRoot: string, inputFile: string): Promise<LoadedArena | LoadArenaFailure> {
  let resolved: { absolutePath: string; relativePath: string }; try { resolved = resolveWorkspacePath(workspaceRoot, inputFile); } catch (caught) { return { errors: [{ code: ErrorCodes.ArenaWriteBlocked, path: inputFile, message: caught instanceof Error ? caught.message : String(caught) }] }; }
  let read: Awaited<ReturnType<typeof readJsonFile>>; try { read = await readJsonFile(resolved.absolutePath); } catch (caught) { if (caught instanceof JsonFileReadError) { const code = caught.kind === "not_found" ? ErrorCodes.ArenaFileNotFound : caught.kind === "invalid_json" ? ErrorCodes.ArenaJsonInvalid : ErrorCodes.ArenaFileReadFailed; return { ...resolved, errors: [{ code, path: resolved.relativePath, message: `Arena file ${caught.kind === "not_found" ? "was not found" : caught.kind === "invalid_json" ? "contains invalid JSON" : "could not be read"}` }] }; } throw caught; }
  const validation = validateArenaDefinition(read.value); return validation.valid && validation.profile ? { ...resolved, content: read.content, profile: validation.profile } : { ...resolved, errors: validation.errors };
}

export function isLoadedArena(value: LoadedArena | LoadArenaFailure): value is LoadedArena { return "profile" in value; }
