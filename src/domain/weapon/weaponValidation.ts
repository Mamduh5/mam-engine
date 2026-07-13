import type { ErrorObject } from "ajv";

import type { ActionTimelineProfile } from "../actionTimeline/actionTimelineTypes";
import type { ContactVolumeProfile } from "../contactVolume/contactVolumeTypes";
import type { OffensiveActionProfile } from "../offensiveAction/offensiveActionTypes";
import { validateWeaponSchema } from "../../infrastructure/schemas/ajvValidator";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import type { WeaponProfile } from "./weaponTypes";

export interface WeaponValidationResult { valid: boolean; profile: WeaponProfile | null; errors: OperationError[] }
const EPSILON = 1e-12;

export function validateWeaponDefinition(value: unknown): WeaponValidationResult {
  if (record(value) && Object.prototype.hasOwnProperty.call(value, "schemaVersion") && value.schemaVersion !== 1) return failure({ code: ErrorCodes.WeaponSchemaVersionUnsupported, path: "schemaVersion", message: "Only weapon schemaVersion 1 is supported", actual: value.schemaVersion, expected: 1 });
  const schemaErrors = validateWeaponSchema(value); if (schemaErrors.length > 0) return { valid: false, profile: null, errors: schemaErrors.map((item) => normalizeSchemaError(item, value)) };
  const profile = structuredClone(value) as WeaponProfile; const errors: OperationError[] = [];
  for (const property of ["id", "displayName", "offensiveActionFile", "actionTimelineFile", "hitboxFile", "hitboxEnableEventId", "hitboxDisableEventId"] as const) check(errors, profile[property].trim().length > 0, property, profile[property], "non-blank string");
  for (const property of ["offensiveActionFile", "actionTimelineFile", "hitboxFile"] as const) check(errors, profile[property].trim().toLowerCase().endsWith(".json"), property, profile[property], "JSON file path");
  return errors.length === 0 ? { valid: true, profile, errors } : { valid: false, profile: null, errors };
}

export function validateWeaponCompatibility(profile: WeaponProfile, action: OffensiveActionProfile, timeline: ActionTimelineProfile, hitbox: ContactVolumeProfile): OperationError[] {
  const errors: OperationError[] = [];
  compatible(errors, hitbox.role === "hitbox", "hitboxFile", hitbox.role, "hitbox role");
  compatible(errors, equal(action.durationSeconds, timeline.durationSeconds), "actionTimelineFile", timeline.durationSeconds, action.durationSeconds);
  compatible(errors, hitbox.activeStartSeconds + EPSILON >= action.activeStartSeconds && hitbox.activeEndSeconds <= action.activeEndSeconds + EPSILON, "hitboxFile", { activeStartSeconds: hitbox.activeStartSeconds, activeEndSeconds: hitbox.activeEndSeconds }, { withinOffensiveWindow: [action.activeStartSeconds, action.activeEndSeconds] });
  const enable = timeline.events.find((event) => event.id === profile.hitboxEnableEventId); const disable = timeline.events.find((event) => event.id === profile.hitboxDisableEventId);
  compatible(errors, enable !== undefined, "hitboxEnableEventId", profile.hitboxEnableEventId, "existing timeline event ID");
  compatible(errors, disable !== undefined, "hitboxDisableEventId", profile.hitboxDisableEventId, "existing timeline event ID");
  if (enable) compatible(errors, equal(enable.timeSeconds, hitbox.activeStartSeconds), "hitboxEnableEventId", enable.timeSeconds, hitbox.activeStartSeconds);
  if (disable) compatible(errors, equal(disable.timeSeconds, hitbox.activeEndSeconds), "hitboxDisableEventId", disable.timeSeconds, hitbox.activeEndSeconds);
  if (enable && disable) compatible(errors, enable.timeSeconds <= disable.timeSeconds + EPSILON, "hitboxEnableEventId", enable.timeSeconds, `<= ${disable.timeSeconds}`);
  return errors;
}

function compatible(errors: OperationError[], valid: boolean, path: string, actual: unknown, expected: unknown): void { if (!valid) errors.push({ code: ErrorCodes.WeaponCompatibilityInvalid, path, message: `Weapon reference compatibility failed at ${path}`, actual, expected }); }
function check(errors: OperationError[], valid: boolean, path: string, actual: unknown, expected: unknown): void { if (!valid) errors.push({ code: ErrorCodes.WeaponSemanticInvalid, path, message: `${path} must be a ${String(expected)}`, actual, expected }); }
function equal(left: number, right: number): boolean { return Math.abs(left - right) <= EPSILON; }
function failure(error: OperationError): WeaponValidationResult { return { valid: false, profile: null, errors: [error] }; }
function normalizeSchemaError(item: ErrorObject, value: unknown): OperationError { const extra = item.keyword === "additionalProperties" ? String((item.params as { additionalProperty?: unknown }).additionalProperty ?? "") : ""; const missing = item.keyword === "required" ? String((item.params as { missingProperty?: unknown }).missingProperty ?? "") : ""; const pointer = [item.instancePath, extra || missing].filter(Boolean).join("/"); const path = pointer.replace(/^\//, "").replaceAll("/", "."); return { code: ErrorCodes.WeaponSchemaInvalid, path: path || undefined, message: `Weapon schema validation failed: ${item.message ?? item.keyword}`, actual: path ? valueAtPath(value, path) : value, expected: item.keyword }; }
function valueAtPath(value: unknown, path: string): unknown { let current = value; for (const segment of path.split(".")) { if (!record(current)) return undefined; current = current[segment]; } return current; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
