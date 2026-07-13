import { simulateEncounter } from "../../domain/encounter/encounterSimulation";
import type { EncounterScenario } from "../../domain/encounter/encounterTypes";
import { auditChangedFiles, captureWorkspaceState } from "../../infrastructure/files/changedFileAudit";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedEncounterBundle, loadValidEncounterBundle } from "./encounterOperationSupport";

export async function simulateEncounterFile(workspaceRoot: string, inputFile: string, scenario: EncounterScenario, fixedDelta?: number): Promise<OperationResult> {
  const command = "encounter.simulate"; const input = { file: inputFile, scenario, ...(fixedDelta === undefined ? {} : { fixedDelta }) };
  if (fixedDelta !== undefined && (!Number.isFinite(fixedDelta) || fixedDelta <= 0)) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.CliArgumentInvalid, path: "fixedDelta", message: "fixed delta must be finite and greater than 0", actual: fixedDelta, expected: "> 0" }] });
  const before = await captureWorkspaceState(workspaceRoot); const loaded = await loadValidEncounterBundle(workspaceRoot, inputFile); if (!isLoadedEncounterBundle(loaded)) return operationResult({ command, status: "failed", input, errors: loaded.errors });
  let simulation; try { simulation = simulateEncounter({ profile: loaded.profile, resolvedDefinitionPaths: loaded.resolvedDefinitionPaths, arena: loaded.arena.profile, hunterHealth: loaded.hunter.health, hunterStamina: loaded.hunter.stamina, weapon: loaded.weapon, enemy: loaded.enemy.profile, enemyResolvedDefinitionPaths: loaded.enemy.resolvedDefinitionPaths, enemyHealth: loaded.enemy.health, enemyReaction: loaded.enemy.reaction, selectedBodyPartId: loaded.selectedBodyPartId, selectedHurtbox: loaded.selectedHurtbox, scenario, fixedDeltaSeconds: fixedDelta }); } catch (caught) { return operationResult({ command, status: "failed", input: { ...input, file: loaded.relativePath }, errors: [{ code: ErrorCodes.EncounterScenarioInvalid, path: "scenario", message: caught instanceof Error ? caught.message : String(caught), actual: scenario }] }); }
  const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []); if (!audit.ok) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.EncounterWriteBlocked, message: "Read-only encounter simulation changed unexpected files", details: { unexpectedFiles: audit.unexpectedFiles } }], changedFiles: audit.changedFiles });
  return operationResult({ command, status: "passed", input: { file: loaded.relativePath, scenario, ...(fixedDelta === undefined ? {} : { fixedDelta }) }, data: simulation });
}
