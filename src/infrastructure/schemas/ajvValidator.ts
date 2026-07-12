import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";

import { loadCameraV1Schema, loadDefensiveActionV1Schema, loadMovementV1Schema, loadTargetingV1Schema } from "./schemaLoader";

let movementValidator: ValidateFunction | undefined;
let cameraValidator: ValidateFunction | undefined;
let targetingValidator: ValidateFunction | undefined;
let defensiveActionValidator: ValidateFunction | undefined;

export function validateMovementSchema(value: unknown): ErrorObject[] {
  movementValidator ??= new Ajv2020({ allErrors: true, strict: true }).compile(loadMovementV1Schema());
  const valid = movementValidator(value);
  return valid ? [] : [...(movementValidator.errors ?? [])];
}

export function validateCameraSchema(value: unknown): ErrorObject[] {
  cameraValidator ??= new Ajv2020({ allErrors: true, strict: true }).compile(loadCameraV1Schema());
  const valid = cameraValidator(value);
  return valid ? [] : [...(cameraValidator.errors ?? [])];
}

export function validateTargetingSchema(value: unknown): ErrorObject[] {
  targetingValidator ??= new Ajv2020({ allErrors: true, strict: true }).compile(loadTargetingV1Schema());
  const valid = targetingValidator(value);
  return valid ? [] : [...(targetingValidator.errors ?? [])];
}

export function validateDefensiveActionSchema(value: unknown): ErrorObject[] {
  defensiveActionValidator ??= new Ajv2020({ allErrors: true, strict: true }).compile(loadDefensiveActionV1Schema());
  const valid = defensiveActionValidator(value);
  return valid ? [] : [...(defensiveActionValidator.errors ?? [])];
}
