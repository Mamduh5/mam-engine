import type { CameraProfile, CameraScenario } from "../camera/cameraTypes";
import type { MovementProfile, MovementScenario } from "../movement/movementTypes";
import type { TargetingProfile } from "../targeting/targetingTypes";
import type { DefensiveActionProfile } from "../defensiveAction/defensiveActionTypes";
import type { OffensiveActionProfile } from "../offensiveAction/offensiveActionTypes";
import type { TargetingRuntimeScenarioRequest } from "./targetingRuntimePlan";
export { TARGETING_RUNTIME_SCENARIOS } from "./targetingRuntimePlan";

export const RUNTIME_SCHEMA_VERSION = "mam.runtime/v1" as const;
export const MOVEMENT_FIXTURE_ID = "movement/basic-ground" as const;
export const CAMERA_FIXTURE_ID = "camera/basic-third-person" as const;
export const TARGETING_FIXTURE_ID = "targeting/basic-lock-on" as const;
export const DEFENSIVE_ACTION_FIXTURE_ID = "defensive-action/basic-dodge" as const;
export const OFFENSIVE_ACTION_FIXTURE_ID = "offensive-action/basic-light-attack" as const;
export const RUNTIME_RUN_COMMAND = "runtime.fixture.run" as const;

export interface MovementRuntimeScenarioRequest {
  id: MovementScenario;
  durationSeconds: number;
  fixedDeltaSeconds: number;
  cameraYawDegrees: number;
}

export interface CameraRuntimeScenarioRequest {
  id: CameraScenario;
  durationSeconds: number;
  fixedDeltaSeconds: number;
  variant?: "default" | "disabled" | "below-threshold" | "manual-input";
}

export interface MovementRuntimeRequest {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  commandId: typeof RUNTIME_RUN_COMMAND;
  fixtureId: typeof MOVEMENT_FIXTURE_ID;
  correlationId: string;
  requestedAt: string;
  timeoutMs: number;
  payload: {
    definitionKind?: "movement-profile";
    definitionSchemaVersion: 1;
    profile: MovementProfile;
    scenario: MovementRuntimeScenarioRequest;
  };
}

export interface CameraRuntimeRequest {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  commandId: typeof RUNTIME_RUN_COMMAND;
  fixtureId: typeof CAMERA_FIXTURE_ID;
  correlationId: string;
  requestedAt: string;
  timeoutMs: number;
  payload: {
    definitionKind: "camera-profile";
    definitionSchemaVersion: 1;
    profile: CameraProfile;
    scenario: CameraRuntimeScenarioRequest;
  };
}

export interface TargetingRuntimeRequest {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  commandId: typeof RUNTIME_RUN_COMMAND;
  fixtureId: typeof TARGETING_FIXTURE_ID;
  correlationId: string;
  requestedAt: string;
  timeoutMs: number;
  payload: {
    definitionKind: "targeting-profile";
    definitionSchemaVersion: 1;
    profile: TargetingProfile;
    cameraDefinitionKind: "camera-profile";
    cameraDefinitionSchemaVersion: 1;
    cameraProfile: CameraProfile;
    scenario: TargetingRuntimeScenarioRequest;
  };
}

export interface DefensiveActionRuntimeRequest {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  commandId: typeof RUNTIME_RUN_COMMAND;
  fixtureId: typeof DEFENSIVE_ACTION_FIXTURE_ID;
  correlationId: string;
  requestedAt: string;
  timeoutMs: number;
  payload: {
    definitionKind: "defensive-action-profile";
    definitionSchemaVersion: 1;
    profile: DefensiveActionProfile;
    scenario: { id: "default"; durationSeconds: number; fixedDeltaSeconds: number };
  };
}

export interface OffensiveActionRuntimeRequest {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  commandId: typeof RUNTIME_RUN_COMMAND;
  fixtureId: typeof OFFENSIVE_ACTION_FIXTURE_ID;
  correlationId: string;
  requestedAt: string;
  timeoutMs: number;
  payload: {
    definitionKind: "offensive-action-profile";
    definitionSchemaVersion: 1;
    profile: OffensiveActionProfile;
    scenario: { id: "default"; durationSeconds: number; fixedDeltaSeconds: number };
  };
}

export type RuntimeRequest = MovementRuntimeRequest | CameraRuntimeRequest | TargetingRuntimeRequest | DefensiveActionRuntimeRequest | OffensiveActionRuntimeRequest;
export type RuntimeFixtureId = RuntimeRequest["fixtureId"];
export type RuntimeStatus = "ready" | "ok" | "rejected" | "failed" | "timed_out";

export interface RuntimeFinding {
  code: string;
  message: string;
  path?: string;
  details?: Record<string, unknown>;
}

export interface RuntimeResponse {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  commandId: "runtime.fixture.ready" | typeof RUNTIME_RUN_COMMAND;
  fixtureId: RuntimeFixtureId;
  correlationId: string;
  status: RuntimeStatus;
  metrics: Record<string, unknown>;
  warnings: RuntimeFinding[];
  validationErrors: RuntimeFinding[];
  runtimeErrors: RuntimeFinding[];
  changedFiles: string[];
  evidence: Record<string, unknown>;
}

export const MOVEMENT_RUNTIME_SCENARIOS = new Set<MovementScenario>(["accelerate", "stop", "sprint", "dodge", "turn"]);
export const CAMERA_RUNTIME_SCENARIOS = new Set<CameraScenario>(["orbit", "pitch-clamp", "recenter", "follow", "collision", "basis"]);
/** Backward-compatible movement export. */
export const RUNTIME_SCENARIOS = MOVEMENT_RUNTIME_SCENARIOS;
