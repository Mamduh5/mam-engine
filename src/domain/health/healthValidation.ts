import type { ErrorObject } from "ajv";

import { validateHealthSchema } from "../../infrastructure/schemas/ajvValidator";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import type { HealthProfile } from "./healthTypes";

export interface HealthValidationResult { valid: boolean; profile: HealthProfile | null; errors: OperationError[] }

export function validateHealthDefinition(value: unknown): HealthValidationResult {
  if (record(value) && Object.prototype.hasOwnProperty.call(value, "schemaVersion") && value.schemaVersion !== 1) return failure({ code: ErrorCodes.HealthSchemaVersionUnsupported, path: "schemaVersion", message: "Only health schemaVersion 1 is supported", actual: value.schemaVersion, expected: 1 });
  const schemaErrors = validateHealthSchema(value); if (schemaErrors.length > 0) return { valid: false, profile: null, errors: schemaErrors.map((item) => normalizeSchemaError(item, value)) };
  const profile = structuredClone(value) as HealthProfile; const errors: OperationError[] = [];
  check(errors, profile.maxHealth > 0, "maxHealth", profile.maxHealth, "> 0");
  check(errors, profile.startingHealth >= 0 && profile.startingHealth <= profile.maxHealth, "startingHealth", profile.startingHealth, `[0, ${profile.maxHealth}]`);
  return errors.length === 0 ? { valid: true, profile, errors } : { valid: false, profile: null, errors };
}

function check(errors: OperationError[], valid: boolean, path: string, actual: unknown, expected: unknown): void { if (!valid) errors.push({ code: ErrorCodes.HealthSemanticInvalid, path, message: `${path} must satisfy ${String(expected)}`, actual, expected }); }
function failure(error: OperationError): HealthValidationResult { return { valid: false, profile: null, errors: [error] }; }
function normalizeSchemaError(item: ErrorObject, value: unknown): OperationError { const extra = item.keyword === "additionalProperties" ? String((item.params as { additionalProperty?: unknown }).additionalProperty ?? "") : ""; const missing = item.keyword === "required" ? String((item.params as { missingProperty?: unknown }).missingProperty ?? "") : ""; const pointer = [item.instancePath, extra || missing].filter(Boolean).join("/"); const path = pointer.replace(/^\//, "").replaceAll("/", "."); return { code: ErrorCodes.HealthSchemaInvalid, path: path || undefined, message: `Health schema validation failed: ${item.message ?? item.keyword}`, actual: path ? valueAtPath(value, path) : value, expected: item.keyword }; }
function valueAtPath(value: unknown, path: string): unknown { let current = value; for (const segment of path.split(".")) { if (!record(current)) return undefined; current = current[segment]; } return current; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
