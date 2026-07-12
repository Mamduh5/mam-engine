import { validateTargetingDefinition } from "../../domain/targeting/targetingValidation";
import type { TargetingProfile } from "../../domain/targeting/targetingTypes";
import { resolveWorkspacePath } from "../../infrastructure/files/changedFileAudit";
import { JsonFileReadError, readJsonFile } from "../../infrastructure/files/jsonFileStore";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";

export interface LoadedTargeting { absolutePath: string; relativePath: string; content: string; profile: TargetingProfile }
export interface LoadTargetingFailure { errors: OperationError[]; absolutePath?: string; relativePath?: string }
export async function loadValidTargeting(workspaceRoot: string, inputFile: string): Promise<LoadedTargeting | LoadTargetingFailure> {
  let resolved: { absolutePath: string; relativePath: string }; try { resolved = resolveWorkspacePath(workspaceRoot, inputFile); } catch (caught) { return { errors: [{ code: ErrorCodes.TargetingWriteBlocked, path: inputFile, message: caught instanceof Error ? caught.message : String(caught) }] }; }
  let read: Awaited<ReturnType<typeof readJsonFile>>; try { read = await readJsonFile(resolved.absolutePath); } catch (caught) { if (caught instanceof JsonFileReadError) { const code = caught.kind === "not_found" ? ErrorCodes.TargetingFileNotFound : caught.kind === "invalid_json" ? ErrorCodes.TargetingJsonInvalid : ErrorCodes.TargetingFileReadFailed; return { ...resolved, errors: [{ code, path: resolved.relativePath, message: `Targeting file ${caught.kind === "not_found" ? "was not found" : caught.kind === "invalid_json" ? "contains invalid JSON" : "could not be read"}` }] }; } throw caught; }
  const validation = validateTargetingDefinition(read.value); if (!validation.valid || validation.profile === null) return { ...resolved, errors: validation.errors }; return { ...resolved, content: read.content, profile: validation.profile };
}
export function isLoadedTargeting(value: LoadedTargeting | LoadTargetingFailure): value is LoadedTargeting { return "profile" in value; }
