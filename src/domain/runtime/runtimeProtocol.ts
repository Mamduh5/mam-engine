import type { CameraProfile, CameraScenario } from "../camera/cameraTypes";
import type { MovementProfile, MovementScenario } from "../movement/movementTypes";
import type { TargetingProfile } from "../targeting/targetingTypes";
import type { DefensiveActionProfile } from "../defensiveAction/defensiveActionTypes";
import type { OffensiveActionProfile } from "../offensiveAction/offensiveActionTypes";
import type { HealthProfile } from "../health/healthTypes";
import type { StaminaActionProfile, StaminaProfile } from "../stamina/staminaTypes";
import type { TargetingRuntimeScenarioRequest } from "./targetingRuntimePlan";
import type { TargetedCombatExchangeScenario } from "../combat/targetedCombatExchangeSimulation";
import type { ActionTimelineProfile } from "../actionTimeline/actionTimelineTypes";
import type { ContactVolumeProfile } from "../contactVolume/contactVolumeTypes";
import type { DamageReactionProfile } from "../damageReaction/damageReactionTypes";
import type { ResolvedWeaponDefinitionPaths, WeaponProfile } from "../weapon/weaponTypes";
import type { LargeEnemyProfile, LargeEnemyScenario, ResolvedLargeEnemyDefinitionPaths } from "../largeEnemy/largeEnemyTypes";
export { TARGETING_RUNTIME_SCENARIOS } from "./targetingRuntimePlan";

export const RUNTIME_SCHEMA_VERSION = "mam.runtime/v1" as const;
export const MOVEMENT_FIXTURE_ID = "movement/basic-ground" as const;
export const CAMERA_FIXTURE_ID = "camera/basic-third-person" as const;
export const TARGETING_FIXTURE_ID = "targeting/basic-lock-on" as const;
export const DEFENSIVE_ACTION_FIXTURE_ID = "defensive-action/basic-dodge" as const;
export const OFFENSIVE_ACTION_FIXTURE_ID = "offensive-action/basic-light-attack" as const;
export const HEALTH_FIXTURE_ID = "health/basic-confirmed-hit" as const;
export const COMBAT_FIXTURE_ID = "combat/basic-exchange" as const;
export const STAMINA_FIXTURE_ID = "stamina/basic-action-cost" as const;
export const STAMINA_COMBAT_FIXTURE_ID = "combat/stamina-gated-exchange" as const;
export const TARGETED_COMBAT_FIXTURE_ID = "combat/targeted-stamina-exchange" as const;
export const ACTION_TIMELINE_FIXTURE_ID = "action-timeline/basic-animation-events" as const;
export const CONTACT_VOLUME_FIXTURE_ID = "contact-volume/basic-sphere-overlap" as const;
export const DAMAGE_REACTION_FIXTURE_ID = "damage-reaction/basic-resolution" as const;
export const WEAPON_FIXTURE_ID = "weapon/training-strike" as const;
export const LARGE_ENEMY_FIXTURE_ID = "large-enemy/training-behemoth" as const;
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

export interface HealthRuntimeRequest {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  commandId: typeof RUNTIME_RUN_COMMAND;
  fixtureId: typeof HEALTH_FIXTURE_ID;
  correlationId: string;
  requestedAt: string;
  timeoutMs: number;
  payload: {
    definitionKind: "health-profile";
    definitionSchemaVersion: 1;
    profile: HealthProfile;
    offensiveActionDefinitionKind: "offensive-action-profile";
    offensiveActionDefinitionSchemaVersion: 1;
    offensiveActionProfile: OffensiveActionProfile;
    scenario: { id: "confirmed-hit"; durationSeconds: number; fixedDeltaSeconds: number };
  };
}

export interface CombatRuntimeRequest {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  commandId: typeof RUNTIME_RUN_COMMAND;
  fixtureId: typeof COMBAT_FIXTURE_ID;
  correlationId: string;
  requestedAt: string;
  timeoutMs: number;
  payload: {
    healthDefinitionKind: "health-profile";
    healthDefinitionSchemaVersion: 1;
    healthProfile: HealthProfile;
    offensiveActionDefinitionKind: "offensive-action-profile";
    offensiveActionDefinitionSchemaVersion: 1;
    offensiveActionProfile: OffensiveActionProfile;
    scenario: { id: "default"; durationSeconds: number; fixedDeltaSeconds: number };
  };
}

