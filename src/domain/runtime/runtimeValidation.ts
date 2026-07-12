import { validateCameraDefinition } from "../camera/cameraValidation";
import type { CameraScenario } from "../camera/cameraTypes";
import { validateMovementDefinition } from "../movement/movementValidation";
import { validateTargetingDefinition } from "../targeting/targetingValidation";
import { validateDefensiveActionDefinition } from "../defensiveAction/defensiveActionValidation";
import { validateOffensiveActionDefinition } from "../offensiveAction/offensiveActionValidation";
import { validateHealthDefinition } from "../health/healthValidation";
import { simulateOffensiveAction } from "../offensiveAction/offensiveActionSimulation";
import { validateCameraRuntimeMetrics } from "./cameraRuntimeMetrics";
import { validateTargetingRuntimePlan } from "./targetingRuntimePlan";
import { validateTargetingRuntimeMetrics } from "./targetingRuntimeMetrics";
import { CAMERA_FIXTURE_ID, CAMERA_RUNTIME_SCENARIOS, COMBAT_FIXTURE_ID, DEFENSIVE_ACTION_FIXTURE_ID, HEALTH_FIXTURE_ID, MOVEMENT_FIXTURE_ID, MOVEMENT_RUNTIME_SCENARIOS, OFFENSIVE_ACTION_FIXTURE_ID, RUNTIME_RUN_COMMAND, RUNTIME_SCHEMA_VERSION, TARGETING_FIXTURE_ID, type RuntimeRequest, type RuntimeResponse } from "./runtimeProtocol";

export interface ProtocolValidation<T> { valid: boolean; value?: T; errors: string[] }

export function validateRuntimeRequest(value: unknown): ProtocolValidation<RuntimeRequest> {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ["request must be an object"] };
  if (value.schemaVersion !== RUNTIME_SCHEMA_VERSION) errors.push("unsupported schemaVersion");
  if (value.commandId !== RUNTIME_RUN_COMMAND) errors.push("unknown commandId");
  if (value.fixtureId !== MOVEMENT_FIXTURE_ID && value.fixtureId !== CAMERA_FIXTURE_ID && value.fixtureId !== TARGETING_FIXTURE_ID && value.fixtureId !== DEFENSIVE_ACTION_FIXTURE_ID && value.fixtureId !== OFFENSIVE_ACTION_FIXTURE_ID && value.fixtureId !== HEALTH_FIXTURE_ID && value.fixtureId !== COMBAT_FIXTURE_ID) errors.push("unknown fixtureId");
  if (typeof value.correlationId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value.correlationId)) errors.push("correlationId is missing or unsafe");
  if (typeof value.requestedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value.requestedAt) || !Number.isFinite(Date.parse(value.requestedAt))) errors.push("requestedAt must be an ISO timestamp");
  if (!finiteInRange(value.timeoutMs, 1, 60_000)) errors.push("timeoutMs must be finite and bounded");
  if (!isRecord(value.payload)) errors.push("payload must be an object");
  else if (value.fixtureId === CAMERA_FIXTURE_ID) validateCameraPayload(value.payload, errors);
  else if (value.fixtureId === TARGETING_FIXTURE_ID) validateTargetingPayload(value.payload, errors);
  else if (value.fixtureId === DEFENSIVE_ACTION_FIXTURE_ID) validateDefensiveActionPayload(value.payload, errors);
  else if (value.fixtureId === OFFENSIVE_ACTION_FIXTURE_ID) validateOffensiveActionPayload(value.payload, errors);
  else if (value.fixtureId === HEALTH_FIXTURE_ID) validateHealthPayload(value.payload, errors);
  else if (value.fixtureId === COMBAT_FIXTURE_ID) validateCombatPayload(value.payload, errors);
  else if (value.fixtureId === MOVEMENT_FIXTURE_ID) validateMovementPayload(value.payload, errors);
  return errors.length === 0 ? { valid: true, value: value as unknown as RuntimeRequest, errors } : { valid: false, errors };
}

