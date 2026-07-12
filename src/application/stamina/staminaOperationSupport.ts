import { validateStaminaDefinition } from "../../domain/stamina/staminaValidation";
import type { StaminaProfile } from "../../domain/stamina/staminaTypes";
import { resolveWorkspacePath } from "../../infrastructure/files/changedFileAudit";
import { JsonFileReadError, readJsonFile } from "../../infrastructure/files/jsonFileStore";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";

export interface LoadedStamina { absolutePath: string; relativePath: string; content: string; profile: StaminaProfile }
export interface LoadStaminaFailure { errors: OperationError[]; absolutePath?: string; relativePath?: string }
export async function loadValidStamina(workspaceRoot: string, inputFile: string): Promise<LoadedStamina | LoadStaminaFailure> { let resolved: { absolutePath: string; relativePath: string }; try { resolved = resolveWorkspacePath(workspaceRoot, inputFile); } catch (caught) { return { errors: [{ code: ErrorCodes.StaminaWriteBlocked, path: inputFile, message: caught instanceof Error ? caught.message : String(caught) }] }; } let read: Awaited<ReturnType<typeof readJsonFile>>; try { read = await readJsonFile(resolved.absolutePath); } catch (caught) { if (caught instanceof JsonFileReadError) { const code = caught.kind === "not_found" ? ErrorCodes.StaminaFileNotFound : caught.kind === "invalid_json" ? ErrorCodes.StaminaJsonInvalid : ErrorCodes.StaminaFileReadFailed; return { ...resolved, errors: [{ code, path: resolved.relativePath, message: `Stamina file ${caught.kind === "not_found" ? "was not found" : caught.kind === "invalid_json" ? "contains invalid JSON" : "could not be read"}` }] }; } throw caught; } const validation = validateStaminaDefinition(read.value); return validation.valid && validation.profile ? { ...resolved, content: read.content, profile: validation.profile } : { ...resolved, errors: validation.errors }; }
export function isLoadedStamina(value: LoadedStamina | LoadStaminaFailure): value is LoadedStamina { return "profile" in value; }