export interface StaminaRuntimeRequest {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  commandId: typeof RUNTIME_RUN_COMMAND;
  fixtureId: typeof STAMINA_FIXTURE_ID;
  correlationId: string;
  requestedAt: string;
  timeoutMs: number;
  payload: {
    staminaDefinitionKind: "stamina-profile";
    staminaDefinitionSchemaVersion: 1;
    staminaProfile: StaminaProfile;
    actionDefinitionKind: StaminaActionProfile["kind"];
    actionDefinitionSchemaVersion: 1;
    actionProfile: StaminaActionProfile;
    scenario: { id: "action-cost"; durationSeconds: number; fixedDeltaSeconds: number };
  };
}

export type StaminaCombatRuntimeScenario = "accepted" | "insufficient-stamina";

export interface StaminaCombatRuntimeRequest {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  commandId: typeof RUNTIME_RUN_COMMAND;
  fixtureId: typeof STAMINA_COMBAT_FIXTURE_ID;
  correlationId: string;
  requestedAt: string;
  timeoutMs: number;
  payload: {
    staminaDefinitionKind: "stamina-profile";
    staminaDefinitionSchemaVersion: 1;
    staminaProfile: StaminaProfile;
    healthDefinitionKind: "health-profile";
    healthDefinitionSchemaVersion: 1;
    healthProfile: HealthProfile;
    offensiveActionDefinitionKind: "offensive-action-profile";
    offensiveActionDefinitionSchemaVersion: 1;
    offensiveActionProfile: OffensiveActionProfile;
    scenario: { id: StaminaCombatRuntimeScenario; durationSeconds: number; fixedDeltaSeconds: number };
  };
}

export interface TargetedCombatRuntimeRequest {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  commandId: typeof RUNTIME_RUN_COMMAND;
  fixtureId: typeof TARGETED_COMBAT_FIXTURE_ID;
  correlationId: string;
  requestedAt: string;
  timeoutMs: number;
  payload: {
    targetingDefinitionKind: "targeting-profile";
    targetingDefinitionSchemaVersion: 1;
    targetingProfile: TargetingProfile;
    staminaDefinitionKind: "stamina-profile";
    staminaDefinitionSchemaVersion: 1;
    staminaProfile: StaminaProfile;
    healthDefinitionKind: "health-profile";
    healthDefinitionSchemaVersion: 1;
    healthProfile: HealthProfile;
    offensiveActionDefinitionKind: "offensive-action-profile";
    offensiveActionDefinitionSchemaVersion: 1;
    offensiveActionProfile: OffensiveActionProfile;
    scenario: { id: TargetedCombatExchangeScenario; durationSeconds: number; fixedDeltaSeconds: number };
  };
}

export interface ActionTimelineRuntimeRequest {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  commandId: typeof RUNTIME_RUN_COMMAND;
  fixtureId: typeof ACTION_TIMELINE_FIXTURE_ID;
  correlationId: string;
  requestedAt: string;
  timeoutMs: number;
  payload: {
    definitionKind: "action-timeline-profile";
    definitionSchemaVersion: 1;
    profile: ActionTimelineProfile;
    scenario: { id: "default"; durationSeconds: number; fixedDeltaSeconds: number };
  };
}

export type ContactVolumeRuntimeScenario = "overlapping-active" | "window-miss";

export interface ContactVolumeRuntimeRequest {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  commandId: typeof RUNTIME_RUN_COMMAND;
  fixtureId: typeof CONTACT_VOLUME_FIXTURE_ID;
  correlationId: string;
  requestedAt: string;
  timeoutMs: number;
  payload: {
    hitboxDefinitionKind: "contact-volume-profile";
    hitboxDefinitionSchemaVersion: 1;
    hitboxProfile: ContactVolumeProfile;
    hurtboxDefinitionKind: "contact-volume-profile";
    hurtboxDefinitionSchemaVersion: 1;
    hurtboxProfile: ContactVolumeProfile;
    scenario: { id: ContactVolumeRuntimeScenario; durationSeconds: number; fixedDeltaSeconds: number };
  };
}

export type DamageReactionRuntimeScenario = "hit-continues" | "stagger-interrupts" | "defeat-interrupts";

