import { validateDefensiveActionDefinition } from "../../domain/defensiveAction/defensiveActionValidation";
import type { DefensiveActionProfile } from "../../domain/defensiveAction/defensiveActionTypes";
import { resolveWorkspacePath } from "../../infrastructure/files/changedFileAudit";
import { JsonFileReadError, readJsonFile } from "../../infrastructure/files/jsonFileStore";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";

export interface LoadedDefensiveAction { absolutePath: string; relativePath: string; content: string; profile: DefensiveActionProfile }
export interface LoadDefensiveActionFailure { errors: OperationError[]; absolutePath?: string; relativePath?: string }
export async function loadValidDefensiveAction(workspaceRoot: string, inputFile: string): Promise<LoadedDefensiveAction | LoadDefensiveActionFailure> {
  let resolved: { absolutePath: string; relativePath: string }; try { resolved = resolveWorkspacePath(workspaceRoot, inputFile); } catch (caught) { return { errors: [{ code: ErrorCodes.DefensiveActionWriteBlocked, path: inputFile, message: caught instanceof Error ? caught.message : String(caught) }] }; }
  let read: Awaited<ReturnType<typeof readJsonFile>>; try { read = await readJsonFile(resolved.absolutePath); } catch (caught) { if (caught instanceof JsonFileReadError) { const code = caught.kind === "not_found" ? ErrorCodes.DefensiveActionFileNotFound : caught.kind === "invalid_json" ? ErrorCodes.DefensiveActionJsonInvalid : ErrorCodes.DefensiveActionFileReadFailed; return { ...resolved, errors: [{ code, path: resolved.relativePath, message: `Defensive action file ${caught.kind === "not_found" ? "was not found" : caught.kind === "invalid_json" ? "contains invalid JSON" : "could not be read"}` }] }; } throw caught; }
  const validation = validateDefensiveActionDefinition(read.value); return validation.valid && validation.profile ? { ...resolved, content: read.content, profile: validation.profile } : { ...resolved, errors: validation.errors };
}
export function isLoadedDefensiveAction(value: LoadedDefensiveAction | LoadDefensiveActionFailure): value is LoadedDefensiveAction { return "profile" in value; }
