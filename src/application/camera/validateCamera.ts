import { auditChangedFiles, captureWorkspaceState } from "../../infrastructure/files/changedFileAudit";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedCamera, loadValidCamera } from "./cameraOperationSupport";

export async function validateCameraFile(workspaceRoot: string, inputFile: string): Promise<OperationResult> {
  const command = "camera.validate"; const input = { file: inputFile };
  const before = await captureWorkspaceState(workspaceRoot); const loaded = await loadValidCamera(workspaceRoot, inputFile);
  const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []);
  if (!audit.ok) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.CameraWriteBlocked, message: "Read-only camera validation changed unexpected files", details: { unexpectedFiles: audit.unexpectedFiles } }], changedFiles: audit.changedFiles });
  if (!isLoadedCamera(loaded)) return operationResult({ command, status: "failed", input, errors: loaded.errors });
  return operationResult({ command, status: "passed", input: { file: loaded.relativePath }, data: { valid: true, schemaVersion: loaded.profile.schemaVersion, profileId: loaded.profile.id } });
}
