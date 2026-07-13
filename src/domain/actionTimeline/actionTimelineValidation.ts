import type { ErrorObject } from "ajv";

import { validateActionTimelineSchema } from "../../infrastructure/schemas/ajvValidator";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import type { ActionTimelineProfile } from "./actionTimelineTypes";

export interface ActionTimelineValidationResult { valid: boolean; profile: ActionTimelineProfile | null; errors: OperationError[] }

export function validateActionTimelineDefinition(value: unknown): ActionTimelineValidationResult {
  if (record(value) && Object.prototype.hasOwnProperty.call(value, "schemaVersion") && value.schemaVersion !== 1) return failure({ code: ErrorCodes.ActionTimelineSchemaVersionUnsupported, path: "schemaVersion", message: "Only action timeline schemaVersion 1 is supported", actual: value.schemaVersion, expected: 1 });
  const schemaErrors = validateActionTimelineSchema(value);
  if (schemaErrors.length > 0) return { valid: false, profile: null, errors: schemaErrors.map((item) => normalizeSchemaError(item, value)) };
  const profile = structuredClone(value) as ActionTimelineProfile; const errors: OperationError[] = [];
  check(errors, profile.durationSeconds > 0, "durationSeconds", profile.durationSeconds, "> 0");
  const ids = new Set<string>();
  profile.events.forEach((event, index) => {
    check(errors, event.timeSeconds >= 0 && event.timeSeconds <= profile.durationSeconds, `events.${index}.timeSeconds`, event.timeSeconds, `[0, ${profile.durationSeconds}]`);
    check(errors, !ids.has(event.id), `events.${index}.id`, event.id, "unique event ID"); ids.add(event.id);
  });
  return errors.length === 0 ? { valid: true, profile, errors } : { valid: false, profile: null, errors };
}

function check(errors: OperationError[], valid: boolean, path: string, actual: unknown, expected: unknown): void { if (!valid) errors.push({ code: ErrorCodes.ActionTimelineSemanticInvalid, path, message: `${path} must satisfy ${String(expected)}`, actual, expected }); }
function failure(error: OperationError): ActionTimelineValidationResult { return { valid: false, profile: null, errors: [error] }; }
function normalizeSchemaError(item: ErrorObject, value: unknown): OperationError { const extra = item.keyword === "additionalProperties" ? String((item.params as { additionalProperty?: unknown }).additionalProperty ?? "") : ""; const missing = item.keyword === "required" ? String((item.params as { missingProperty?: unknown }).missingProperty ?? "") : ""; const pointer = [item.instancePath, extra || missing].filter(Boolean).join("/"); const path = pointer.replace(/^\//, "").replaceAll("/", "."); return { code: ErrorCodes.ActionTimelineSchemaInvalid, path: path || undefined, message: `Action timeline schema validation failed: ${item.message ?? item.keyword}`, actual: path ? valueAtPath(value, path) : value, expected: item.keyword }; }
function valueAtPath(value: unknown, path: string): unknown { let current = value; for (const segment of path.split(".")) { if (Array.isArray(current) && /^\d+$/.test(segment)) current = current[Number(segment)]; else if (record(current)) current = current[segment]; else return undefined; } return current; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
