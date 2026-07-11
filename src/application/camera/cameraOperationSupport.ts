import { validateCameraDefinition } from "../../domain/camera/cameraValidation";
import type { CameraProfile } from "../../domain/camera/cameraTypes";
import { resolveWorkspacePath } from "../../infrastructure/files/changedFileAudit";
import { JsonFileReadError, readJsonFile } from "../../infrastructure/files/jsonFileStore";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";

export interface LoadedCamera { absolutePath: string; relativePath: string; content: string; profile: CameraProfile }
export interface LoadCameraFailure { errors: OperationError[]; absolutePath?: string; relativePath?: string }

export async function loadValidCamera(workspaceRoot: string, inputFile: string): Promise<LoadedCamera | LoadCameraFailure> {
  let resolved: { absolutePath: string; relativePath: string };
  try { resolved = resolveWorkspacePath(workspaceRoot, inputFile); }
  catch (caught) { return { errors: [{ code: ErrorCodes.CameraWriteBlocked, path: inputFile, message: caught instanceof Error ? caught.message : String(caught) }] }; }
  let read: Awaited<ReturnType<typeof readJsonFile>>;
  try { read = await readJsonFile(resolved.absolutePath); }
  catch (caught) {
    if (caught instanceof JsonFileReadError) {
      const code = caught.kind === "not_found" ? ErrorCodes.CameraFileNotFound : caught.kind === "invalid_json" ? ErrorCodes.CameraJsonInvalid : ErrorCodes.CameraFileReadFailed;
      return { ...resolved, errors: [{ code, path: resolved.relativePath, message: `Camera file ${caught.kind === "not_found" ? "was not found" : caught.kind === "invalid_json" ? "contains invalid JSON" : "could not be read"}` }] };
    }
    throw caught;
  }
  const validation = validateCameraDefinition(read.value);
  if (!validation.valid || validation.profile === null) return { ...resolved, errors: validation.errors };
  return { ...resolved, content: read.content, profile: validation.profile };
}
export function isLoadedCamera(value: LoadedCamera | LoadCameraFailure): value is LoadedCamera { return "profile" in value; }