function validateCombatPayload(payload: Record<string, any>, errors: string[]): void {
  if (payload.healthDefinitionKind !== "health-profile" || payload.healthDefinitionSchemaVersion !== 1) errors.push("unsupported combat health definition");
  if (payload.offensiveActionDefinitionKind !== "offensive-action-profile" || payload.offensiveActionDefinitionSchemaVersion !== 1) errors.push("unsupported combat offensive action definition");
  const health = validateHealthDefinition(payload.healthProfile); if (!health.valid) errors.push(...health.errors.map((error) => error.message));
  const action = validateOffensiveActionDefinition(payload.offensiveActionProfile); if (!action.valid) errors.push(...action.errors.map((error) => error.message));
  const scenario = payload.scenario; if (!isRecord(scenario)) { errors.push("scenario must be an object"); return; }
  if (scenario.id !== "default") errors.push("unsupported combat scenario");
  if (!finiteInRange(scenario.durationSeconds, Number.EPSILON, 60)) errors.push("durationSeconds must be finite and bounded");
  if (!finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1)) errors.push("fixedDeltaSeconds must be finite and bounded");
  if (action.valid && action.profile && finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1)) {
    const simulation = simulateOffensiveAction(action.profile, scenario.fixedDeltaSeconds);
    if (simulation.activeStartStep > simulation.activeEndStep || simulation.activeStartStep > simulation.totalSteps) errors.push("combat active window has no valid step");
  }
}

function validateHealthPayload(payload: Record<string, any>, errors: string[]): void {
  if (payload.definitionKind !== "health-profile" || payload.definitionSchemaVersion !== 1) errors.push("unsupported health definition");
  if (payload.offensiveActionDefinitionKind !== "offensive-action-profile" || payload.offensiveActionDefinitionSchemaVersion !== 1) errors.push("unsupported health offensive action definition");
  const health = validateHealthDefinition(payload.profile); if (!health.valid) errors.push(...health.errors.map((error) => error.message));
  const action = validateOffensiveActionDefinition(payload.offensiveActionProfile); if (!action.valid) errors.push(...action.errors.map((error) => error.message));
  const scenario = payload.scenario; if (!isRecord(scenario)) { errors.push("scenario must be an object"); return; }
  if (scenario.id !== "confirmed-hit") errors.push("unsupported health scenario");
  if (!finiteInRange(scenario.durationSeconds, Number.EPSILON, 60)) errors.push("durationSeconds must be finite and bounded");
  if (!finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1)) errors.push("fixedDeltaSeconds must be finite and bounded");
}

function validateOffensiveActionPayload(payload: Record<string, any>, errors: string[]): void {
  if (payload.definitionKind !== "offensive-action-profile") errors.push("unsupported offensive action definition kind");
  if (payload.definitionSchemaVersion !== 1) errors.push("unsupported offensive action schema version");
  const profile = validateOffensiveActionDefinition(payload.profile); if (!profile.valid) errors.push(...profile.errors.map((error) => error.message));
  const scenario = payload.scenario; if (!isRecord(scenario)) { errors.push("scenario must be an object"); return; }
  if (scenario.id !== "default") errors.push("unsupported offensive action scenario");
  if (!finiteInRange(scenario.durationSeconds, Number.EPSILON, 60)) errors.push("durationSeconds must be finite and bounded");
  if (!finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1)) errors.push("fixedDeltaSeconds must be finite and bounded");
}

function validateDefensiveActionPayload(payload: Record<string, any>, errors: string[]): void {
  if (payload.definitionKind !== "defensive-action-profile") errors.push("unsupported defensive action definition kind");
  if (payload.definitionSchemaVersion !== 1) errors.push("unsupported defensive action schema version");
  const profile = validateDefensiveActionDefinition(payload.profile);
  if (!profile.valid) errors.push(...profile.errors.map((error) => error.message));
  const scenario = payload.scenario;
  if (!isRecord(scenario)) { errors.push("scenario must be an object"); return; }
  if (scenario.id !== "default") errors.push("unsupported defensive action scenario");
  if (!finiteInRange(scenario.durationSeconds, Number.EPSILON, 60)) errors.push("durationSeconds must be finite and bounded");
  if (!finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1)) errors.push("fixedDeltaSeconds must be finite and bounded");
}

