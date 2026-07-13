import { validateCameraDefinition } from "../../domain/camera/cameraValidation";
import type { CameraProfile } from "../../domain/camera/cameraTypes";
import type { DefinitionKind } from "../../domain/definitions/definitionTypes";
import { validateDefensiveActionDefinition } from "../../domain/defensiveAction/defensiveActionValidation";
import type { DefensiveActionProfile } from "../../domain/defensiveAction/defensiveActionTypes";
import { validateOffensiveActionDefinition } from "../../domain/offensiveAction/offensiveActionValidation";
import type { OffensiveActionProfile } from "../../domain/offensiveAction/offensiveActionTypes";
import { validateHealthDefinition } from "../../domain/health/healthValidation";
import type { HealthProfile } from "../../domain/health/healthTypes";
import { validateStaminaDefinition } from "../../domain/stamina/staminaValidation";
import type { StaminaProfile } from "../../domain/stamina/staminaTypes";
import { validateMovementDefinition } from "../../domain/movement/movementValidation";
import type { MovementProfile } from "../../domain/movement/movementTypes";
import { validateTargetingDefinition } from "../../domain/targeting/targetingValidation";
import type { TargetingProfile } from "../../domain/targeting/targetingTypes";
import { ErrorCodes } from "../../shared/errorCodes";
import type { OperationError } from "../../shared/operationResult";
import type { ContentVerification } from "../persistence/transactionalFileReplace";
import { validateActionTimelineDefinition } from "../../domain/actionTimeline/actionTimelineValidation";
import type { ActionTimelineProfile } from "../../domain/actionTimeline/actionTimelineTypes";
import { validateContactVolumeDefinition } from "../../domain/contactVolume/contactVolumeValidation";
import type { ContactVolumeProfile } from "../../domain/contactVolume/contactVolumeTypes";
import { validateDamageReactionDefinition } from "../../domain/damageReaction/damageReactionValidation";
import type { DamageReactionProfile } from "../../domain/damageReaction/damageReactionTypes";
import { validateWeaponDefinition } from "../../domain/weapon/weaponValidation";
import type { WeaponProfile } from "../../domain/weapon/weaponTypes";
import { validateLargeEnemyDefinition } from "../../domain/largeEnemy/largeEnemyValidation";
import type { LargeEnemyProfile } from "../../domain/largeEnemy/largeEnemyTypes";
import { validateHunterDefinition } from "../../domain/hunter/hunterValidation";
import type { HunterProfile } from "../../domain/hunter/hunterTypes";
import { validateArenaDefinition } from "../../domain/arena/arenaValidation";
import type { ArenaProfile } from "../../domain/arena/arenaTypes";
import { validateEncounterDefinition } from "../../domain/encounter/encounterValidation";
import type { EncounterProfile } from "../../domain/encounter/encounterTypes";

export type { DefinitionKind } from "../../domain/definitions/definitionTypes";
export type SupportedDefinition = MovementProfile | CameraProfile | TargetingProfile | DefensiveActionProfile | OffensiveActionProfile | HealthProfile | StaminaProfile | ActionTimelineProfile | ContactVolumeProfile | DamageReactionProfile | WeaponProfile | LargeEnemyProfile | HunterProfile | ArenaProfile | EncounterProfile;
export const SUPPORTED_DEFINITION_KINDS = ["movement-profile", "camera-profile", "targeting-profile", "defensive-action-profile", "offensive-action-profile", "health-profile", "stamina-profile", "action-timeline-profile", "contact-volume-profile", "damage-reaction-profile", "weapon-profile", "large-enemy-profile", "hunter-profile", "arena-profile", "encounter-profile"] as const satisfies readonly DefinitionKind[];

export interface DefinitionValidationResult {
  valid: boolean;
  kind: DefinitionKind | null;
  definition: SupportedDefinition | null;
  schemaVersion: number | null;
  errors: OperationError[];
}

