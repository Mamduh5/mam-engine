import type { MovementProfile, MovementScenario } from "../movement/movementTypes";

export const RUNTIME_SCHEMA_VERSION = "mam.runtime/v1" as const;
export const MOVEMENT_FIXTURE_ID = "movement/basic-ground" as const;
export const RUNTIME_RUN_COMMAND = "runtime.fixture.run" as const;

export interface RuntimeScenarioRequest {
  id: MovementScenario;
  durationSeconds: number;
  fixedDeltaSeconds: number;
  cameraYawDegrees: number;
}

export interface RuntimeRequest {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  commandId: typeof RUNTIME_RUN_COMMAND;
  fixtureId: typeof MOVEMENT_FIXTURE_ID;
  correlationId: string;
  requestedAt: string;
  timeoutMs: number;
  payload: {
    definitionSchemaVersion: 1;
    profile: MovementProfile;
    scenario: RuntimeScenarioRequest;
  };
}

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
  fixtureId: typeof MOVEMENT_FIXTURE_ID;
  correlationId: string;
  status: RuntimeStatus;
  metrics: Record<string, unknown>;
  warnings: RuntimeFinding[];
  validationErrors: RuntimeFinding[];
  runtimeErrors: RuntimeFinding[];
  changedFiles: string[];
  evidence: Record<string, unknown>;
}

export const RUNTIME_SCENARIOS = new Set<MovementScenario>(["accelerate", "stop", "sprint", "dodge", "turn"]);
