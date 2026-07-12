import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";

import { loadCameraV1Schema, loadDefensiveActionV1Schema, loadHealthV1Schema, loadMovementV1Schema, loadOffensiveActionV1Schema, loadStaminaV1Schema, loadTargetingV1Schema } from "./schemaLoader";

let movementValidator: ValidateFunction | undefined;
let cameraValidator: ValidateFunction | undefined;
let targetingValidator: ValidateFunction | undefined;
let defensiveActionValidator: ValidateFunction | undefined;
let offensiveActionValidator: ValidateFunction | undefined;
let healthValidator: ValidateFunction | undefined;
let staminaValidator: ValidateFunction | undefined;

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

export function validateOffensiveActionSchema(value: unknown): ErrorObject[] {
  offensiveActionValidator ??= new Ajv2020({ allErrors: true, strict: true }).compile(loadOffensiveActionV1Schema());
  const valid = offensiveActionValidator(value);
  return valid ? [] : [...(offensiveActionValidator.errors ?? [])];
}

export function validateHealthSchema(value: unknown): ErrorObject[] {
  healthValidator ??= new Ajv2020({ allErrors: true, strict: true }).compile(loadHealthV1Schema());
  const valid = healthValidator(value);
  return valid ? [] : [...(healthValidator.errors ?? [])];
}

export function validateStaminaSchema(value: unknown): ErrorObject[] {
  staminaValidator ??= new Ajv2020({ allErrors: true, strict: true }).compile(loadStaminaV1Schema());
  const valid = staminaValidator(value);
  return valid ? [] : [...(staminaValidator.errors ?? [])];
}
