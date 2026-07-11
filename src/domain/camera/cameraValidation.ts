import type { ErrorObject } from "ajv";

import { validateCameraSchema } from "../../infrastructure/schemas/ajvValidator";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import { normalizeYawDegrees } from "./cameraMath";
import type { CameraProfile } from "./cameraTypes";

export interface CameraValidationResult {
  valid: boolean;
  profile: CameraProfile | null;
  errors: OperationError[];
}

export function validateCameraDefinition(value: unknown): CameraValidationResult {
  if (isRecord(value) && Object.prototype.hasOwnProperty.call(value, "schemaVersion") && value.schemaVersion !== 1) {
    return failure({ code: ErrorCodes.CameraSchemaVersionUnsupported, path: "schemaVersion", message: "Only camera schemaVersion 1 is supported", actual: value.schemaVersion, expected: 1 });
  }
  const schemaErrors = validateCameraSchema(value);
  if (schemaErrors.length > 0) {
    return { valid: false, profile: null, errors: schemaErrors.map((item) => normalizeSchemaError(item, value)) };
  }
  const profile = structuredClone(value) as CameraProfile;
  profile.orbit.initialYawDegrees = normalizeYawDegrees(profile.orbit.initialYawDegrees);
  const errors = validateSemantics(profile);
  return errors.length === 0 ? { valid: true, profile, errors: [] } : { valid: false, profile: null, errors };
}

function validateSemantics(profile: CameraProfile): OperationError[] {
  const errors: OperationError[] = [];
  const { orbit, follow, recenter, collision, lens } = profile;
  check(errors, orbit.yawSpeedDegreesPerSecond > 0, ErrorCodes.CameraOrbitInvalid, "orbit.yawSpeedDegreesPerSecond", orbit.yawSpeedDegreesPerSecond, "> 0");
  check(errors, orbit.pitchSpeedDegreesPerSecond > 0, ErrorCodes.CameraOrbitInvalid, "orbit.pitchSpeedDegreesPerSecond", orbit.pitchSpeedDegreesPerSecond, "> 0");
  check(errors, orbit.minimumPitchDegrees >= -89, ErrorCodes.CameraPitchRangeInvalid, "orbit.minimumPitchDegrees", orbit.minimumPitchDegrees, ">= -89");
  check(errors, orbit.maximumPitchDegrees <= 89, ErrorCodes.CameraPitchRangeInvalid, "orbit.maximumPitchDegrees", orbit.maximumPitchDegrees, "<= 89");
  check(errors, orbit.minimumPitchDegrees < orbit.maximumPitchDegrees, ErrorCodes.CameraPitchRangeInvalid, "orbit.maximumPitchDegrees", orbit.maximumPitchDegrees, `> ${orbit.minimumPitchDegrees}`);
  check(errors, orbit.initialPitchDegrees >= orbit.minimumPitchDegrees && orbit.initialPitchDegrees <= orbit.maximumPitchDegrees, ErrorCodes.CameraPitchRangeInvalid, "orbit.initialPitchDegrees", orbit.initialPitchDegrees, `[${orbit.minimumPitchDegrees}, ${orbit.maximumPitchDegrees}]`);

  check(errors, follow.distance > 0, ErrorCodes.CameraFollowInvalid, "follow.distance", follow.distance, "> 0");
  check(errors, follow.height >= 0, ErrorCodes.CameraFollowInvalid, "follow.height", follow.height, ">= 0");
  check(errors, follow.positionHalfLifeSeconds >= 0, ErrorCodes.CameraFollowInvalid, "follow.positionHalfLifeSeconds", follow.positionHalfLifeSeconds, ">= 0");
  check(errors, follow.rotationHalfLifeSeconds >= 0, ErrorCodes.CameraFollowInvalid, "follow.rotationHalfLifeSeconds", follow.rotationHalfLifeSeconds, ">= 0");

  check(errors, recenter.delaySeconds >= 0, ErrorCodes.CameraRecenterInvalid, "recenter.delaySeconds", recenter.delaySeconds, ">= 0");
  check(errors, recenter.yawSpeedDegreesPerSecond > 0, ErrorCodes.CameraRecenterInvalid, "recenter.yawSpeedDegreesPerSecond", recenter.yawSpeedDegreesPerSecond, "> 0");
  check(errors, recenter.movementInputThreshold >= 0 && recenter.movementInputThreshold <= 1, ErrorCodes.CameraRecenterInvalid, "recenter.movementInputThreshold", recenter.movementInputThreshold, "[0, 1]");

  check(errors, collision.probeRadius > 0, ErrorCodes.CameraCollisionInvalid, "collision.probeRadius", collision.probeRadius, "> 0");
  check(errors, collision.minimumDistance > 0, ErrorCodes.CameraCollisionInvalid, "collision.minimumDistance", collision.minimumDistance, "> 0");
  check(errors, collision.minimumDistance <= follow.distance, ErrorCodes.CameraCollisionInvalid, "collision.minimumDistance", collision.minimumDistance, `<= ${follow.distance}`);
  check(errors, collision.returnHalfLifeSeconds >= 0, ErrorCodes.CameraCollisionInvalid, "collision.returnHalfLifeSeconds", collision.returnHalfLifeSeconds, ">= 0");

  check(errors, lens.fieldOfViewDegrees >= 20 && lens.fieldOfViewDegrees <= 120, ErrorCodes.CameraLensInvalid, "lens.fieldOfViewDegrees", lens.fieldOfViewDegrees, "[20, 120]");
  check(errors, lens.nearClipDistance > 0, ErrorCodes.CameraLensInvalid, "lens.nearClipDistance", lens.nearClipDistance, "> 0");
  check(errors, lens.farClipDistance > lens.nearClipDistance, ErrorCodes.CameraLensInvalid, "lens.farClipDistance", lens.farClipDistance, `> ${lens.nearClipDistance}`);
  return errors;
}

function check(errors: OperationError[], valid: boolean, code: OperationError["code"], path: string, actual: unknown, expected: unknown): void {
  if (!valid) errors.push({ code, path, message: `${path} must satisfy ${String(expected)}`, actual, expected });
}

function normalizeSchemaError(item: ErrorObject, value: unknown): OperationError {
  const extra = item.keyword === "additionalProperties" ? String((item.params as { additionalProperty?: unknown }).additionalProperty ?? "") : "";
  const missing = item.keyword === "required" ? String((item.params as { missingProperty?: unknown }).missingProperty ?? "") : "";
  const pointer = [item.instancePath, extra || missing].filter(Boolean).join("/");
  const path = pointer.replace(/^\//, "").replaceAll("/", ".");
  return { code: ErrorCodes.CameraSchemaInvalid, path: path || undefined, message: `Camera schema validation failed: ${item.message ?? item.keyword}`, actual: path ? valueAtPath(value, path) : value, expected: item.keyword };
}

function valueAtPath(value: unknown, path: string): unknown {
  let current = value;
  for (const segment of path.split(".")) { if (!isRecord(current)) return undefined; current = current[segment]; }
  return current;
}
function failure(error: OperationError): CameraValidationResult { return { valid: false, profile: null, errors: [error] }; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
