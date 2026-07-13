import { simulateTargetedCombatExchange, type TargetedCombatExchangeScenario } from "../../domain/combat/targetedCombatExchangeSimulation";
import { auditChangedFiles, captureWorkspaceState } from "../../infrastructure/files/changedFileAudit";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedHealth, loadValidHealth } from "../health/healthOperationSupport";
import { isLoadedOffensiveAction, loadValidOffensiveAction } from "../offensiveAction/offensiveActionOperationSupport";
import { isLoadedStamina, loadValidStamina } from "../stamina/staminaOperationSupport";
import { isLoadedTargeting, loadValidTargeting } from "../targeting/targetingOperationSupport";

export async function simulateTargetedCombatExchangeFiles(workspaceRoot: string, targetingFile: string, staminaFile: string, healthFile: string, offensiveActionFile: string, scenario: TargetedCombatExchangeScenario): Promise<OperationResult> {
  const command = "combat.simulate-targeted-exchange"; const input = { targetingFile, staminaFile, healthFile, offensiveActionFile, scenario }; const before = await captureWorkspaceState(workspaceRoot);
  const targeting = await loadValidTargeting(workspaceRoot, targetingFile); if (!isLoadedTargeting(targeting)) return operationResult({ command, status: "failed", input, errors: targeting.errors });
  const stamina = await loadValidStamina(workspaceRoot, staminaFile); if (!isLoadedStamina(stamina)) return operationResult({ command, status: "failed", input: { ...input, targetingFile: targeting.relativePath }, errors: stamina.errors });
  const health = await loadValidHealth(workspaceRoot, healthFile); if (!isLoadedHealth(health)) return operationResult({ command, status: "failed", input: { ...input, targetingFile: targeting.relativePath, staminaFile: stamina.relativePath }, errors: health.errors });
  const action = await loadValidOffensiveAction(workspaceRoot, offensiveActionFile); if (!isLoadedOffensiveAction(action)) return operationResult({ command, status: "failed", input: { ...input, targetingFile: targeting.relativePath, staminaFile: stamina.relativePath, healthFile: health.relativePath }, errors: action.errors });
  const simulation = simulateTargetedCombatExchange(targeting.profile, stamina.profile, health.profile, action.profile, scenario);
  if (!simulation) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.OffensiveActionSemanticInvalid, message: "Offensive action has no valid active step for a confirmed hit", details: { activeStartSeconds: action.profile.activeStartSeconds, activeEndSeconds: action.profile.activeEndSeconds } }] });
  const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []);
  if (!audit.ok) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.TargetingWriteBlocked, message: "Read-only targeted combat exchange changed unexpected files", details: { unexpectedFiles: audit.unexpectedFiles } }], changedFiles: audit.changedFiles });
  return operationResult({ command, status: "passed", input: { targetingFile: targeting.relativePath, staminaFile: stamina.relativePath, healthFile: health.relativePath, offensiveActionFile: action.relativePath, scenario }, data: simulation });
}
