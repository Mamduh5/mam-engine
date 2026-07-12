import type { ErrorObject } from "ajv";

import { validateOffensiveActionSchema } from "../../infrastructure/schemas/ajvValidator";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import type { OffensiveActionProfile } from "./offensiveActionTypes";

export interface OffensiveActionValidationResult { valid: boolean; profile: OffensiveActionProfile | null; errors: OperationError[] }

export function validateOffensiveActionDefinition(value: unknown): OffensiveActionValidationResult {
  if (record(value) && Object.prototype.hasOwnProperty.call(value, "schemaVersion") && value.schemaVersion !== 1) return failure({ code: ErrorCodes.OffensiveActionSchemaVersionUnsupported, path: "schemaVersion", message: "Only offensive action schemaVersion 1 is supported", actual: value.schemaVersion, expected: 1 });
  const schemaErrors = validateOffensiveActionSchema(value);
  if (schemaErrors.length > 0) return { valid: false, profile: null, errors: schemaErrors.map((item) => normalizeSchemaError(item, value)) };
  const profile = structuredClone(value) as OffensiveActionProfile; const errors: OperationError[] = [];
  check(errors, profile.durationSeconds > 0, "durationSeconds", profile.durationSeconds, "> 0");
  for (const field of ["staminaCost", "movementDistance", "activeStartSeconds", "activeEndSeconds", "cooldownSeconds"] as const) check(errors, profile[field] >= 0, field, profile[field], ">= 0");
  check(errors, profile.damage > 0, "damage", profile.damage, "> 0");
  check(errors, profile.activeStartSeconds <= profile.activeEndSeconds, "activeStartSeconds", profile.activeStartSeconds, `<= ${profile.activeEndSeconds}`);
  check(errors, profile.activeEndSeconds <= profile.durationSeconds, "activeEndSeconds", profile.activeEndSeconds, `<= ${profile.durationSeconds}`);
  return errors.length === 0 ? { valid: true, profile, errors } : { valid: false, profile: null, errors };
}

function check(errors: OperationError[], valid: boolean, path: string, actual: unknown, expected: unknown): void { if (!valid) errors.push({ code: ErrorCodes.OffensiveActionSemanticInvalid, path, message: `${path} must satisfy ${String(expected)}`, actual, expected }); }
function failure(error: OperationError): OffensiveActionValidationResult { return { valid: false, profile: null, errors: [error] }; }
function normalizeSchemaError(item: ErrorObject, value: unknown): OperationError { const extra = item.keyword === "additionalProperties" ? String((item.params as { additionalProperty?: unknown }).additionalProperty ?? "") : ""; const missing = item.keyword === "required" ? String((item.params as { missingProperty?: unknown }).missingProperty ?? "") : ""; const pointer = [item.instancePath, extra || missing].filter(Boolean).join("/"); const path = pointer.replace(/^\//, "").replaceAll("/", "."); return { code: ErrorCodes.OffensiveActionSchemaInvalid, path: path || undefined, message: `Offensive action schema validation failed: ${item.message ?? item.keyword}`, actual: path ? valueAtPath(value, path) : value, expected: item.keyword }; }
function valueAtPath(value: unknown, path: string): unknown { let current = value; for (const segment of path.split(".")) { if (!record(current)) return undefined; current = current[segment]; } return current; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
