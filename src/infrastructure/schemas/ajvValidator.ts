import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";

import { loadCameraV1Schema, loadMovementV1Schema } from "./schemaLoader";

let movementValidator: ValidateFunction | undefined;
let cameraValidator: ValidateFunction | undefined;

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
