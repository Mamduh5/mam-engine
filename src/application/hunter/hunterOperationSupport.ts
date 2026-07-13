import type { HealthProfile } from "../../domain/health/healthTypes";
import type { HunterProfile, ResolvedHunterDefinitionPaths } from "../../domain/hunter/hunterTypes";
import { validateHunterDefinition } from "../../domain/hunter/hunterValidation";
import type { StaminaProfile } from "../../domain/stamina/staminaTypes";
import { resolveWorkspacePath } from "../../infrastructure/files/changedFileAudit";
import { JsonFileReadError, readJsonFile } from "../../infrastructure/files/jsonFileStore";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import { isLoadedHealth, loadValidHealth } from "../health/healthOperationSupport";
import { isLoadedStamina, loadValidStamina } from "../stamina/staminaOperationSupport";

export interface LoadedHunter { absolutePath: string; relativePath: string; content: string; profile: HunterProfile }
export interface LoadHunterFailure { errors: OperationError[]; absolutePath?: string; relativePath?: string }
export interface LoadedHunterBundle extends LoadedHunter { health: HealthProfile; stamina: StaminaProfile; resolvedDefinitionPaths: ResolvedHunterDefinitionPaths }
export type ResolvedHunterReferences = Pick<LoadedHunterBundle, "health" | "stamina" | "resolvedDefinitionPaths">;

export async function loadValidHunter(workspaceRoot: string, inputFile: string): Promise<LoadedHunter | LoadHunterFailure> {
  let resolved: { absolutePath: string; relativePath: string }; try { resolved = resolveWorkspacePath(workspaceRoot, inputFile); } catch (caught) { return { errors: [{ code: ErrorCodes.HunterWriteBlocked, path: inputFile, message: caught instanceof Error ? caught.message : String(caught) }] }; }
  let read: Awaited<ReturnType<typeof readJsonFile>>; try { read = await readJsonFile(resolved.absolutePath); } catch (caught) { if (caught instanceof JsonFileReadError) { const code = caught.kind === "not_found" ? ErrorCodes.HunterFileNotFound : caught.kind === "invalid_json" ? ErrorCodes.HunterJsonInvalid : ErrorCodes.HunterFileReadFailed; return { ...resolved, errors: [{ code, path: resolved.relativePath, message: `Hunter file ${caught.kind === "not_found" ? "was not found" : caught.kind === "invalid_json" ? "contains invalid JSON" : "could not be read"}` }] }; } throw caught; }
  const validation = validateHunterDefinition(read.value); return validation.valid && validation.profile ? { ...resolved, content: read.content, profile: validation.profile } : { ...resolved, errors: validation.errors };
}

export async function resolveHunterReferences(workspaceRoot: string, profile: HunterProfile): Promise<ResolvedHunterReferences | LoadHunterFailure> {
  const health = await loadValidHealth(workspaceRoot, profile.healthFile); if (!isLoadedHealth(health)) return referenceFailure("healthFile", profile.healthFile, health.errors, "valid health-profile");
  const stamina = await loadValidStamina(workspaceRoot, profile.staminaFile); if (!isLoadedStamina(stamina)) return referenceFailure("staminaFile", profile.staminaFile, stamina.errors, "valid stamina-profile");
  return { health: health.profile, stamina: stamina.profile, resolvedDefinitionPaths: { healthFile: health.relativePath, staminaFile: stamina.relativePath } };
}

export async function loadValidHunterBundle(workspaceRoot: string, inputFile: string): Promise<LoadedHunterBundle | LoadHunterFailure> { const hunter = await loadValidHunter(workspaceRoot, inputFile); if (!isLoadedHunter(hunter)) return hunter; const references = await resolveHunterReferences(workspaceRoot, hunter.profile); return isResolvedHunterReferences(references) ? { ...hunter, ...references } : references; }
export function isLoadedHunter(value: LoadedHunter | LoadHunterFailure): value is LoadedHunter { return "profile" in value; }
export function isLoadedHunterBundle(value: LoadedHunterBundle | LoadHunterFailure): value is LoadedHunterBundle { return "profile" in value && "health" in value; }
export function isResolvedHunterReferences(value: ResolvedHunterReferences | LoadHunterFailure): value is ResolvedHunterReferences { return "health" in value; }
function referenceFailure(path: string, actual: string, errors: OperationError[], expected: string): LoadHunterFailure { return { errors: [{ code: ErrorCodes.HunterReferenceInvalid, path, message: `Hunter reference '${actual}' could not be resolved`, actual, expected, details: { errors } }] }; }