export function validateDefinition(value: unknown): DefinitionValidationResult {
  const kind = recordKind(value);
  if (kind === "movement-profile") {
    const result = validateMovementDefinition(value);
    return { valid: result.valid, kind, definition: result.profile, schemaVersion: result.profile?.schemaVersion ?? schemaVersion(value), errors: result.errors };
  }
  if (kind === "camera-profile") {
    const result = validateCameraDefinition(value);
    return { valid: result.valid, kind, definition: result.profile, schemaVersion: result.profile?.schemaVersion ?? schemaVersion(value), errors: result.errors };
  }
  if (kind === "targeting-profile") {
    const result = validateTargetingDefinition(value);
    return { valid: result.valid, kind, definition: result.profile, schemaVersion: result.profile?.schemaVersion ?? schemaVersion(value), errors: result.errors };
  }
  if (kind === "defensive-action-profile") {
    const result = validateDefensiveActionDefinition(value);
    return { valid: result.valid, kind, definition: result.profile, schemaVersion: result.profile?.schemaVersion ?? schemaVersion(value), errors: result.errors };
  }
  if (kind === "offensive-action-profile") {
    const result = validateOffensiveActionDefinition(value);
    return { valid: result.valid, kind, definition: result.profile, schemaVersion: result.profile?.schemaVersion ?? schemaVersion(value), errors: result.errors };
  }
  if (kind === "health-profile") {
    const result = validateHealthDefinition(value);
    return { valid: result.valid, kind, definition: result.profile, schemaVersion: result.profile?.schemaVersion ?? schemaVersion(value), errors: result.errors };
  }
  if (kind === "stamina-profile") {
    const result = validateStaminaDefinition(value);
    return { valid: result.valid, kind, definition: result.profile, schemaVersion: result.profile?.schemaVersion ?? schemaVersion(value), errors: result.errors };
  }
  if (kind === "action-timeline-profile") {
    const result = validateActionTimelineDefinition(value);
    return { valid: result.valid, kind, definition: result.profile, schemaVersion: result.profile?.schemaVersion ?? schemaVersion(value), errors: result.errors };
  }
  if (kind === "contact-volume-profile") {
    const result = validateContactVolumeDefinition(value);
    return { valid: result.valid, kind, definition: result.profile, schemaVersion: result.profile?.schemaVersion ?? schemaVersion(value), errors: result.errors };
  }
  if (kind === "damage-reaction-profile") {
    const result = validateDamageReactionDefinition(value);
    return { valid: result.valid, kind, definition: result.profile, schemaVersion: result.profile?.schemaVersion ?? schemaVersion(value), errors: result.errors };
  }
  if (kind === "weapon-profile") {
    const result = validateWeaponDefinition(value);
    return { valid: result.valid, kind, definition: result.profile, schemaVersion: result.profile?.schemaVersion ?? schemaVersion(value), errors: result.errors };
  }
  if (kind === "large-enemy-profile") {
    const result = validateLargeEnemyDefinition(value);
    return { valid: result.valid, kind, definition: result.profile, schemaVersion: result.profile?.schemaVersion ?? schemaVersion(value), errors: result.errors };
  }
  if (kind === "hunter-profile") {
    const result = validateHunterDefinition(value);
    return { valid: result.valid, kind, definition: result.profile, schemaVersion: result.profile?.schemaVersion ?? schemaVersion(value), errors: result.errors };
  }
  if (kind === "arena-profile") {
    const result = validateArenaDefinition(value);
    return { valid: result.valid, kind, definition: result.profile, schemaVersion: result.profile?.schemaVersion ?? schemaVersion(value), errors: result.errors };
  }
  if (kind === "encounter-profile") {
    const result = validateEncounterDefinition(value);
    return { valid: result.valid, kind, definition: result.profile, schemaVersion: result.profile?.schemaVersion ?? schemaVersion(value), errors: result.errors };
  }
  return {
    valid: false,
    kind: null,
    definition: null,
    schemaVersion: schemaVersion(value),
    errors: [{ code: ErrorCodes.DefinitionKindUnsupported, path: "kind", message: "Definition kind must be movement-profile, camera-profile, targeting-profile, defensive-action-profile, offensive-action-profile, health-profile, stamina-profile, action-timeline-profile, contact-volume-profile, damage-reaction-profile, weapon-profile, large-enemy-profile, hunter-profile, arena-profile, or encounter-profile", actual: recordKind(value), expected: [...SUPPORTED_DEFINITION_KINDS] }]
  };
}

export function verifyDefinitionContent(content: string, expectedKind?: DefinitionKind): ContentVerification<SupportedDefinition> {
  let value: unknown;
  try { value = JSON.parse(content) as unknown; }
  catch { return { validationPassed: false, errors: [{ code: ErrorCodes.DefinitionFileInvalid, message: "Definition content is not valid JSON" }] }; }
  const result = validateDefinition(value);
  if (!result.valid || result.definition === null || result.kind === null) return { validationPassed: false, errors: result.errors };
  if (expectedKind !== undefined && result.kind !== expectedKind) {
    return { validationPassed: false, errors: [{ code: ErrorCodes.SnapshotRollbackFailed, path: "kind", message: "Snapshot and current target definition kinds must match", actual: result.kind, expected: expectedKind }] };
  }
  return { validationPassed: true, value: result.definition };
}

function recordKind(value: unknown): unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>).kind : undefined;
}
function schemaVersion(value: unknown): number | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const version = (value as Record<string, unknown>).schemaVersion;
  return typeof version === "number" ? version : null;
}