function validateTargetingPayload(payload: Record<string, any>, errors: string[]): void {
  if (payload.definitionKind !== "targeting-profile") errors.push("unsupported targeting definition kind");
  if (payload.definitionSchemaVersion !== 1) errors.push("unsupported targeting schema version");
  if (payload.cameraDefinitionKind !== "camera-profile") errors.push("unsupported camera definition kind");
  if (payload.cameraDefinitionSchemaVersion !== 1) errors.push("unsupported camera schema version");
  const targeting = validateTargetingDefinition(payload.profile);
  if (!targeting.valid) errors.push(...targeting.errors.map((error) => error.message));
  const camera = validateCameraDefinition(payload.cameraProfile);
  if (!camera.valid) errors.push(...camera.errors.map((error) => error.message));
  errors.push(...validateTargetingRuntimePlan(payload.scenario));
}

function validateMovementPayload(payload: Record<string, any>, errors: string[]): void {
  if (payload.definitionKind !== undefined && payload.definitionKind !== "movement-profile") errors.push("unsupported definition kind");
  if (payload.definitionSchemaVersion !== 1) errors.push("unsupported movement schema version");
  const movement = validateMovementDefinition(payload.profile);
  if (!movement.valid) errors.push(...movement.errors.map((error) => error.message));
  validateScenario(payload.scenario, MOVEMENT_RUNTIME_SCENARIOS, errors, true);
}

function validateCameraPayload(payload: Record<string, any>, errors: string[]): void {
  if (payload.definitionKind !== "camera-profile") errors.push("unsupported definition kind");
  if (payload.definitionSchemaVersion !== 1) errors.push("unsupported camera schema version");
  const camera = validateCameraDefinition(payload.profile);
  if (!camera.valid) errors.push(...camera.errors.map((error) => error.message));
  validateScenario(payload.scenario, CAMERA_RUNTIME_SCENARIOS, errors, false);
}

function validateScenario(scenario: unknown, scenarios: ReadonlySet<string>, errors: string[], movement: boolean): void {
  if (!isRecord(scenario)) { errors.push("scenario must be an object"); return; }
  if (!scenarios.has(String(scenario.id))) errors.push("unsupported scenario");
  if (!finiteInRange(scenario.durationSeconds, movement ? Number.EPSILON : 0, 60) || (!movement && scenario.id !== "basis" && scenario.durationSeconds === 0)) errors.push("durationSeconds must be finite and bounded");
  if (!finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1)) errors.push("fixedDeltaSeconds must be finite and bounded");
  if (movement && scenario.fixedDeltaSeconds !== 1 / 60) errors.push("fixedDeltaSeconds must equal 1/60");
  if (movement && !Number.isFinite(scenario.cameraYawDegrees)) errors.push("cameraYawDegrees must be finite");
  if (!movement && scenario.variant !== undefined && !["default", "disabled", "below-threshold", "manual-input"].includes(scenario.variant)) errors.push("unsupported camera scenario variant");
}

export function validateRuntimeResponse(value: unknown, expected: {
  correlationId: string;
  fixtureId: string;
  commandId: string;
  status: RuntimeResponse["status"] | RuntimeResponse["status"][];
  scenarioId?: string;
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
    for (const field of expected.commandId === "runtime.fixture.ready" ? ["godotVersion", "physicsTicksPerSecond"] : ["godotVersion", "physicsTicksPerSecond", "physicsSteps", "fixtureScene", "scenarioId"]) if (!(field in value.evidence)) errors.push(`evidence.${field} is required`);
  }
  if (expected.fixtureId === CAMERA_FIXTURE_ID && expected.commandId === RUNTIME_RUN_COMMAND && value.status === "ok" && isRecord(value.metrics) && expected.scenarioId && CAMERA_RUNTIME_SCENARIOS.has(expected.scenarioId as CameraScenario)) errors.push(...validateCameraRuntimeMetrics(expected.scenarioId as CameraScenario, value.metrics));
  if (expected.fixtureId === TARGETING_FIXTURE_ID && expected.commandId === RUNTIME_RUN_COMMAND && value.status === "ok" && isRecord(value.metrics)) errors.push(...validateTargetingRuntimeMetrics(value.metrics));
  return errors.length === 0 ? { valid: true, value: value as unknown as RuntimeResponse, errors } : { valid: false, errors };
}

function finiteInRange(value: unknown, minimum: number, maximum: number): value is number { return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum; }
function isRecord(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value); }
