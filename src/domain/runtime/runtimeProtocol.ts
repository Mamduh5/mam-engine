import type { CameraProfile, CameraScenario } from "../camera/cameraTypes";
import type { MovementProfile, MovementScenario } from "../movement/movementTypes";

export const RUNTIME_SCHEMA_VERSION = "mam.runtime/v1" as const;
export const MOVEMENT_FIXTURE_ID = "movement/basic-ground" as const;
export const CAMERA_FIXTURE_ID = "camera/basic-third-person" as const;
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

export type RuntimeRequest = MovementRuntimeRequest | CameraRuntimeRequest;
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
