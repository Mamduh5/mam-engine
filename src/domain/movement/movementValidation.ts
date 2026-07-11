import type { ErrorObject } from "ajv";

import { validateMovementSchema } from "../../infrastructure/schemas/ajvValidator";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import type { MovementProfile } from "./movementTypes";

export interface MovementValidationResult {
  valid: boolean;
  profile: MovementProfile | null;
  errors: OperationError[];
}

export function validateMovementDefinition(value: unknown): MovementValidationResult {
  if (isRecord(value) && Object.prototype.hasOwnProperty.call(value, "schemaVersion") && value.schemaVersion !== 1) {
    return failure({
      code: ErrorCodes.MovementSchemaVersionUnsupported,
      path: "schemaVersion",
      message: "Only movement schemaVersion 1 is supported",
      actual: value.schemaVersion,
      expected: 1
    });
  }

  const schemaErrors = validateMovementSchema(value);
  if (schemaErrors.length > 0) {
    return {
      valid: false,
      profile: null,
      errors: schemaErrors.map((error) => normalizeSchemaError(error, value))
    };
  }

  const profile = value as MovementProfile;
  const semanticErrors = validateSemantics(profile);
  return semanticErrors.length === 0
    ? { valid: true, profile, errors: [] }
    : { valid: false, profile: null, errors: semanticErrors };
}

function validateSemantics(profile: MovementProfile): OperationError[] {
  const errors: OperationError[] = [];
  const { ground, stamina, dodge } = profile;

  if (!(ground.walkSpeed > 0)) {
    errors.push(error(ErrorCodes.MovementSpeedOrderInvalid, "ground.walkSpeed", "walkSpeed must be greater than 0", ground.walkSpeed, "> 0"));
  }
  if (ground.runSpeed < ground.walkSpeed) {
    errors.push(error(ErrorCodes.MovementSpeedOrderInvalid, "ground.runSpeed", "runSpeed must be greater than or equal to walkSpeed", ground.runSpeed, `>= ${ground.walkSpeed}`));
  }
  if (ground.sprintSpeed < ground.runSpeed) {
    errors.push(error(ErrorCodes.MovementSpeedOrderInvalid, "ground.sprintSpeed", "sprintSpeed must be greater than or equal to runSpeed", ground.sprintSpeed, `>= ${ground.runSpeed}`));
  }
  if (!(ground.acceleration > 0)) {
    errors.push(error(ErrorCodes.MovementAccelerationInvalid, "ground.acceleration", "acceleration must be greater than 0", ground.acceleration, "> 0"));
  }
  if (!(ground.deceleration > 0)) {
    errors.push(error(ErrorCodes.MovementDecelerationInvalid, "ground.deceleration", "deceleration must be greater than 0", ground.deceleration, "> 0"));
  }
  if (!(ground.rotationSpeedDegrees > 0)) {
    errors.push(error(ErrorCodes.MovementRotationInvalid, "ground.rotationSpeedDegrees", "rotationSpeedDegrees must be greater than 0", ground.rotationSpeedDegrees, "> 0"));
  }

  validateStamina(errors, profile);
  validateDodge(errors, profile);
  return errors;
}

function validateStamina(errors: OperationError[], profile: MovementProfile): void {
  const { stamina } = profile;
  const checks: Array<[boolean, keyof typeof stamina, string, string]> = [
    [stamina.maximum > 0, "maximum", "maximum must be greater than 0", "> 0"],
    [stamina.sprintCostPerSecond >= 0, "sprintCostPerSecond", "sprintCostPerSecond must be greater than or equal to 0", ">= 0"],
    [stamina.regenerationPerSecond > 0, "regenerationPerSecond", "regenerationPerSecond must be greater than 0", "> 0"],
    [stamina.regenerationDelaySeconds >= 0, "regenerationDelaySeconds", "regenerationDelaySeconds must be greater than or equal to 0", ">= 0"],
    [stamina.minimumToStartSprint >= 0, "minimumToStartSprint", "minimumToStartSprint must be greater than or equal to 0", ">= 0"],
    [stamina.minimumToStartSprint <= stamina.maximum, "minimumToStartSprint", "minimumToStartSprint must not exceed maximum stamina", `<= ${stamina.maximum}`]
  ];
  for (const [valid, field, message, expected] of checks) {
    if (!valid) {
      errors.push(error(ErrorCodes.MovementStaminaInvalid, `stamina.${field}`, message, stamina[field], expected));
    }
  }
}

