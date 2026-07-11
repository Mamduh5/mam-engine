import { validateMovementDefinition } from "../movement/movementValidation";
import { MOVEMENT_FIXTURE_ID, RUNTIME_RUN_COMMAND, RUNTIME_SCHEMA_VERSION, RUNTIME_SCENARIOS, type RuntimeRequest, type RuntimeResponse } from "./runtimeProtocol";

export interface ProtocolValidation<T> { valid: boolean; value?: T; errors: string[] }

export function validateRuntimeRequest(value: unknown): ProtocolValidation<RuntimeRequest> {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ["request must be an object"] };
  if (value.schemaVersion !== RUNTIME_SCHEMA_VERSION) errors.push("unsupported schemaVersion");
  if (value.commandId !== RUNTIME_RUN_COMMAND) errors.push("unknown commandId");
  if (value.fixtureId !== MOVEMENT_FIXTURE_ID) errors.push("unknown fixtureId");
  if (typeof value.correlationId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value.correlationId)) errors.push("correlationId is missing or unsafe");
  if (typeof value.requestedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value.requestedAt) || !Number.isFinite(Date.parse(value.requestedAt))) errors.push("requestedAt must be an ISO timestamp");
  if (!finiteInRange(value.timeoutMs, 1, 60_000)) errors.push("timeoutMs must be finite and bounded");
  if (!isRecord(value.payload)) errors.push("payload must be an object");
  else {
    if (value.payload.definitionSchemaVersion !== 1) errors.push("unsupported movement schema version");
    const movement = validateMovementDefinition(value.payload.profile);
    if (!movement.valid) errors.push(...movement.errors.map((error) => error.message));
    if (!isRecord(value.payload.scenario)) errors.push("scenario must be an object");
    else {
      if (!RUNTIME_SCENARIOS.has(value.payload.scenario.id as never)) errors.push("unsupported scenario");
      if (!finiteInRange(value.payload.scenario.durationSeconds, Number.EPSILON, 60)) errors.push("durationSeconds must be finite and bounded");
      if (value.payload.scenario.fixedDeltaSeconds !== 1 / 60) errors.push("fixedDeltaSeconds must equal 1/60");
      if (!Number.isFinite(value.payload.scenario.cameraYawDegrees)) errors.push("cameraYawDegrees must be finite");
    }
  }
  return errors.length === 0 ? { valid: true, value: value as unknown as RuntimeRequest, errors } : { valid: false, errors };
}

export function validateRuntimeResponse(value: unknown, expected: {
  correlationId: string;
  fixtureId: string;
  commandId: string;
  status: RuntimeResponse["status"] | RuntimeResponse["status"][];
}): ProtocolValidation<RuntimeResponse> {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ["response must be an object"] };
  if (value.schemaVersion !== RUNTIME_SCHEMA_VERSION) errors.push("protocol mismatch");
  if (value.commandId !== expected.commandId) errors.push("command mismatch");
  if (value.fixtureId !== expected.fixtureId) errors.push("fixture mismatch");
  if (value.correlationId !== expected.correlationId) errors.push("correlation mismatch");
  const statuses = Array.isArray(expected.status) ? expected.status : [expected.status];
  if (!statuses.includes(value.status as RuntimeResponse["status"])) errors.push("invalid status");
  for (const field of ["metrics", "evidence"]) if (!isRecord(value[field])) errors.push(`${field} must be an object`);
  for (const field of ["warnings", "validationErrors", "runtimeErrors", "changedFiles"]) if (!Array.isArray(value[field])) errors.push(`${field} must be an array`);
  if (Array.isArray(value.changedFiles) && value.changedFiles.length > 0) errors.push("runtime changedFiles must be empty");
  if (isRecord(value.evidence)) {
    for (const field of expected.commandId === "runtime.fixture.ready"
      ? ["godotVersion", "physicsTicksPerSecond"]
      : ["godotVersion", "physicsTicksPerSecond", "physicsSteps", "fixtureScene", "scenarioId"]) {
      if (!(field in value.evidence)) errors.push(`evidence.${field} is required`);
    }
  }
  return errors.length === 0 ? { valid: true, value: value as unknown as RuntimeResponse, errors } : { valid: false, errors };
}

function finiteInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
