import { auditChangedFiles, captureWorkspaceState } from "../../infrastructure/files/changedFileAudit";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { beginReadOnlyAudit, isLoadedMovement, loadErrors, loadValidMovement } from "./movementOperationSupport";

export async function validateMovementFile(workspaceRoot: string, inputFile: string): Promise<OperationResult> {
  const command = "movement.validate";
  const input = { file: inputFile };
  const before = await beginReadOnlyAudit(workspaceRoot);
  const loaded = await loadValidMovement(workspaceRoot, inputFile);
  const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []);
  if (!audit.ok) {
    return operationResult({
      command,
      status: "failed",
      input,
      errors: [{
        code: ErrorCodes.MovementWriteBlocked,
        message: "Read-only validation changed unexpected files",
        details: { unexpectedFiles: audit.unexpectedFiles }
      }],
      changedFiles: audit.changedFiles
    });
  }
  if (!isLoadedMovement(loaded)) {
    return operationResult({ command, status: "failed", input, errors: loadErrors(loaded) });
  }
  return operationResult({
    command,
    status: "passed",
    input: { file: loaded.relativePath },
    data: { valid: true, schemaVersion: loaded.profile.schemaVersion, profileId: loaded.profile.id }
  });
}