export interface DamageReactionRuntimeRequest {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  commandId: typeof RUNTIME_RUN_COMMAND;
  fixtureId: typeof DAMAGE_REACTION_FIXTURE_ID;
  correlationId: string;
  requestedAt: string;
  timeoutMs: number;
  payload: {
    reactionDefinitionKind: "damage-reaction-profile";
    reactionDefinitionSchemaVersion: 1;
    reactionProfile: DamageReactionProfile;
    healthDefinitionKind: "health-profile";
    healthDefinitionSchemaVersion: 1;
    healthProfile: HealthProfile;
    offensiveActionDefinitionKind: "offensive-action-profile";
    offensiveActionDefinitionSchemaVersion: 1;
    offensiveActionProfile: OffensiveActionProfile;
    scenario: { id: DamageReactionRuntimeScenario; durationSeconds: number; fixedDeltaSeconds: number; targetActionWasActive: true };
  };
}

export type WeaponRuntimeScenario = "successful-strike" | "insufficient-stamina";

export interface WeaponRuntimeRequest {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  commandId: typeof RUNTIME_RUN_COMMAND;
  fixtureId: typeof WEAPON_FIXTURE_ID;
  correlationId: string;
  requestedAt: string;
  timeoutMs: number;
  payload: {
    weaponDefinitionKind: "weapon-profile";
    weaponDefinitionSchemaVersion: 1;
    weaponProfile: WeaponProfile;
    resolvedDefinitionPaths: ResolvedWeaponDefinitionPaths;
    offensiveActionDefinitionKind: "offensive-action-profile";
    offensiveActionDefinitionSchemaVersion: 1;
    offensiveActionProfile: OffensiveActionProfile;
    actionTimelineDefinitionKind: "action-timeline-profile";
    actionTimelineDefinitionSchemaVersion: 1;
    actionTimelineProfile: ActionTimelineProfile;
    hitboxDefinitionKind: "contact-volume-profile";
    hitboxDefinitionSchemaVersion: 1;
    hitboxProfile: ContactVolumeProfile;
    staminaDefinitionKind: "stamina-profile";
    staminaDefinitionSchemaVersion: 1;
    staminaProfile: StaminaProfile;
    healthDefinitionKind: "health-profile";
    healthDefinitionSchemaVersion: 1;
    healthProfile: HealthProfile;
    hurtboxDefinitionKind: "contact-volume-profile";
    hurtboxDefinitionSchemaVersion: 1;
    hurtboxProfile: ContactVolumeProfile;
    reactionDefinitionKind: "damage-reaction-profile";
    reactionDefinitionSchemaVersion: 1;
    reactionProfile: DamageReactionProfile;
    scenario: { id: WeaponRuntimeScenario; durationSeconds: number; fixedDeltaSeconds: number; targetActionWasActive: true };
  };
}

export interface LargeEnemyRuntimeRequest {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  commandId: typeof RUNTIME_RUN_COMMAND;
  fixtureId: typeof LARGE_ENEMY_FIXTURE_ID;
  correlationId: string;
  requestedAt: string;
  timeoutMs: number;
  payload: {
    largeEnemyDefinitionKind: "large-enemy-profile";
    largeEnemyDefinitionSchemaVersion: 1;
    largeEnemyProfile: LargeEnemyProfile;
    resolvedDefinitionPaths: ResolvedLargeEnemyDefinitionPaths;
    healthDefinitionKind: "health-profile";
    healthDefinitionSchemaVersion: 1;
    healthProfile: HealthProfile;
    reactionDefinitionKind: "damage-reaction-profile";
    reactionDefinitionSchemaVersion: 1;
    reactionProfile: DamageReactionProfile;
    hurtboxDefinitionKind: "contact-volume-profile";
    hurtboxDefinitionSchemaVersion: 1;
    hurtboxProfiles: ContactVolumeProfile[];
    scenario: { id: LargeEnemyScenario; durationSeconds: number; fixedDeltaSeconds: number };
  };
}

export type RuntimeRequest = MovementRuntimeRequest | CameraRuntimeRequest | TargetingRuntimeRequest | DefensiveActionRuntimeRequest | OffensiveActionRuntimeRequest | HealthRuntimeRequest | CombatRuntimeRequest | StaminaRuntimeRequest | StaminaCombatRuntimeRequest | TargetedCombatRuntimeRequest | ActionTimelineRuntimeRequest | ContactVolumeRuntimeRequest | DamageReactionRuntimeRequest | WeaponRuntimeRequest | LargeEnemyRuntimeRequest;
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
