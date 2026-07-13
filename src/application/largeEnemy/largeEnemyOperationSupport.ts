import type { ContactVolumeProfile } from "../../domain/contactVolume/contactVolumeTypes";
import type { DamageReactionProfile } from "../../domain/damageReaction/damageReactionTypes";
import type { HealthProfile } from "../../domain/health/healthTypes";
import type { LargeEnemyProfile, ResolvedLargeEnemyDefinitionPaths } from "../../domain/largeEnemy/largeEnemyTypes";
import { validateLargeEnemyDefinition } from "../../domain/largeEnemy/largeEnemyValidation";
import { resolveWorkspacePath } from "../../infrastructure/files/changedFileAudit";
import { JsonFileReadError, readJsonFile } from "../../infrastructure/files/jsonFileStore";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import { isLoadedContactVolume, loadValidContactVolume } from "../contactVolume/contactVolumeOperationSupport";
import { isLoadedDamageReaction, loadValidDamageReaction } from "../damageReaction/damageReactionOperationSupport";
import { isLoadedHealth, loadValidHealth } from "../health/healthOperationSupport";

export interface LoadedLargeEnemy { absolutePath: string; relativePath: string; content: string; profile: LargeEnemyProfile }
export interface LoadLargeEnemyFailure { errors: OperationError[]; absolutePath?: string; relativePath?: string }
export interface LoadedLargeEnemyBundle extends LoadedLargeEnemy { health: HealthProfile; reaction: DamageReactionProfile; hurtboxes: ContactVolumeProfile[]; resolvedDefinitionPaths: ResolvedLargeEnemyDefinitionPaths }
export type ResolvedLargeEnemyReferences = Pick<LoadedLargeEnemyBundle, "health" | "reaction" | "hurtboxes" | "resolvedDefinitionPaths">;

export async function loadValidLargeEnemy(workspaceRoot: string, inputFile: string): Promise<LoadedLargeEnemy | LoadLargeEnemyFailure> {
  let resolved: { absolutePath: string; relativePath: string }; try { resolved = resolveWorkspacePath(workspaceRoot, inputFile); } catch (caught) { return { errors: [{ code: ErrorCodes.LargeEnemyWriteBlocked, path: inputFile, message: caught instanceof Error ? caught.message : String(caught) }] }; }
  let read: Awaited<ReturnType<typeof readJsonFile>>; try { read = await readJsonFile(resolved.absolutePath); } catch (caught) { if (caught instanceof JsonFileReadError) { const code = caught.kind === "not_found" ? ErrorCodes.LargeEnemyFileNotFound : caught.kind === "invalid_json" ? ErrorCodes.LargeEnemyJsonInvalid : ErrorCodes.LargeEnemyFileReadFailed; return { ...resolved, errors: [{ code, path: resolved.relativePath, message: `Large-enemy file ${caught.kind === "not_found" ? "was not found" : caught.kind === "invalid_json" ? "contains invalid JSON" : "could not be read"}` }] }; } throw caught; }
  const validation = validateLargeEnemyDefinition(read.value); return validation.valid && validation.profile ? { ...resolved, content: read.content, profile: validation.profile } : { ...resolved, errors: validation.errors };
}

export async function resolveLargeEnemyReferences(workspaceRoot: string, profile: LargeEnemyProfile): Promise<ResolvedLargeEnemyReferences | LoadLargeEnemyFailure> {
  const health = await loadValidHealth(workspaceRoot, profile.healthFile); if (!isLoadedHealth(health)) return referenceFailure("healthFile", profile.healthFile, health.errors, "valid health-profile");
  const reaction = await loadValidDamageReaction(workspaceRoot, profile.reactionFile); if (!isLoadedDamageReaction(reaction)) return referenceFailure("reactionFile", profile.reactionFile, reaction.errors, "valid damage-reaction-profile");
  const hurtboxes: ContactVolumeProfile[] = []; const resolvedBodyParts: ResolvedLargeEnemyDefinitionPaths["bodyParts"] = [];
  for (const [index, bodyPart] of profile.bodyParts.entries()) {
    const hurtbox = await loadValidContactVolume(workspaceRoot, bodyPart.hurtboxFile); if (!isLoadedContactVolume(hurtbox)) return referenceFailure(`bodyParts.${index}.hurtboxFile`, bodyPart.hurtboxFile, hurtbox.errors, "valid hurtbox contact-volume-profile");
    if (hurtbox.profile.role !== "hurtbox") return referenceFailure(`bodyParts.${index}.hurtboxFile`, bodyPart.hurtboxFile, [{ code: ErrorCodes.ContactVolumeRoleInvalid, path: hurtbox.relativePath, message: "Large-enemy body-part contact volume must have role hurtbox", actual: hurtbox.profile.role, expected: "hurtbox" }], "valid hurtbox contact-volume-profile");
    hurtboxes.push(hurtbox.profile); resolvedBodyParts.push({ id: bodyPart.id, hurtboxFile: hurtbox.relativePath });
  }
  return { health: health.profile, reaction: reaction.profile, hurtboxes, resolvedDefinitionPaths: { healthFile: health.relativePath, reactionFile: reaction.relativePath, bodyParts: resolvedBodyParts } };
}

export async function loadValidLargeEnemyBundle(workspaceRoot: string, inputFile: string): Promise<LoadedLargeEnemyBundle | LoadLargeEnemyFailure> { const enemy = await loadValidLargeEnemy(workspaceRoot, inputFile); if (!isLoadedLargeEnemy(enemy)) return enemy; const references = await resolveLargeEnemyReferences(workspaceRoot, enemy.profile); return isResolvedLargeEnemyReferences(references) ? { ...enemy, ...references } : references; }
export function isLoadedLargeEnemy(value: LoadedLargeEnemy | LoadLargeEnemyFailure): value is LoadedLargeEnemy { return "profile" in value; }
export function isLoadedLargeEnemyBundle(value: LoadedLargeEnemyBundle | LoadLargeEnemyFailure): value is LoadedLargeEnemyBundle { return "profile" in value && "health" in value; }
export function isResolvedLargeEnemyReferences(value: ResolvedLargeEnemyReferences | LoadLargeEnemyFailure): value is ResolvedLargeEnemyReferences { return "health" in value; }
function referenceFailure(path: string, actual: string, errors: OperationError[], expected: string): LoadLargeEnemyFailure { return { errors: [{ code: ErrorCodes.LargeEnemyReferenceInvalid, path, message: `Large-enemy reference '${actual}' could not be resolved`, actual, expected, details: { errors } }] }; }
