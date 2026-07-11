import { auditChangedFiles, captureWorkspaceState } from "../../infrastructure/files/changedFileAudit";
import { createFileSnapshot } from "../../infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedDefinition, loadValidDefinition } from "../definitions/loadValidDefinition";

export async function createSnapshot(workspaceRoot: string, inputFile: string): Promise<OperationResult> {
  const command = "snapshot.create";
  const input = { file: inputFile };
  const loaded = await loadValidDefinition(workspaceRoot, inputFile);
  if (!isLoadedDefinition(loaded)) {
    return operationResult({ command, status: "failed", input, errors: loaded.errors });
  }
  const before = await captureWorkspaceState(workspaceRoot);
  try {
    const snapshot = await createFileSnapshot(workspaceRoot, loaded.relativePath, loaded.content, command, loaded.kind);
    const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), [snapshot.relativePath]);
    if (!audit.ok) {
      return operationResult({
        command,
        status: "failed",
        input: { file: loaded.relativePath },
        errors: [{
          code: ErrorCodes.MovementWriteBlocked,
          message: "Snapshot creation changed files outside its declared scope",
          details: { unexpectedFiles: audit.unexpectedFiles }
        }],
        changedFiles: audit.changedFiles,
        snapshotId: snapshot.record.snapshotId
      });
    }
    return operationResult({
      command,
      status: "passed",
      input: { file: loaded.relativePath },
      data: {
        snapshot: {
          metadataVersion: snapshot.record.metadataVersion,
          snapshotId: snapshot.record.snapshotId,
          timestamp: snapshot.record.timestamp,
          operation: snapshot.record.operation,
          targetPath: snapshot.record.targetPath,
          contentHash: snapshot.record.contentHash
          ,definitionKind: snapshot.record.definitionKind
        }
      },
      changedFiles: audit.changedFiles,
      snapshotId: snapshot.record.snapshotId
    });
  } catch (caught) {
    return operationResult({
      command,
      status: "failed",
      input: { file: loaded.relativePath },
      errors: [{
        code: ErrorCodes.MovementWriteBlocked,
        message: `Snapshot could not be created: ${caught instanceof Error ? caught.message : String(caught)}`
      }]
    });
  }
}
