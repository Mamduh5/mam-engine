import type { ErrorObject } from "ajv";

import { validateHunterSchema } from "../../infrastructure/schemas/ajvValidator";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import type { HunterProfile } from "./hunterTypes";

export interface HunterValidationResult { valid: boolean; profile: HunterProfile | null; errors: OperationError[] }

export function validateHunterDefinition(value: unknown): HunterValidationResult {
  if (record(value) && Object.prototype.hasOwnProperty.call(value, "schemaVersion") && value.schemaVersion !== 1) return failure({ code: ErrorCodes.HunterSchemaVersionUnsupported, path: "schemaVersion", message: "Only hunter schemaVersion 1 is supported", actual: value.schemaVersion, expected: 1 });
  const schemaErrors = validateHunterSchema(value); if (schemaErrors.length > 0) return { valid: false, profile: null, errors: schemaErrors.map((item) => normalizeSchemaError(item, value)) };
  const profile = structuredClone(value) as HunterProfile; const errors: OperationError[] = [];
  for (const property of ["id", "displayName", "healthFile", "staminaFile"] as const) check(errors, profile[property].trim().length > 0, property, profile[property], "non-blank string");
  for (const property of ["healthFile", "staminaFile"] as const) check(errors, profile[property].trim().toLowerCase().endsWith(".json"), property, profile[property], "JSON file path");
  return errors.length === 0 ? { valid: true, profile, errors } : { valid: false, profile: null, errors };
}

function check(errors: OperationError[], valid: boolean, path: string, actual: unknown, expected: unknown): void { if (!valid) errors.push({ code: ErrorCodes.HunterSemanticInvalid, path, message: `Hunter semantic validation failed at ${path}`, actual, expected }); }
function failure(error: OperationError): HunterValidationResult { return { valid: false, profile: null, errors: [error] }; }
function normalizeSchemaError(item: ErrorObject, value: unknown): OperationError { const extra = item.keyword === "additionalProperties" ? String((item.params as { additionalProperty?: unknown }).additionalProperty ?? "") : ""; const missing = item.keyword === "required" ? String((item.params as { missingProperty?: unknown }).missingProperty ?? "") : ""; const pointer = [item.instancePath, extra || missing].filter(Boolean).join("/"); const path = pointer.replace(/^\//, "").replaceAll("/", "."); return { code: ErrorCodes.HunterSchemaInvalid, path: path || undefined, message: `Hunter schema validation failed: ${item.message ?? item.keyword}`, actual: path ? valueAtPath(value, path) : value, expected: item.keyword }; }
function valueAtPath(value: unknown, path: string): unknown { let current = value; for (const segment of path.split(".")) { if (!record(current)) return undefined; current = current[segment]; } return current; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
