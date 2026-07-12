import { simulateStaminaAction } from "../../domain/stamina/staminaSimulation";
import type { StaminaActionProfile } from "../../domain/stamina/staminaTypes";
import { auditChangedFiles, captureWorkspaceState } from "../../infrastructure/files/changedFileAudit";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedDefinition, loadValidDefinition } from "../definitions/loadValidDefinition";
import { isLoadedStamina, loadValidStamina } from "./staminaOperationSupport";

export async function simulateStaminaActionFiles(workspaceRoot: string, staminaFile: string, actionFile: string): Promise<OperationResult> {
  const command = "stamina.simulate-action"; const input = { staminaFile, actionFile }; const before = await captureWorkspaceState(workspaceRoot);
  const stamina = await loadValidStamina(workspaceRoot, staminaFile); if (!isLoadedStamina(stamina)) return operationResult({ command, status: "failed", input, errors: stamina.errors });
  const action = await loadValidDefinition(workspaceRoot, actionFile); if (!isLoadedDefinition(action)) return operationResult({ command, status: "failed", input: { ...input, staminaFile: stamina.relativePath }, errors: action.errors });
  if (action.kind !== "offensive-action-profile" && action.kind !== "defensive-action-profile") return operationResult({ command, status: "failed", input: { staminaFile: stamina.relativePath, actionFile: action.relativePath }, errors: [{ code: ErrorCodes.DefinitionKindUnsupported, path: "kind", message: "Stamina simulation requires an offensive-action-profile or defensive-action-profile", actual: action.kind, expected: ["offensive-action-profile", "defensive-action-profile"] }] });
  const simulation = simulateStaminaAction(stamina.profile, action.definition as StaminaActionProfile); const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []);
  if (!audit.ok) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.StaminaWriteBlocked, message: "Read-only stamina action simulation changed unexpected files", details: { unexpectedFiles: audit.unexpectedFiles } }], changedFiles: audit.changedFiles });
  return operationResult({ command, status: "passed", input: { staminaFile: stamina.relativePath, actionFile: action.relativePath }, data: simulation });
}
