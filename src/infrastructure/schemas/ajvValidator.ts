import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";

import { loadActionTimelineV1Schema, loadArenaV1Schema, loadCameraV1Schema, loadContactVolumeV1Schema, loadDamageReactionV1Schema, loadDefensiveActionV1Schema, loadHealthV1Schema, loadHunterV1Schema, loadLargeEnemyV1Schema, loadMovementV1Schema, loadOffensiveActionV1Schema, loadStaminaV1Schema, loadTargetingV1Schema, loadWeaponV1Schema } from "./schemaLoader";

let movementValidator: ValidateFunction | undefined;
let cameraValidator: ValidateFunction | undefined;
let targetingValidator: ValidateFunction | undefined;
let defensiveActionValidator: ValidateFunction | undefined;
let offensiveActionValidator: ValidateFunction | undefined;
let healthValidator: ValidateFunction | undefined;
let staminaValidator: ValidateFunction | undefined;
let actionTimelineValidator: ValidateFunction | undefined;
let contactVolumeValidator: ValidateFunction | undefined;
let damageReactionValidator: ValidateFunction | undefined;
let weaponValidator: ValidateFunction | undefined;
let largeEnemyValidator: ValidateFunction | undefined;
let hunterValidator: ValidateFunction | undefined;
let arenaValidator: ValidateFunction | undefined;

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

export function validateActionTimelineSchema(value: unknown): ErrorObject[] {
  actionTimelineValidator ??= new Ajv2020({ allErrors: true, strict: true }).compile(loadActionTimelineV1Schema());
  const valid = actionTimelineValidator(value);
  return valid ? [] : [...(actionTimelineValidator.errors ?? [])];
}

export function validateContactVolumeSchema(value: unknown): ErrorObject[] {
  contactVolumeValidator ??= new Ajv2020({ allErrors: true, strict: true }).compile(loadContactVolumeV1Schema());
  const valid = contactVolumeValidator(value);
  return valid ? [] : [...(contactVolumeValidator.errors ?? [])];
}

export function validateDamageReactionSchema(value: unknown): ErrorObject[] {
  damageReactionValidator ??= new Ajv2020({ allErrors: true, strict: true }).compile(loadDamageReactionV1Schema());
  const valid = damageReactionValidator(value);
  return valid ? [] : [...(damageReactionValidator.errors ?? [])];
}

export function validateWeaponSchema(value: unknown): ErrorObject[] {
  weaponValidator ??= new Ajv2020({ allErrors: true, strict: true }).compile(loadWeaponV1Schema());
  const valid = weaponValidator(value);
  return valid ? [] : [...(weaponValidator.errors ?? [])];
}

export function validateLargeEnemySchema(value: unknown): ErrorObject[] {
  largeEnemyValidator ??= new Ajv2020({ allErrors: true, strict: true }).compile(loadLargeEnemyV1Schema());
  const valid = largeEnemyValidator(value);
  return valid ? [] : [...(largeEnemyValidator.errors ?? [])];
}

export function validateHunterSchema(value: unknown): ErrorObject[] {
  hunterValidator ??= new Ajv2020({ allErrors: true, strict: true }).compile(loadHunterV1Schema());
  const valid = hunterValidator(value);
  return valid ? [] : [...(hunterValidator.errors ?? [])];
}

export function validateArenaSchema(value: unknown): ErrorObject[] {
  arenaValidator ??= new Ajv2020({ allErrors: true, strict: true }).compile(loadArenaV1Schema());
  const valid = arenaValidator(value);
  return valid ? [] : [...(arenaValidator.errors ?? [])];
}
