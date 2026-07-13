import { simulateWeaponStrike } from "../../domain/weapon/weaponSimulation";
import { auditChangedFiles, captureWorkspaceState } from "../../infrastructure/files/changedFileAudit";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedContactVolume, loadValidContactVolume } from "../contactVolume/contactVolumeOperationSupport";
import { isLoadedDamageReaction, loadValidDamageReaction } from "../damageReaction/damageReactionOperationSupport";
import { isLoadedHealth, loadValidHealth } from "../health/healthOperationSupport";
import { isLoadedStamina, loadValidStamina } from "../stamina/staminaOperationSupport";
import { isLoadedWeaponBundle, loadValidWeaponBundle } from "./weaponOperationSupport";

export async function simulateWeaponStrikeFiles(workspaceRoot: string, weaponFile: string, staminaFile: string, healthFile: string, hurtboxFile: string, reactionFile: string, fixedDelta?: number): Promise<OperationResult> {
  const command = "weapon.simulate-strike"; const input = { weaponFile, staminaFile, healthFile, hurtboxFile, reactionFile, ...(fixedDelta === undefined ? {} : { fixedDelta }) };
  if (fixedDelta !== undefined && (!Number.isFinite(fixedDelta) || fixedDelta <= 0)) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.CliArgumentInvalid, path: "fixedDelta", message: "fixed delta must be finite and greater than 0", actual: fixedDelta, expected: "> 0" }] });
  const before = await captureWorkspaceState(workspaceRoot); const weapon = await loadValidWeaponBundle(workspaceRoot, weaponFile); if (!isLoadedWeaponBundle(weapon)) return operationResult({ command, status: "failed", input, errors: weapon.errors });
  const stamina = await loadValidStamina(workspaceRoot, staminaFile); if (!isLoadedStamina(stamina)) return operationResult({ command, status: "failed", input: { ...input, weaponFile: weapon.relativePath }, errors: stamina.errors });
  const health = await loadValidHealth(workspaceRoot, healthFile); if (!isLoadedHealth(health)) return operationResult({ command, status: "failed", input: { ...input, weaponFile: weapon.relativePath, staminaFile: stamina.relativePath }, errors: health.errors });
  const hurtbox = await loadValidContactVolume(workspaceRoot, hurtboxFile); if (!isLoadedContactVolume(hurtbox)) return operationResult({ command, status: "failed", input, errors: hurtbox.errors }); if (hurtbox.profile.role !== "hurtbox") return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.ContactVolumeRoleInvalid, path: hurtbox.relativePath, message: "Weapon strike target contact volume must have role hurtbox", actual: hurtbox.profile.role, expected: "hurtbox" }] });
  const reaction = await loadValidDamageReaction(workspaceRoot, reactionFile); if (!isLoadedDamageReaction(reaction)) return operationResult({ command, status: "failed", input, errors: reaction.errors });
  const simulation = simulateWeaponStrike(weapon.profile, weapon.resolvedDefinitionPaths, stamina.profile, health.profile, hurtbox.profile, reaction.profile, weapon.offensiveAction, weapon.actionTimeline, weapon.hitbox, fixedDelta); const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []);
  if (!audit.ok) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.WeaponWriteBlocked, message: "Read-only weapon strike simulation changed unexpected files", details: { unexpectedFiles: audit.unexpectedFiles } }], changedFiles: audit.changedFiles });
  return operationResult({ command, status: "passed", input: { weaponFile: weapon.relativePath, staminaFile: stamina.relativePath, healthFile: health.relativePath, hurtboxFile: hurtbox.relativePath, reactionFile: reaction.relativePath, ...(fixedDelta === undefined ? {} : { fixedDelta }) }, data: simulation });
}
