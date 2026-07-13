import { simulateLargeEnemyBehavior } from "../../domain/largeEnemy/largeEnemySimulation";
import type { LargeEnemyScenario } from "../../domain/largeEnemy/largeEnemyTypes";
import { auditChangedFiles, captureWorkspaceState } from "../../infrastructure/files/changedFileAudit";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedLargeEnemyBundle, loadValidLargeEnemyBundle } from "./largeEnemyOperationSupport";

export async function simulateLargeEnemyFile(workspaceRoot: string, inputFile: string, scenario: LargeEnemyScenario, fixedDelta?: number): Promise<OperationResult> {
  const command = "large-enemy.simulate"; const input = { file: inputFile, scenario, ...(fixedDelta === undefined ? {} : { fixedDelta }) };
  if (fixedDelta !== undefined && (!Number.isFinite(fixedDelta) || fixedDelta <= 0)) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.CliArgumentInvalid, path: "fixedDelta", message: "fixed delta must be finite and greater than 0", actual: fixedDelta, expected: "> 0" }] });
  const before = await captureWorkspaceState(workspaceRoot); const loaded = await loadValidLargeEnemyBundle(workspaceRoot, inputFile); if (!isLoadedLargeEnemyBundle(loaded)) return operationResult({ command, status: "failed", input, errors: loaded.errors });
  if (scenario === "primary-part-disabled" && loaded.profile.bodyParts.filter((part) => part.targetable).length < 2) return operationResult({ command, status: "failed", input: { ...input, file: loaded.relativePath }, errors: [{ code: ErrorCodes.LargeEnemyScenarioInvalid, path: "scenario", message: "primary-part-disabled requires another authored targetable body part", actual: scenario, expected: "at least two targetable body parts" }] });
  const simulation = simulateLargeEnemyBehavior(loaded.profile, loaded.resolvedDefinitionPaths, scenario, fixedDelta); const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []);
  if (!audit.ok) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.LargeEnemyWriteBlocked, message: "Read-only large-enemy simulation changed unexpected files", details: { unexpectedFiles: audit.unexpectedFiles } }], changedFiles: audit.changedFiles });
  return operationResult({ command, status: "passed", input: { file: loaded.relativePath, scenario, ...(fixedDelta === undefined ? {} : { fixedDelta }) }, data: simulation });
}
