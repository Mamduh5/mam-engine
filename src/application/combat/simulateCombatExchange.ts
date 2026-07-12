import { simulateCombatExchange } from "../../domain/combat/combatExchangeSimulation";
import { auditChangedFiles, captureWorkspaceState } from "../../infrastructure/files/changedFileAudit";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedHealth, loadValidHealth } from "../health/healthOperationSupport";
import { isLoadedOffensiveAction, loadValidOffensiveAction } from "../offensiveAction/offensiveActionOperationSupport";

export async function simulateCombatExchangeFiles(workspaceRoot: string, healthFile: string, offensiveActionFile: string): Promise<OperationResult> {
  const command = "combat.simulate-exchange";
  const input = { healthFile, offensiveActionFile };
  const before = await captureWorkspaceState(workspaceRoot);
  const health = await loadValidHealth(workspaceRoot, healthFile);
  if (!isLoadedHealth(health)) return operationResult({ command, status: "failed", input, errors: health.errors });
  const action = await loadValidOffensiveAction(workspaceRoot, offensiveActionFile);
  if (!isLoadedOffensiveAction(action)) return operationResult({ command, status: "failed", input: { ...input, healthFile: health.relativePath }, errors: action.errors });

  const simulation = simulateCombatExchange(health.profile, action.profile);
  if (!simulation) {
    return operationResult({
      command,
      status: "failed",
      input: { healthFile: health.relativePath, offensiveActionFile: action.relativePath },
      errors: [{
        code: ErrorCodes.OffensiveActionSemanticInvalid,
        message: "Offensive action has no valid active step for a confirmed hit",
        details: { activeStartSeconds: action.profile.activeStartSeconds, activeEndSeconds: action.profile.activeEndSeconds }
      }]
    });
  }

  const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []);
  if (!audit.ok) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.HealthWriteBlocked, message: "Read-only combat exchange simulation changed unexpected files", details: { unexpectedFiles: audit.unexpectedFiles } }], changedFiles: audit.changedFiles });
  return operationResult({ command, status: "passed", input: { healthFile: health.relativePath, offensiveActionFile: action.relativePath }, data: simulation });
}
