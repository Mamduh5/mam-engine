import { simulateCamera } from "../../domain/camera/cameraSimulation";
import type { CameraScenario } from "../../domain/camera/cameraTypes";
import { auditChangedFiles, captureWorkspaceState } from "../../infrastructure/files/changedFileAudit";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedCamera, loadValidCamera } from "./cameraOperationSupport";

export async function simulateCameraFile(workspaceRoot: string, inputFile: string, scenario: CameraScenario, seconds?: number, fixedDelta?: number): Promise<OperationResult> {
  const command = "camera.simulate"; const input = { file: inputFile, scenario, ...(seconds === undefined ? {} : { seconds }), ...(fixedDelta === undefined ? {} : { fixedDelta }) };
  const before = await captureWorkspaceState(workspaceRoot); const loaded = await loadValidCamera(workspaceRoot, inputFile);
  if (!isLoadedCamera(loaded)) return operationResult({ command, status: "failed", input, errors: loaded.errors });
  const simulation = simulateCamera(loaded.profile, scenario, seconds, fixedDelta);
  const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []);
  if (!audit.ok) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.CameraWriteBlocked, message: "Read-only camera simulation changed unexpected files", details: { unexpectedFiles: audit.unexpectedFiles } }], changedFiles: audit.changedFiles });
  return operationResult({ command, status: "passed", input: { ...input, file: loaded.relativePath }, data: simulation });
}
