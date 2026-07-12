import type { ErrorObject } from "ajv";

import { validateStaminaSchema } from "../../infrastructure/schemas/ajvValidator";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import type { StaminaProfile } from "./staminaTypes";

export interface StaminaValidationResult { valid: boolean; profile: StaminaProfile | null; errors: OperationError[] }

export function validateStaminaDefinition(value: unknown): StaminaValidationResult {
  if (record(value) && Object.prototype.hasOwnProperty.call(value, "schemaVersion") && value.schemaVersion !== 1) return failure({ code: ErrorCodes.StaminaSchemaVersionUnsupported, path: "schemaVersion", message: "Only stamina schemaVersion 1 is supported", actual: value.schemaVersion, expected: 1 });
  const schemaErrors = validateStaminaSchema(value); if (schemaErrors.length > 0) return { valid: false, profile: null, errors: schemaErrors.map((item) => normalizeSchemaError(item, value)) };
  const profile = structuredClone(value) as StaminaProfile; const errors: OperationError[] = [];
  check(errors, profile.maxStamina > 0, "maxStamina", profile.maxStamina, "> 0");
  check(errors, profile.startingStamina >= 0 && profile.startingStamina <= profile.maxStamina, "startingStamina", profile.startingStamina, `[0, ${profile.maxStamina}]`);
  return errors.length === 0 ? { valid: true, profile, errors } : { valid: false, profile: null, errors };
}

function check(errors: OperationError[], valid: boolean, path: string, actual: unknown, expected: unknown): void { if (!valid) errors.push({ code: ErrorCodes.StaminaSemanticInvalid, path, message: `${path} must satisfy ${String(expected)}`, actual, expected }); }
function failure(error: OperationError): StaminaValidationResult { return { valid: false, profile: null, errors: [error] }; }
function normalizeSchemaError(item: ErrorObject, value: unknown): OperationError { const extra = item.keyword === "additionalProperties" ? String((item.params as { additionalProperty?: unknown }).additionalProperty ?? "") : ""; const missing = item.keyword === "required" ? String((item.params as { missingProperty?: unknown }).missingProperty ?? "") : ""; const pointer = [item.instancePath, extra || missing].filter(Boolean).join("/"); const path = pointer.replace(/^\//, "").replaceAll("/", "."); return { code: ErrorCodes.StaminaSchemaInvalid, path: path || undefined, message: `Stamina schema validation failed: ${item.message ?? item.keyword}`, actual: path ? valueAtPath(value, path) : value, expected: item.keyword }; }
function valueAtPath(value: unknown, path: string): unknown { let current = value; for (const segment of path.split(".")) { if (!record(current)) return undefined; current = current[segment]; } return current; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
