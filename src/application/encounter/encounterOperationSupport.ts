import type { ContactVolumeProfile } from "../../domain/contactVolume/contactVolumeTypes";
import type { EncounterProfile, ResolvedEncounterDefinitionPaths } from "../../domain/encounter/encounterTypes";
import { validateEncounterDefinition } from "../../domain/encounter/encounterValidation";
import { simulateWeaponStrike } from "../../domain/weapon/weaponSimulation";
import { resolveWorkspacePath } from "../../infrastructure/files/changedFileAudit";
import { JsonFileReadError, readJsonFile } from "../../infrastructure/files/jsonFileStore";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import { isLoadedArena, loadValidArena, type LoadedArena } from "../arena/arenaOperationSupport";
import { isLoadedHunterBundle, loadValidHunterBundle, type LoadedHunterBundle } from "../hunter/hunterOperationSupport";
import { isLoadedLargeEnemyBundle, loadValidLargeEnemyBundle, type LoadedLargeEnemyBundle } from "../largeEnemy/largeEnemyOperationSupport";
import { isLoadedWeaponBundle, loadValidWeaponBundle, type LoadedWeaponBundle } from "../weapon/weaponOperationSupport";

export interface LoadedEncounter { absolutePath: string; relativePath: string; content: string; profile: EncounterProfile }
export interface LoadEncounterFailure { errors: OperationError[]; absolutePath?: string; relativePath?: string }
export interface LoadedEncounterBundle extends LoadedEncounter { hunter: LoadedHunterBundle; weapon: LoadedWeaponBundle; enemy: LoadedLargeEnemyBundle; arena: LoadedArena; selectedBodyPartId: string; selectedHurtbox: ContactVolumeProfile; resolvedDefinitionPaths: ResolvedEncounterDefinitionPaths }
export type ResolvedEncounterReferences = Pick<LoadedEncounterBundle, "hunter" | "weapon" | "enemy" | "arena" | "selectedBodyPartId" | "selectedHurtbox" | "resolvedDefinitionPaths">;

export async function loadValidEncounter(workspaceRoot: string, inputFile: string): Promise<LoadedEncounter | LoadEncounterFailure> {
  let resolved: { absolutePath: string; relativePath: string }; try { resolved = resolveWorkspacePath(workspaceRoot, inputFile); } catch (caught) { return { errors: [{ code: ErrorCodes.EncounterWriteBlocked, path: inputFile, message: caught instanceof Error ? caught.message : String(caught) }] }; }
  let read: Awaited<ReturnType<typeof readJsonFile>>; try { read = await readJsonFile(resolved.absolutePath); } catch (caught) { if (caught instanceof JsonFileReadError) { const code = caught.kind === "not_found" ? ErrorCodes.EncounterFileNotFound : caught.kind === "invalid_json" ? ErrorCodes.EncounterJsonInvalid : ErrorCodes.EncounterFileReadFailed; return { ...resolved, errors: [{ code, path: resolved.relativePath, message: `Encounter file ${caught.kind === "not_found" ? "was not found" : caught.kind === "invalid_json" ? "contains invalid JSON" : "could not be read"}` }] }; } throw caught; }
  const validation = validateEncounterDefinition(read.value); return validation.valid && validation.profile ? { ...resolved, content: read.content, profile: validation.profile } : { ...resolved, errors: validation.errors };
}

export async function resolveEncounterReferences(workspaceRoot: string, profile: EncounterProfile): Promise<ResolvedEncounterReferences | LoadEncounterFailure> {
  const hunter = await loadValidHunterBundle(workspaceRoot, profile.hunterFile); if (!isLoadedHunterBundle(hunter)) return referenceFailure("hunterFile", profile.hunterFile, hunter.errors, "valid hunter-profile");
  const weapon = await loadValidWeaponBundle(workspaceRoot, profile.weaponFile); if (!isLoadedWeaponBundle(weapon)) return referenceFailure("weaponFile", profile.weaponFile, weapon.errors, "valid weapon-profile");
  const enemy = await loadValidLargeEnemyBundle(workspaceRoot, profile.enemyFile); if (!isLoadedLargeEnemyBundle(enemy)) return referenceFailure("enemyFile", profile.enemyFile, enemy.errors, "valid large-enemy-profile");
  const arena = await loadValidArena(workspaceRoot, profile.arenaFile); if (!isLoadedArena(arena)) return referenceFailure("arenaFile", profile.arenaFile, arena.errors, "valid arena-profile");
  const selectedIndex = enemy.profile.bodyParts.findIndex((part) => part.targetable); const selected = enemy.profile.bodyParts[selectedIndex]; const hurtbox = enemy.hurtboxes[selectedIndex];
  if (!selected || !hurtbox) return { errors: [{ code: ErrorCodes.EncounterCompatibilityInvalid, path: "enemyFile", message: "Encounter enemy must expose a targetable body part", expected: "at least one targetable body part" }] };
  const compatibility = simulateWeaponStrike(weapon.profile, weapon.resolvedDefinitionPaths, { ...hunter.stamina, maxStamina: Math.max(hunter.stamina.maxStamina, weapon.offensiveAction.staminaCost), startingStamina: weapon.offensiveAction.staminaCost }, enemy.health, hurtbox, enemy.reaction, weapon.offensiveAction, weapon.actionTimeline, weapon.hitbox);
  if (!compatibility.actionAccepted || !compatibility.contactOccurred) return { errors: [{ code: ErrorCodes.EncounterCompatibilityInvalid, path: "enemyFile", message: "Selected enemy body-part hurtbox is not compatible with the encounter weapon strike", actual: selected.id, expected: "accepted contacting strike" }] };
  return { hunter, weapon, enemy, arena, selectedBodyPartId: selected.id, selectedHurtbox: hurtbox, resolvedDefinitionPaths: { hunterFile: hunter.relativePath, weaponFile: weapon.relativePath, enemyFile: enemy.relativePath, arenaFile: arena.relativePath } };
}

export async function loadValidEncounterBundle(workspaceRoot: string, inputFile: string): Promise<LoadedEncounterBundle | LoadEncounterFailure> { const encounter = await loadValidEncounter(workspaceRoot, inputFile); if (!isLoadedEncounter(encounter)) return encounter; const references = await resolveEncounterReferences(workspaceRoot, encounter.profile); return isResolvedEncounterReferences(references) ? { ...encounter, ...references } : references; }
export function isLoadedEncounter(value: LoadedEncounter | LoadEncounterFailure): value is LoadedEncounter { return "profile" in value; }
export function isLoadedEncounterBundle(value: LoadedEncounterBundle | LoadEncounterFailure): value is LoadedEncounterBundle { return "profile" in value && "hunter" in value; }
export function isResolvedEncounterReferences(value: ResolvedEncounterReferences | LoadEncounterFailure): value is ResolvedEncounterReferences { return "hunter" in value; }
function referenceFailure(path: string, actual: string, errors: OperationError[], expected: string): LoadEncounterFailure { return { errors: [{ code: ErrorCodes.EncounterReferenceInvalid, path, message: `Encounter reference '${actual}' could not be resolved`, actual, expected, details: { errors } }] }; }
