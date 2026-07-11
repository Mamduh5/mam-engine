import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";

import { loadMovementV1Schema } from "./schemaLoader";

let movementValidator: ValidateFunction | undefined;

export function validateMovementSchema(value: unknown): ErrorObject[] {
  movementValidator ??= new Ajv2020({ allErrors: true, strict: true }).compile(loadMovementV1Schema());
  const valid = movementValidator(value);
  return valid ? [] : [...(movementValidator.errors ?? [])];
}
