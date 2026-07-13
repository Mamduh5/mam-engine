import type { ErrorObject } from "ajv";

import { validateLargeEnemySchema } from "../../infrastructure/schemas/ajvValidator";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import type { LargeEnemyProfile } from "./largeEnemyTypes";

export interface LargeEnemyValidationResult { valid: boolean; profile: LargeEnemyProfile | null; errors: OperationError[] }

export function validateLargeEnemyDefinition(value: unknown): LargeEnemyValidationResult {
  if (record(value) && Object.prototype.hasOwnProperty.call(value, "schemaVersion") && value.schemaVersion !== 1) return failure({ code: ErrorCodes.LargeEnemySchemaVersionUnsupported, path: "schemaVersion", message: "Only large-enemy schemaVersion 1 is supported", actual: value.schemaVersion, expected: 1 });
  const schemaErrors = validateLargeEnemySchema(value); if (schemaErrors.length > 0) return { valid: false, profile: null, errors: schemaErrors.map((item) => normalizeSchemaError(item, value)) };
  const profile = structuredClone(value) as LargeEnemyProfile; const errors: OperationError[] = [];
  for (const property of ["id", "displayName", "healthFile", "reactionFile", "telegraphName"] as const) check(errors, profile[property].trim().length > 0, property, profile[property], "non-blank string");
  for (const property of ["healthFile", "reactionFile"] as const) check(errors, profile[property].trim().toLowerCase().endsWith(".json"), property, profile[property], "JSON file path");
  const durations = ["idleDurationSeconds", "telegraphDurationSeconds", "attackDurationSeconds", "recoveryDurationSeconds"] as const;
  for (const property of durations) check(errors, Number.isFinite(profile[property]) && profile[property] >= 0, property, profile[property], "finite non-negative number");
  check(errors, durations.reduce((total, property) => total + profile[property], 0) > 0, "durationSeconds", 0, "positive total cycle duration");
  const ids = new Set<string>(); let targetableCount = 0;
  profile.bodyParts.forEach((part, index) => {
    for (const property of ["id", "displayName", "hurtboxFile"] as const) check(errors, part[property].trim().length > 0, `bodyParts.${index}.${property}`, part[property], "non-blank string");
    check(errors, part.hurtboxFile.trim().toLowerCase().endsWith(".json"), `bodyParts.${index}.hurtboxFile`, part.hurtboxFile, "JSON file path");
    check(errors, !ids.has(part.id), `bodyParts.${index}.id`, part.id, "unique body-part ID"); ids.add(part.id);
    for (const coordinate of ["x", "y", "z"] as const) check(errors, Number.isFinite(part.targetPoint[coordinate]), `bodyParts.${index}.targetPoint.${coordinate}`, part.targetPoint[coordinate], "finite number");
    if (part.targetable) targetableCount += 1;
  });
  check(errors, targetableCount > 0, "bodyParts", targetableCount, "at least one targetable body part");
  return errors.length === 0 ? { valid: true, profile, errors } : { valid: false, profile: null, errors };
}

function check(errors: OperationError[], valid: boolean, path: string, actual: unknown, expected: unknown): void { if (!valid) errors.push({ code: ErrorCodes.LargeEnemySemanticInvalid, path, message: `Large-enemy semantic validation failed at ${path}`, actual, expected }); }
function failure(error: OperationError): LargeEnemyValidationResult { return { valid: false, profile: null, errors: [error] }; }
function normalizeSchemaError(item: ErrorObject, value: unknown): OperationError { const extra = item.keyword === "additionalProperties" ? String((item.params as { additionalProperty?: unknown }).additionalProperty ?? "") : ""; const missing = item.keyword === "required" ? String((item.params as { missingProperty?: unknown }).missingProperty ?? "") : ""; const pointer = [item.instancePath, extra || missing].filter(Boolean).join("/"); const path = pointer.replace(/^\//, "").replaceAll("/", "."); return { code: ErrorCodes.LargeEnemySchemaInvalid, path: path || undefined, message: `Large-enemy schema validation failed: ${item.message ?? item.keyword}`, actual: path ? valueAtPath(value, path) : value, expected: item.keyword }; }
function valueAtPath(value: unknown, path: string): unknown { let current = value; for (const segment of path.split(".")) { if (Array.isArray(current)) { const index = Number(segment); current = Number.isInteger(index) ? current[index] : undefined; continue; } if (!record(current)) return undefined; current = current[segment]; } return current; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
