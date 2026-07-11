import { simulateMovement as runSimulation } from "../../domain/movement/movementSimulation";
import type { MovementScenario } from "../../domain/movement/movementTypes";
import { auditChangedFiles, captureWorkspaceState } from "../../infrastructure/files/changedFileAudit";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { beginReadOnlyAudit, isLoadedMovement, loadErrors, loadValidMovement } from "./movementOperationSupport";

export async function simulateMovementFile(
  workspaceRoot: string,
  inputFile: string,
  scenario: MovementScenario,
  seconds?: number
): Promise<OperationResult> {
  const command = "movement.simulate";
  const input = { file: inputFile, scenario, ...(seconds === undefined ? {} : { seconds }) };
  const before = await beginReadOnlyAudit(workspaceRoot);
  const loaded = await loadValidMovement(workspaceRoot, inputFile);
  if (!isLoadedMovement(loaded)) {
    return operationResult({ command, status: "failed", input, errors: loadErrors(loaded) });
  }
  const simulation = runSimulation(loaded.profile, scenario, seconds);
  const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []);
  if (!audit.ok) {
    return operationResult({
      command,
      status: "failed",
      input,
      errors: [{
        code: ErrorCodes.MovementWriteBlocked,
        message: "Read-only simulation changed unexpected files",
        details: { unexpectedFiles: audit.unexpectedFiles }
      }],
      changedFiles: audit.changedFiles
    });
  }
  return operationResult({
    command,
    status: "passed",
    input: { ...input, file: loaded.relativePath },
    data: simulation
  });
}