function validateDodge(errors: OperationError[], profile: MovementProfile): void {
  const { dodge, stamina } = profile;
  const checks: Array<[boolean, keyof typeof dodge, string, string]> = [
    [dodge.distance > 0, "distance", "distance must be greater than 0", "> 0"],
    [dodge.durationSeconds > 0, "durationSeconds", "durationSeconds must be greater than 0", "> 0"],
    [dodge.staminaCost >= 0, "staminaCost", "staminaCost must be greater than or equal to 0", ">= 0"],
    [dodge.staminaCost <= stamina.maximum, "staminaCost", "staminaCost must not exceed maximum stamina", `<= ${stamina.maximum}`],
    [dodge.steeringMultiplier >= 0, "steeringMultiplier", "steeringMultiplier must be greater than or equal to 0", ">= 0"],
    [dodge.steeringMultiplier <= 1, "steeringMultiplier", "steeringMultiplier must be less than or equal to 1", "<= 1"]
  ];
  for (const [valid, field, message, expected] of checks) {
    if (!valid) {
      errors.push(error(ErrorCodes.MovementDodgeInvalid, `dodge.${field}`, message, dodge[field], expected));
    }
  }

  const iframeChecks: Array<[boolean, keyof typeof dodge, string, string]> = [
    [dodge.invulnerabilityStartSeconds >= 0, "invulnerabilityStartSeconds", "invulnerabilityStartSeconds must be greater than or equal to 0", ">= 0"],
    [dodge.invulnerabilityEndSeconds > dodge.invulnerabilityStartSeconds, "invulnerabilityEndSeconds", "invulnerabilityEndSeconds must be greater than invulnerabilityStartSeconds", `> ${dodge.invulnerabilityStartSeconds}`],
    [dodge.invulnerabilityEndSeconds <= dodge.durationSeconds, "invulnerabilityEndSeconds", "invulnerabilityEndSeconds must not exceed dodge duration", `<= ${dodge.durationSeconds}`]
  ];
  for (const [valid, field, message, expected] of iframeChecks) {
    if (!valid) {
      errors.push(error(ErrorCodes.MovementDodgeIframeWindowInvalid, `dodge.${field}`, message, dodge[field], expected));
    }
  }
}

function normalizeSchemaError(schemaError: ErrorObject, value: unknown): OperationError {
  const additionalProperty = schemaError.keyword === "additionalProperties"
    ? String((schemaError.params as { additionalProperty?: unknown }).additionalProperty ?? "")
    : "";
  const missingProperty = schemaError.keyword === "required"
    ? String((schemaError.params as { missingProperty?: unknown }).missingProperty ?? "")
    : "";
  const pointer = [schemaError.instancePath, additionalProperty || missingProperty].filter(Boolean).join("/");
  const path = pointer.replace(/^\//, "").replaceAll("/", ".");
  return {
    code: ErrorCodes.MovementSchemaInvalid,
    path: path || undefined,
    message: `Movement schema validation failed: ${schemaError.message ?? schemaError.keyword}`,
    actual: path ? valueAtPath(value, path) : value,
    expected: schemaError.keyword
  };
}

function valueAtPath(value: unknown, dottedPath: string): unknown {
  let current = value;
  for (const segment of dottedPath.split(".")) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function error(code: OperationError["code"], path: string, message: string, actual: unknown, expected: unknown): OperationError {
  return { code, path, message, actual, expected };
}

function failure(errorValue: OperationError): MovementValidationResult {
  return { valid: false, profile: null, errors: [errorValue] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
