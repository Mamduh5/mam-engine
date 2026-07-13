import type { ContactVolumeProfile } from "../../domain/contactVolume/contactVolumeTypes";
import { validateContactVolumeDefinition } from "../../domain/contactVolume/contactVolumeValidation";
import { resolveWorkspacePath } from "../../infrastructure/files/changedFileAudit";
import { JsonFileReadError, readJsonFile } from "../../infrastructure/files/jsonFileStore";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";

export interface LoadedContactVolume { absolutePath: string; relativePath: string; content: string; profile: ContactVolumeProfile }
export interface LoadContactVolumeFailure { errors: OperationError[]; absolutePath?: string; relativePath?: string }
export async function loadValidContactVolume(workspaceRoot: string, inputFile: string): Promise<LoadedContactVolume | LoadContactVolumeFailure> { let resolved: { absolutePath: string; relativePath: string }; try { resolved = resolveWorkspacePath(workspaceRoot, inputFile); } catch (caught) { return { errors: [{ code: ErrorCodes.ContactVolumeWriteBlocked, path: inputFile, message: caught instanceof Error ? caught.message : String(caught) }] }; } let read: Awaited<ReturnType<typeof readJsonFile>>; try { read = await readJsonFile(resolved.absolutePath); } catch (caught) { if (caught instanceof JsonFileReadError) { const code = caught.kind === "not_found" ? ErrorCodes.ContactVolumeFileNotFound : caught.kind === "invalid_json" ? ErrorCodes.ContactVolumeJsonInvalid : ErrorCodes.ContactVolumeFileReadFailed; return { ...resolved, errors: [{ code, path: resolved.relativePath, message: `Contact volume file ${caught.kind === "not_found" ? "was not found" : caught.kind === "invalid_json" ? "contains invalid JSON" : "could not be read"}` }] }; } throw caught; } const validation = validateContactVolumeDefinition(read.value); return validation.valid && validation.profile ? { ...resolved, content: read.content, profile: validation.profile } : { ...resolved, errors: validation.errors }; }
export function isLoadedContactVolume(value: LoadedContactVolume | LoadContactVolumeFailure): value is LoadedContactVolume { return "profile" in value; }
