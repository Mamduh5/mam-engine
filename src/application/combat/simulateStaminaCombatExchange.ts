import { simulateStaminaCombatExchange } from "../../domain/combat/staminaCombatExchangeSimulation";
import { auditChangedFiles, captureWorkspaceState } from "../../infrastructure/files/changedFileAudit";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedHealth, loadValidHealth } from "../health/healthOperationSupport";
import { isLoadedOffensiveAction, loadValidOffensiveAction } from "../offensiveAction/offensiveActionOperationSupport";
import { isLoadedStamina, loadValidStamina } from "../stamina/staminaOperationSupport";

export async function simulateStaminaCombatExchangeFiles(workspaceRoot: string, staminaFile: string, healthFile: string, offensiveActionFile: string): Promise<OperationResult> {
  const command = "combat.simulate-stamina-exchange"; const input = { staminaFile, healthFile, offensiveActionFile }; const before = await captureWorkspaceState(workspaceRoot);
  const stamina = await loadValidStamina(workspaceRoot, staminaFile); if (!isLoadedStamina(stamina)) return operationResult({ command, status: "failed", input, errors: stamina.errors });
  const health = await loadValidHealth(workspaceRoot, healthFile); if (!isLoadedHealth(health)) return operationResult({ command, status: "failed", input: { ...input, staminaFile: stamina.relativePath }, errors: health.errors });
  const action = await loadValidOffensiveAction(workspaceRoot, offensiveActionFile); if (!isLoadedOffensiveAction(action)) return operationResult({ command, status: "failed", input: { ...input, staminaFile: stamina.relativePath, healthFile: health.relativePath }, errors: action.errors });
  const simulation = simulateStaminaCombatExchange(stamina.profile, health.profile, action.profile);
  if (!simulation) return operationResult({ command, status: "failed", input: { staminaFile: stamina.relativePath, healthFile: health.relativePath, offensiveActionFile: action.relativePath }, errors: [{ code: ErrorCodes.OffensiveActionSemanticInvalid, message: "Offensive action has no valid active step for a confirmed hit", details: { activeStartSeconds: action.profile.activeStartSeconds, activeEndSeconds: action.profile.activeEndSeconds } }] });
  const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []);
  if (!audit.ok) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.StaminaWriteBlocked, message: "Read-only stamina combat exchange changed unexpected files", details: { unexpectedFiles: audit.unexpectedFiles } }], changedFiles: audit.changedFiles });
  return operationResult({ command, status: "passed", input: { staminaFile: stamina.relativePath, healthFile: health.relativePath, offensiveActionFile: action.relativePath }, data: simulation });
}
