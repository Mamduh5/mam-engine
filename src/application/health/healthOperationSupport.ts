import { validateHealthDefinition } from "../../domain/health/healthValidation";
import type { HealthProfile } from "../../domain/health/healthTypes";
import { resolveWorkspacePath } from "../../infrastructure/files/changedFileAudit";
import { JsonFileReadError, readJsonFile } from "../../infrastructure/files/jsonFileStore";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";

export interface LoadedHealth { absolutePath: string; relativePath: string; content: string; profile: HealthProfile }
export interface LoadHealthFailure { errors: OperationError[]; absolutePath?: string; relativePath?: string }
export async function loadValidHealth(workspaceRoot: string, inputFile: string): Promise<LoadedHealth | LoadHealthFailure> { let resolved: { absolutePath: string; relativePath: string }; try { resolved = resolveWorkspacePath(workspaceRoot, inputFile); } catch (caught) { return { errors: [{ code: ErrorCodes.HealthWriteBlocked, path: inputFile, message: caught instanceof Error ? caught.message : String(caught) }] }; } let read: Awaited<ReturnType<typeof readJsonFile>>; try { read = await readJsonFile(resolved.absolutePath); } catch (caught) { if (caught instanceof JsonFileReadError) { const code = caught.kind === "not_found" ? ErrorCodes.HealthFileNotFound : caught.kind === "invalid_json" ? ErrorCodes.HealthJsonInvalid : ErrorCodes.HealthFileReadFailed; return { ...resolved, errors: [{ code, path: resolved.relativePath, message: `Health file ${caught.kind === "not_found" ? "was not found" : caught.kind === "invalid_json" ? "contains invalid JSON" : "could not be read"}` }] }; } throw caught; } const validation = validateHealthDefinition(read.value); return validation.valid && validation.profile ? { ...resolved, content: read.content, profile: validation.profile } : { ...resolved, errors: validation.errors }; }
export function isLoadedHealth(value: LoadedHealth | LoadHealthFailure): value is LoadedHealth { return "profile" in value; }
