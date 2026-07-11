import {
  captureWorkspaceState,
  resolveWorkspacePath,
  type FileState
} from "../../infrastructure/files/changedFileAudit";
import { JsonFileReadError, readJsonFile } from "../../infrastructure/files/jsonFileStore";
import { validateMovementDefinition } from "../../domain/movement/movementValidation";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import type { MovementProfile } from "../../domain/movement/movementTypes";

export interface LoadedMovement {
  absolutePath: string;
  relativePath: string;
  content: string;
  profile: MovementProfile;
}

export interface LoadMovementFailure {
  error: OperationError;
  absolutePath?: string;
  relativePath?: string;
}

export async function loadValidMovement(
  workspaceRoot: string,
  inputFile: string
): Promise<LoadedMovement | LoadMovementFailure> {
  let resolved: { absolutePath: string; relativePath: string };
  try {
    resolved = resolveWorkspacePath(workspaceRoot, inputFile);
  } catch (caught) {
    return {
      error: {
        code: ErrorCodes.MovementWriteBlocked,
        path: inputFile,
        message: caught instanceof Error ? caught.message : String(caught)
      }
    };
  }

  let read: Awaited<ReturnType<typeof readJsonFile>>;
  try {
    read = await readJsonFile(resolved.absolutePath);
  } catch (caught) {
    if (caught instanceof JsonFileReadError) {
      return {
        ...resolved,
        error: {
          code: caught.kind === "not_found"
            ? ErrorCodes.MovementFileNotFound
            : caught.kind === "invalid_json"
              ? ErrorCodes.MovementJsonInvalid
              : ErrorCodes.MovementFileReadFailed,
          path: resolved.relativePath,
          message: caught.message
        }
      };
    }
    throw caught;
  }

  const validation = validateMovementDefinition(read.value);
  if (!validation.valid || validation.profile === null) {
    return {
      ...resolved,
      error: validation.errors[0] ?? {
        code: ErrorCodes.MovementSchemaInvalid,
        message: "Movement definition is invalid"
      },
      errors: validation.errors
    } as LoadMovementFailure & { errors: OperationError[] };
  }

  return { ...resolved, content: read.content, profile: validation.profile };
}

export function loadErrors(result: LoadedMovement | LoadMovementFailure): OperationError[] {
  if ("profile" in result) {
    return [];
  }
  const withErrors = result as LoadMovementFailure & { errors?: OperationError[] };
  return withErrors.errors ?? [result.error];
}

export function isLoadedMovement(result: LoadedMovement | LoadMovementFailure): result is LoadedMovement {
  return "profile" in result;
}

export async function beginReadOnlyAudit(workspaceRoot: string): Promise<FileState> {
  return captureWorkspaceState(workspaceRoot);
}
