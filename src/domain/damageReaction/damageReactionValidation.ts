import type { ErrorObject } from "ajv";

import { validateDamageReactionSchema } from "../../infrastructure/schemas/ajvValidator";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import type { DamageReactionProfile } from "./damageReactionTypes";

export interface DamageReactionValidationResult { valid: boolean; profile: DamageReactionProfile | null; errors: OperationError[] }

export function validateDamageReactionDefinition(value: unknown): DamageReactionValidationResult {
  if (record(value) && Object.prototype.hasOwnProperty.call(value, "schemaVersion") && value.schemaVersion !== 1) return failure({ code: ErrorCodes.DamageReactionSchemaVersionUnsupported, path: "schemaVersion", message: "Only damage reaction schemaVersion 1 is supported", actual: value.schemaVersion, expected: 1 });
  const schemaErrors = validateDamageReactionSchema(value); if (schemaErrors.length > 0) return { valid: false, profile: null, errors: schemaErrors.map((item) => normalizeSchemaError(item, value)) };
  const profile = structuredClone(value) as DamageReactionProfile; const errors: OperationError[] = [];
  check(errors, Number.isFinite(profile.staggerThreshold) && profile.staggerThreshold > 0, "staggerThreshold", profile.staggerThreshold, "> 0");
  check(errors, Number.isFinite(profile.hitReactionDurationSeconds) && profile.hitReactionDurationSeconds > 0, "hitReactionDurationSeconds", profile.hitReactionDurationSeconds, "> 0");
  check(errors, Number.isFinite(profile.staggerDurationSeconds) && profile.staggerDurationSeconds > 0, "staggerDurationSeconds", profile.staggerDurationSeconds, "> 0");
  return errors.length === 0 ? { valid: true, profile, errors } : { valid: false, profile: null, errors };
}

function check(errors: OperationError[], valid: boolean, path: string, actual: unknown, expected: unknown): void { if (!valid) errors.push({ code: ErrorCodes.DamageReactionSemanticInvalid, path, message: `${path} must satisfy ${String(expected)}`, actual, expected }); }
function failure(error: OperationError): DamageReactionValidationResult { return { valid: false, profile: null, errors: [error] }; }
function normalizeSchemaError(item: ErrorObject, value: unknown): OperationError { const extra = item.keyword === "additionalProperties" ? String((item.params as { additionalProperty?: unknown }).additionalProperty ?? "") : ""; const missing = item.keyword === "required" ? String((item.params as { missingProperty?: unknown }).missingProperty ?? "") : ""; const pointer = [item.instancePath, extra || missing].filter(Boolean).join("/"); const path = pointer.replace(/^\//, "").replaceAll("/", "."); return { code: ErrorCodes.DamageReactionSchemaInvalid, path: path || undefined, message: `Damage reaction schema validation failed: ${item.message ?? item.keyword}`, actual: path ? valueAtPath(value, path) : value, expected: item.keyword }; }
function valueAtPath(value: unknown, path: string): unknown { let current = value; for (const segment of path.split(".")) { if (!record(current)) return undefined; current = current[segment]; } return current; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
