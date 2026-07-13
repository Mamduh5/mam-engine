import type { ErrorObject } from "ajv";

import { validateArenaSchema } from "../../infrastructure/schemas/ajvValidator";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import type { ArenaPoint, ArenaProfile } from "./arenaTypes";

export interface ArenaValidationResult { valid: boolean; profile: ArenaProfile | null; errors: OperationError[] }
const EPSILON = 1e-12;

export function validateArenaDefinition(value: unknown): ArenaValidationResult {
  if (record(value) && Object.prototype.hasOwnProperty.call(value, "schemaVersion") && value.schemaVersion !== 1) return failure({ code: ErrorCodes.ArenaSchemaVersionUnsupported, path: "schemaVersion", message: "Only arena schemaVersion 1 is supported", actual: value.schemaVersion, expected: 1 });
  const schemaErrors = validateArenaSchema(value); if (schemaErrors.length > 0) return { valid: false, profile: null, errors: schemaErrors.map((item) => normalizeSchemaError(item, value)) };
  const profile = structuredClone(value) as ArenaProfile; const errors: OperationError[] = [];
  for (const property of ["id", "displayName"] as const) check(errors, profile[property].trim().length > 0, property, profile[property], "non-blank string");
  check(errors, Number.isFinite(profile.radius) && profile.radius > 0, "radius", profile.radius, "> 0");
  for (const spawn of ["playerSpawn", "enemySpawn"] as const) {
    for (const axis of ["x", "y", "z"] as const) check(errors, Number.isFinite(profile[spawn][axis]), `${spawn}.${axis}`, profile[spawn][axis], "finite number");
    check(errors, distanceFromOrigin(profile[spawn]) <= profile.radius + EPSILON, spawn, profile[spawn], `within radius ${profile.radius}`);
  }
  check(errors, !samePoint(profile.playerSpawn, profile.enemySpawn), "enemySpawn", profile.enemySpawn, "different from playerSpawn");
  return errors.length === 0 ? { valid: true, profile, errors } : { valid: false, profile: null, errors };
}

export function distanceFromOrigin(point: ArenaPoint): number { return Math.hypot(point.x, point.y, point.z); }
export function spawnSeparation(left: ArenaPoint, right: ArenaPoint): number { return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z); }
function samePoint(left: ArenaPoint, right: ArenaPoint): boolean { return left.x === right.x && left.y === right.y && left.z === right.z; }
function check(errors: OperationError[], valid: boolean, path: string, actual: unknown, expected: unknown): void { if (!valid) errors.push({ code: ErrorCodes.ArenaSemanticInvalid, path, message: `Arena semantic validation failed at ${path}`, actual, expected }); }
function failure(error: OperationError): ArenaValidationResult { return { valid: false, profile: null, errors: [error] }; }
function normalizeSchemaError(item: ErrorObject, value: unknown): OperationError { const extra = item.keyword === "additionalProperties" ? String((item.params as { additionalProperty?: unknown }).additionalProperty ?? "") : ""; const missing = item.keyword === "required" ? String((item.params as { missingProperty?: unknown }).missingProperty ?? "") : ""; const pointer = [item.instancePath, extra || missing].filter(Boolean).join("/"); const path = pointer.replace(/^\//, "").replaceAll("/", "."); return { code: ErrorCodes.ArenaSchemaInvalid, path: path || undefined, message: `Arena schema validation failed: ${item.message ?? item.keyword}`, actual: path ? valueAtPath(value, path) : value, expected: item.keyword }; }
function valueAtPath(value: unknown, path: string): unknown { let current = value; for (const segment of path.split(".")) { if (!record(current)) return undefined; current = current[segment]; } return current; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
