import { auditChangedFiles, captureWorkspaceState } from "../../infrastructure/files/changedFileAudit";
import { listSnapshotSummaries } from "../../infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";

export async function listSnapshots(workspaceRoot: string): Promise<OperationResult> {
  const command = "snapshot.list";
  const before = await captureWorkspaceState(workspaceRoot);
  const snapshots = await listSnapshotSummaries(workspaceRoot);
  const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []);
  if (!audit.ok) {
    return operationResult({
      command,
      status: "failed",
      errors: [{
        code: ErrorCodes.MovementWriteBlocked,
        message: "Read-only snapshot listing changed unexpected files",
        details: { unexpectedFiles: audit.unexpectedFiles }
      }],
      changedFiles: audit.changedFiles
    });
  }
  return operationResult({ command, status: "passed", data: { snapshots } });
}
