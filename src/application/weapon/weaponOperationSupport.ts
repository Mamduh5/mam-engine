import type { ActionTimelineProfile } from "../../domain/actionTimeline/actionTimelineTypes";
import type { ContactVolumeProfile } from "../../domain/contactVolume/contactVolumeTypes";
import type { OffensiveActionProfile } from "../../domain/offensiveAction/offensiveActionTypes";
import type { ResolvedWeaponDefinitionPaths, WeaponProfile } from "../../domain/weapon/weaponTypes";
import { validateWeaponCompatibility, validateWeaponDefinition } from "../../domain/weapon/weaponValidation";
import { resolveWorkspacePath } from "../../infrastructure/files/changedFileAudit";
import { JsonFileReadError, readJsonFile } from "../../infrastructure/files/jsonFileStore";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import { isLoadedActionTimeline, loadValidActionTimeline } from "../actionTimeline/actionTimelineOperationSupport";
import { isLoadedContactVolume, loadValidContactVolume } from "../contactVolume/contactVolumeOperationSupport";
import { isLoadedOffensiveAction, loadValidOffensiveAction } from "../offensiveAction/offensiveActionOperationSupport";

export interface LoadedWeapon { absolutePath: string; relativePath: string; content: string; profile: WeaponProfile }
export interface LoadWeaponFailure { errors: OperationError[]; absolutePath?: string; relativePath?: string }
export interface LoadedWeaponBundle extends LoadedWeapon { offensiveAction: OffensiveActionProfile; actionTimeline: ActionTimelineProfile; hitbox: ContactVolumeProfile; resolvedDefinitionPaths: ResolvedWeaponDefinitionPaths }
export type ResolvedWeaponReferences = Pick<LoadedWeaponBundle, "offensiveAction" | "actionTimeline" | "hitbox" | "resolvedDefinitionPaths">;

export async function loadValidWeapon(workspaceRoot: string, inputFile: string): Promise<LoadedWeapon | LoadWeaponFailure> {
  let resolved: { absolutePath: string; relativePath: string }; try { resolved = resolveWorkspacePath(workspaceRoot, inputFile); } catch (caught) { return { errors: [{ code: ErrorCodes.WeaponWriteBlocked, path: inputFile, message: caught instanceof Error ? caught.message : String(caught) }] }; }
  let read: Awaited<ReturnType<typeof readJsonFile>>; try { read = await readJsonFile(resolved.absolutePath); } catch (caught) { if (caught instanceof JsonFileReadError) { const code = caught.kind === "not_found" ? ErrorCodes.WeaponFileNotFound : caught.kind === "invalid_json" ? ErrorCodes.WeaponJsonInvalid : ErrorCodes.WeaponFileReadFailed; return { ...resolved, errors: [{ code, path: resolved.relativePath, message: `Weapon file ${caught.kind === "not_found" ? "was not found" : caught.kind === "invalid_json" ? "contains invalid JSON" : "could not be read"}` }] }; } throw caught; }
  const validation = validateWeaponDefinition(read.value); return validation.valid && validation.profile ? { ...resolved, content: read.content, profile: validation.profile } : { ...resolved, errors: validation.errors };
}

export async function resolveWeaponReferences(workspaceRoot: string, profile: WeaponProfile): Promise<ResolvedWeaponReferences | LoadWeaponFailure> {
  const action = await loadValidOffensiveAction(workspaceRoot, profile.offensiveActionFile); if (!isLoadedOffensiveAction(action)) return referenceFailure("offensiveActionFile", profile.offensiveActionFile, action.errors);
  const timeline = await loadValidActionTimeline(workspaceRoot, profile.actionTimelineFile); if (!isLoadedActionTimeline(timeline)) return referenceFailure("actionTimelineFile", profile.actionTimelineFile, timeline.errors);
  const hitbox = await loadValidContactVolume(workspaceRoot, profile.hitboxFile); if (!isLoadedContactVolume(hitbox)) return referenceFailure("hitboxFile", profile.hitboxFile, hitbox.errors);
  const compatibilityErrors = validateWeaponCompatibility(profile, action.profile, timeline.profile, hitbox.profile); if (compatibilityErrors.length > 0) return { errors: compatibilityErrors };
  return { offensiveAction: action.profile, actionTimeline: timeline.profile, hitbox: hitbox.profile, resolvedDefinitionPaths: { offensiveActionFile: action.relativePath, actionTimelineFile: timeline.relativePath, hitboxFile: hitbox.relativePath } };
}

export async function loadValidWeaponBundle(workspaceRoot: string, inputFile: string): Promise<LoadedWeaponBundle | LoadWeaponFailure> { const weapon = await loadValidWeapon(workspaceRoot, inputFile); if (!isLoadedWeapon(weapon)) return weapon; const references = await resolveWeaponReferences(workspaceRoot, weapon.profile); return isResolvedWeaponReferences(references) ? { ...weapon, ...references } : references; }
export function isLoadedWeapon(value: LoadedWeapon | LoadWeaponFailure): value is LoadedWeapon { return "profile" in value; }
export function isLoadedWeaponBundle(value: LoadedWeaponBundle | LoadWeaponFailure): value is LoadedWeaponBundle { return "profile" in value && "offensiveAction" in value; }
export function isResolvedWeaponReferences(value: ResolvedWeaponReferences | LoadWeaponFailure): value is ResolvedWeaponReferences { return "offensiveAction" in value; }
function referenceFailure(path: string, actual: string, errors: OperationError[]): LoadWeaponFailure { return { errors: [{ code: ErrorCodes.WeaponReferenceInvalid, path, message: `Weapon reference '${actual}' could not be resolved as a valid definition`, actual, expected: "valid workspace definition", details: { errors } }] }; }
