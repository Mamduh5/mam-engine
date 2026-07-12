import { validateCameraDefinition } from "../../domain/camera/cameraValidation";
import type { CameraProfile } from "../../domain/camera/cameraTypes";
import type { DefinitionKind } from "../../domain/definitions/definitionTypes";
import { validateMovementDefinition } from "../../domain/movement/movementValidation";
import type { MovementProfile } from "../../domain/movement/movementTypes";
import { validateTargetingDefinition } from "../../domain/targeting/targetingValidation";
import type { TargetingProfile } from "../../domain/targeting/targetingTypes";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import type { ContentVerification } from "../persistence/transactionalFileReplace";

export type { DefinitionKind } from "../../domain/definitions/definitionTypes";
export type SupportedDefinition = MovementProfile | CameraProfile | TargetingProfile;

export interface DefinitionValidationResult {
  valid: boolean;
  kind: DefinitionKind | null;
  definition: SupportedDefinition | null;
  schemaVersion: number | null;
  errors: OperationError[];
}

export function validateDefinition(value: unknown): DefinitionValidationResult {
  const kind = recordKind(value);
  if (kind === "movement-profile") {
    const result = validateMovementDefinition(value);
    return { valid: result.valid, kind, definition: result.profile, schemaVersion: result.profile?.schemaVersion ?? schemaVersion(value), errors: result.errors };
  }
  if (kind === "camera-profile") {
    const result = validateCameraDefinition(value);
    return { valid: result.valid, kind, definition: result.profile, schemaVersion: result.profile?.schemaVersion ?? schemaVersion(value), errors: result.errors };
  }
  if (kind === "targeting-profile") {
    const result = validateTargetingDefinition(value);
    return { valid: result.valid, kind, definition: result.profile, schemaVersion: result.profile?.schemaVersion ?? schemaVersion(value), errors: result.errors };
  }
  return {
    valid: false,
    kind: null,
    definition: null,
    schemaVersion: schemaVersion(value),
    errors: [{ code: ErrorCodes.DefinitionKindUnsupported, path: "kind", message: "Definition kind must be movement-profile, camera-profile, or targeting-profile", actual: recordKind(value), expected: ["movement-profile", "camera-profile", "targeting-profile"] }]
  };
}

export function verifyDefinitionContent(content: string, expectedKind?: DefinitionKind): ContentVerification<SupportedDefinition> {
  let value: unknown;
  try { value = JSON.parse(content) as unknown; }
  catch { return { validationPassed: false, errors: [{ code: ErrorCodes.DefinitionFileInvalid, message: "Definition content is not valid JSON" }] }; }
  const result = validateDefinition(value);
  if (!result.valid || result.definition === null || result.kind === null) return { validationPassed: false, errors: result.errors };
  if (expectedKind !== undefined && result.kind !== expectedKind) {
    return { validationPassed: false, errors: [{ code: ErrorCodes.SnapshotRollbackFailed, path: "kind", message: "Snapshot and current target definition kinds must match", actual: result.kind, expected: expectedKind }] };
  }
  return { validationPassed: true, value: result.definition };
}

function recordKind(value: unknown): unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>).kind : undefined;
}
function schemaVersion(value: unknown): number | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const version = (value as Record<string, unknown>).schemaVersion;
  return typeof version === "number" ? version : null;
}
