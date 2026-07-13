import type { ErrorObject } from "ajv";

import { validateContactVolumeSchema } from "../../infrastructure/schemas/ajvValidator";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import type { ContactVolumeProfile } from "./contactVolumeTypes";

export interface ContactVolumeValidationResult { valid: boolean; profile: ContactVolumeProfile | null; errors: OperationError[] }

export function validateContactVolumeDefinition(value: unknown): ContactVolumeValidationResult {
  if (record(value) && Object.prototype.hasOwnProperty.call(value, "schemaVersion") && value.schemaVersion !== 1) return failure({ code: ErrorCodes.ContactVolumeSchemaVersionUnsupported, path: "schemaVersion", message: "Only contact volume schemaVersion 1 is supported", actual: value.schemaVersion, expected: 1 });
  const schemaErrors = validateContactVolumeSchema(value);
  if (schemaErrors.length > 0) return { valid: false, profile: null, errors: schemaErrors.map((item) => normalizeSchemaError(item, value)) };
  const profile = structuredClone(value) as ContactVolumeProfile; const errors: OperationError[] = [];
  for (const axis of ["x", "y", "z"] as const) check(errors, Number.isFinite(profile.center[axis]), `center.${axis}`, profile.center[axis], "finite number");
  check(errors, Number.isFinite(profile.radius) && profile.radius > 0, "radius", profile.radius, "> 0");
  check(errors, Number.isFinite(profile.activeStartSeconds) && profile.activeStartSeconds >= 0, "activeStartSeconds", profile.activeStartSeconds, ">= 0");
  check(errors, Number.isFinite(profile.activeEndSeconds) && profile.activeEndSeconds >= 0, "activeEndSeconds", profile.activeEndSeconds, ">= 0");
  check(errors, profile.activeEndSeconds >= profile.activeStartSeconds, "activeEndSeconds", profile.activeEndSeconds, `>= ${profile.activeStartSeconds}`);
  return errors.length === 0 ? { valid: true, profile, errors } : { valid: false, profile: null, errors };
}

function check(errors: OperationError[], valid: boolean, path: string, actual: unknown, expected: unknown): void { if (!valid) errors.push({ code: ErrorCodes.ContactVolumeSemanticInvalid, path, message: `${path} must satisfy ${String(expected)}`, actual, expected }); }
function failure(error: OperationError): ContactVolumeValidationResult { return { valid: false, profile: null, errors: [error] }; }
function normalizeSchemaError(item: ErrorObject, value: unknown): OperationError { const extra = item.keyword === "additionalProperties" ? String((item.params as { additionalProperty?: unknown }).additionalProperty ?? "") : ""; const missing = item.keyword === "required" ? String((item.params as { missingProperty?: unknown }).missingProperty ?? "") : ""; const pointer = [item.instancePath, extra || missing].filter(Boolean).join("/"); const path = pointer.replace(/^\//, "").replaceAll("/", "."); return { code: ErrorCodes.ContactVolumeSchemaInvalid, path: path || undefined, message: `Contact volume schema validation failed: ${item.message ?? item.keyword}`, actual: path ? valueAtPath(value, path) : value, expected: item.keyword }; }
function valueAtPath(value: unknown, path: string): unknown { let current = value; for (const segment of path.split(".")) { if (!record(current)) return undefined; current = current[segment]; } return current; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
