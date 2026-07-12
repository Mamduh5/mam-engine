import type { ErrorObject } from "ajv";

import { validateTargetingSchema } from "../../infrastructure/schemas/ajvValidator";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import type { TargetCandidate, TargetingContext, TargetingProfile, TargetingVector3 } from "./targetingTypes";

export const TARGETING_WEIGHT_SUM_EPSILON = 1e-9;
export interface TargetingValidationResult { valid: boolean; profile: TargetingProfile | null; errors: OperationError[] }

export function validateTargetingDefinition(value: unknown): TargetingValidationResult {
  if (isRecord(value) && Object.prototype.hasOwnProperty.call(value, "schemaVersion") && value.schemaVersion !== 1) return failure({ code: ErrorCodes.TargetingSchemaVersionUnsupported, path: "schemaVersion", message: "Only targeting schemaVersion 1 is supported", actual: value.schemaVersion, expected: 1 });
  const schemaErrors = validateTargetingSchema(value);
  if (schemaErrors.length > 0) return { valid: false, profile: null, errors: schemaErrors.map((item) => normalizeSchemaError(item, value)) };
  const profile = structuredClone(value) as TargetingProfile; const errors: OperationError[] = [];
  const { acquisition, scoring, retention, switching } = profile;
  check(errors, acquisition.maximumDistance > 0, ErrorCodes.TargetingAcquisitionInvalid, "acquisition.maximumDistance", acquisition.maximumDistance, "> 0");
  check(errors, acquisition.maximumAngleDegrees > 0 && acquisition.maximumAngleDegrees <= 180, ErrorCodes.TargetingAcquisitionInvalid, "acquisition.maximumAngleDegrees", acquisition.maximumAngleDegrees, "(0, 180]");
  for (const field of ["distanceWeight", "angleWeight", "priorityWeight"] as const) check(errors, scoring[field] >= 0 && scoring[field] <= 1, ErrorCodes.TargetingScoringInvalid, `scoring.${field}`, scoring[field], "[0, 1]");
  const weightSum = scoring.distanceWeight + scoring.angleWeight + scoring.priorityWeight;
  check(errors, scoring.distanceWeight > 0 || scoring.angleWeight > 0 || scoring.priorityWeight > 0, ErrorCodes.TargetingScoringInvalid, "scoring", scoring, "at least one positive weight");
  check(errors, Math.abs(weightSum - 1) <= TARGETING_WEIGHT_SUM_EPSILON, ErrorCodes.TargetingScoringInvalid, "scoring", weightSum, `sum 1 within ${TARGETING_WEIGHT_SUM_EPSILON}`);
  check(errors, retention.maximumDistanceMultiplier >= 1, ErrorCodes.TargetingRetentionInvalid, "retention.maximumDistanceMultiplier", retention.maximumDistanceMultiplier, ">= 1");
  check(errors, retention.additionalAngleDegrees >= 0, ErrorCodes.TargetingRetentionInvalid, "retention.additionalAngleDegrees", retention.additionalAngleDegrees, ">= 0");
  check(errors, acquisition.maximumAngleDegrees + retention.additionalAngleDegrees <= 180, ErrorCodes.TargetingRetentionInvalid, "retention.additionalAngleDegrees", retention.additionalAngleDegrees, `<= ${180 - acquisition.maximumAngleDegrees}`);
  check(errors, retention.lostTargetGraceSeconds >= 0, ErrorCodes.TargetingRetentionInvalid, "retention.lostTargetGraceSeconds", retention.lostTargetGraceSeconds, ">= 0");
  check(errors, switching.cooldownSeconds >= 0, ErrorCodes.TargetingSwitchingInvalid, "switching.cooldownSeconds", switching.cooldownSeconds, ">= 0");
  check(errors, switching.maximumAngleDegrees > 0 && switching.maximumAngleDegrees <= 180, ErrorCodes.TargetingSwitchingInvalid, "switching.maximumAngleDegrees", switching.maximumAngleDegrees, "(0, 180]");
  check(errors, switching.minimumSeparationDegrees >= 0 && switching.minimumSeparationDegrees < switching.maximumAngleDegrees, ErrorCodes.TargetingSwitchingInvalid, "switching.minimumSeparationDegrees", switching.minimumSeparationDegrees, `[0, ${switching.maximumAngleDegrees})`);
  return errors.length === 0 ? { valid: true, profile, errors } : { valid: false, profile: null, errors };
}

export function validateTargetingContext(context: TargetingContext): OperationError[] {
  const errors: OperationError[] = [];
  validateVector(errors, context.origin, "origin"); validateVector(errors, context.viewForward, "viewForward");
  if (magnitude(context.viewForward) <= TARGETING_WEIGHT_SUM_EPSILON) errors.push({ code: ErrorCodes.TargetingAcquisitionInvalid, path: "viewForward", message: "viewForward must be non-zero" });
  const ids = new Set<string>();
  context.candidates.forEach((candidate, index) => {
    const prefix = `candidates.${index}`; validateVector(errors, candidate.targetPoint, `${prefix}.targetPoint`);
    if (candidate.id.length === 0) errors.push({ code: ErrorCodes.TargetingAcquisitionInvalid, path: `${prefix}.id`, message: "Candidate ID must be non-empty" });
    if (ids.has(candidate.id)) errors.push({ code: ErrorCodes.TargetingAcquisitionInvalid, path: `${prefix}.id`, message: "Candidate IDs must be unique", actual: candidate.id }); ids.add(candidate.id);
    if (!Number.isFinite(candidate.priority) || candidate.priority < 0 || candidate.priority > 1) errors.push({ code: ErrorCodes.TargetingAcquisitionInvalid, path: `${prefix}.priority`, message: "Candidate priority must be finite and within [0, 1]", actual: candidate.priority });
  });
  return errors;
}

function validateVector(errors: OperationError[], value: TargetingVector3, path: string): void { for (const field of ["x", "y", "z"] as const) if (!Number.isFinite(value[field])) errors.push({ code: ErrorCodes.TargetingAcquisitionInvalid, path: `${path}.${field}`, message: "Vector component must be finite", actual: value[field] }); }
function magnitude(value: TargetingVector3): number { return Math.hypot(value.x, value.y, value.z); }
function check(errors: OperationError[], valid: boolean, code: OperationError["code"], path: string, actual: unknown, expected: unknown): void { if (!valid) errors.push({ code, path, message: `${path} must satisfy ${String(expected)}`, actual, expected }); }
function failure(error: OperationError): TargetingValidationResult { return { valid: false, profile: null, errors: [error] }; }
function normalizeSchemaError(item: ErrorObject, value: unknown): OperationError { const extra = item.keyword === "additionalProperties" ? String((item.params as { additionalProperty?: unknown }).additionalProperty ?? "") : ""; const missing = item.keyword === "required" ? String((item.params as { missingProperty?: unknown }).missingProperty ?? "") : ""; const pointer = [item.instancePath, extra || missing].filter(Boolean).join("/"); const path = pointer.replace(/^\//, "").replaceAll("/", "."); return { code: ErrorCodes.TargetingSchemaInvalid, path: path || undefined, message: `Targeting schema validation failed: ${item.message ?? item.keyword}`, actual: path ? valueAtPath(value, path) : value, expected: item.keyword }; }
function valueAtPath(value: unknown, path: string): unknown { let current = value; for (const segment of path.split(".")) { if (!isRecord(current)) return undefined; current = current[segment]; } return current; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
