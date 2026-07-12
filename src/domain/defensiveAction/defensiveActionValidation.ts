import type { ErrorObject } from "ajv";

import { validateDefensiveActionSchema } from "../../infrastructure/schemas/ajvValidator";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import type { DefensiveActionProfile } from "./defensiveActionTypes";

export interface DefensiveActionValidationResult { valid: boolean; profile: DefensiveActionProfile | null; errors: OperationError[] }

export function validateDefensiveActionDefinition(value: unknown): DefensiveActionValidationResult {
  if (record(value) && Object.prototype.hasOwnProperty.call(value, "schemaVersion") && value.schemaVersion !== 1) return failure({ code: ErrorCodes.DefensiveActionSchemaVersionUnsupported, path: "schemaVersion", message: "Only defensive action schemaVersion 1 is supported", actual: value.schemaVersion, expected: 1 });
  const schemaErrors = validateDefensiveActionSchema(value);
  if (schemaErrors.length > 0) return { valid: false, profile: null, errors: schemaErrors.map((item) => normalizeSchemaError(item, value)) };
  const profile = structuredClone(value) as DefensiveActionProfile; const errors: OperationError[] = [];
  check(errors, profile.durationSeconds > 0, "durationSeconds", profile.durationSeconds, "> 0");
  for (const field of ["staminaCost", "movementDistance", "invulnerabilityStartSeconds", "invulnerabilityEndSeconds", "cooldownSeconds"] as const) check(errors, profile[field] >= 0, field, profile[field], ">= 0");
  check(errors, profile.invulnerabilityStartSeconds <= profile.invulnerabilityEndSeconds, "invulnerabilityStartSeconds", profile.invulnerabilityStartSeconds, `<= ${profile.invulnerabilityEndSeconds}`);
  check(errors, profile.invulnerabilityEndSeconds <= profile.durationSeconds, "invulnerabilityEndSeconds", profile.invulnerabilityEndSeconds, `<= ${profile.durationSeconds}`);
  return errors.length === 0 ? { valid: true, profile, errors } : { valid: false, profile: null, errors };
}

function check(errors: OperationError[], valid: boolean, path: string, actual: unknown, expected: unknown): void { if (!valid) errors.push({ code: ErrorCodes.DefensiveActionSemanticInvalid, path, message: `${path} must satisfy ${String(expected)}`, actual, expected }); }
function failure(error: OperationError): DefensiveActionValidationResult { return { valid: false, profile: null, errors: [error] }; }
function normalizeSchemaError(item: ErrorObject, value: unknown): OperationError { const extra = item.keyword === "additionalProperties" ? String((item.params as { additionalProperty?: unknown }).additionalProperty ?? "") : ""; const missing = item.keyword === "required" ? String((item.params as { missingProperty?: unknown }).missingProperty ?? "") : ""; const pointer = [item.instancePath, extra || missing].filter(Boolean).join("/"); const path = pointer.replace(/^\//, "").replaceAll("/", "."); return { code: ErrorCodes.DefensiveActionSchemaInvalid, path: path || undefined, message: `Defensive action schema validation failed: ${item.message ?? item.keyword}`, actual: path ? valueAtPath(value, path) : value, expected: item.keyword }; }
function valueAtPath(value: unknown, path: string): unknown { let current = value; for (const segment of path.split(".")) { if (!record(current)) return undefined; current = current[segment]; } return current; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
