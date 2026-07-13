import { validateCameraDefinition } from "../camera/cameraValidation";
import type { CameraScenario } from "../camera/cameraTypes";
import { validateMovementDefinition } from "../movement/movementValidation";
import { validateTargetingDefinition } from "../targeting/targetingValidation";
import { validateDefensiveActionDefinition } from "../defensiveAction/defensiveActionValidation";
import { validateOffensiveActionDefinition } from "../offensiveAction/offensiveActionValidation";
import { validateHealthDefinition } from "../health/healthValidation";
import { simulateOffensiveAction } from "../offensiveAction/offensiveActionSimulation";
import { validateStaminaDefinition } from "../stamina/staminaValidation";
import { simulateStaminaCombatExchange } from "../combat/staminaCombatExchangeSimulation";
import { simulateTargetedCombatExchange } from "../combat/targetedCombatExchangeSimulation";
import { validateActionTimelineDefinition } from "../actionTimeline/actionTimelineValidation";
import { simulateContact } from "../contactVolume/contactVolumeSimulation";
import { validateContactVolumeDefinition } from "../contactVolume/contactVolumeValidation";
import { simulateDamageReactionHit } from "../damageReaction/damageReactionSimulation";
import { validateDamageReactionDefinition } from "../damageReaction/damageReactionValidation";
import { simulateWeaponStrike } from "../weapon/weaponSimulation";
import { validateWeaponCompatibility, validateWeaponDefinition } from "../weapon/weaponValidation";
import { simulateLargeEnemyBehavior } from "../largeEnemy/largeEnemySimulation";
import { validateLargeEnemyDefinition } from "../largeEnemy/largeEnemyValidation";
import { validateEncounterDefinition } from "../encounter/encounterValidation";
import { simulateEncounter } from "../encounter/encounterSimulation";
import { validateHunterDefinition } from "../hunter/hunterValidation";
import { validateArenaDefinition } from "../arena/arenaValidation";
import { validateEncounterCheckpoint } from "./encounterCheckpoint";
import { validateCameraRuntimeMetrics } from "./cameraRuntimeMetrics";
import { validateTargetingRuntimePlan } from "./targetingRuntimePlan";
import { validateTargetingRuntimeMetrics } from "./targetingRuntimeMetrics";
import { ACTION_TIMELINE_FIXTURE_ID, CAMERA_FIXTURE_ID, CAMERA_RUNTIME_SCENARIOS, COMBAT_FIXTURE_ID, CONTACT_VOLUME_FIXTURE_ID, DAMAGE_REACTION_FIXTURE_ID, DEFENSIVE_ACTION_FIXTURE_ID, ENCOUNTER_FIXTURE_ID, HEALTH_FIXTURE_ID, LARGE_ENEMY_FIXTURE_ID, MOVEMENT_FIXTURE_ID, MOVEMENT_RUNTIME_SCENARIOS, OFFENSIVE_ACTION_FIXTURE_ID, RUNTIME_RUN_COMMAND, RUNTIME_SCHEMA_VERSION, STAMINA_COMBAT_FIXTURE_ID, STAMINA_FIXTURE_ID, TARGETED_COMBAT_FIXTURE_ID, TARGETING_FIXTURE_ID, WEAPON_FIXTURE_ID, type RuntimeRequest, type RuntimeResponse } from "./runtimeProtocol";

export interface ProtocolValidation<T> { valid: boolean; value?: T; errors: string[] }

export function validateRuntimeRequest(value: unknown): ProtocolValidation<RuntimeRequest> {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ["request must be an object"] };
  if (value.schemaVersion !== RUNTIME_SCHEMA_VERSION) errors.push("unsupported schemaVersion");
  if (value.commandId !== RUNTIME_RUN_COMMAND) errors.push("unknown commandId");
  if (value.fixtureId !== MOVEMENT_FIXTURE_ID && value.fixtureId !== CAMERA_FIXTURE_ID && value.fixtureId !== TARGETING_FIXTURE_ID && value.fixtureId !== DEFENSIVE_ACTION_FIXTURE_ID && value.fixtureId !== OFFENSIVE_ACTION_FIXTURE_ID && value.fixtureId !== HEALTH_FIXTURE_ID && value.fixtureId !== COMBAT_FIXTURE_ID && value.fixtureId !== STAMINA_FIXTURE_ID && value.fixtureId !== STAMINA_COMBAT_FIXTURE_ID && value.fixtureId !== TARGETED_COMBAT_FIXTURE_ID && value.fixtureId !== ACTION_TIMELINE_FIXTURE_ID && value.fixtureId !== CONTACT_VOLUME_FIXTURE_ID && value.fixtureId !== DAMAGE_REACTION_FIXTURE_ID && value.fixtureId !== WEAPON_FIXTURE_ID && value.fixtureId !== LARGE_ENEMY_FIXTURE_ID && value.fixtureId !== ENCOUNTER_FIXTURE_ID) errors.push("unknown fixtureId");
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
  else if (value.fixtureId === STAMINA_FIXTURE_ID) validateStaminaPayload(value.payload, errors);
  else if (value.fixtureId === STAMINA_COMBAT_FIXTURE_ID) validateStaminaCombatPayload(value.payload, errors);
  else if (value.fixtureId === TARGETED_COMBAT_FIXTURE_ID) validateTargetedCombatPayload(value.payload, errors);
  else if (value.fixtureId === ACTION_TIMELINE_FIXTURE_ID) validateActionTimelinePayload(value.payload, errors);
  else if (value.fixtureId === CONTACT_VOLUME_FIXTURE_ID) validateContactVolumePayload(value.payload, errors);
  else if (value.fixtureId === DAMAGE_REACTION_FIXTURE_ID) validateDamageReactionPayload(value.payload, errors);
  else if (value.fixtureId === WEAPON_FIXTURE_ID) validateWeaponPayload(value.payload, errors);
  else if (value.fixtureId === LARGE_ENEMY_FIXTURE_ID) validateLargeEnemyPayload(value.payload, errors);
  else if (value.fixtureId === ENCOUNTER_FIXTURE_ID) validateEncounterPayload(value.payload, errors);
  else if (value.fixtureId === MOVEMENT_FIXTURE_ID) validateMovementPayload(value.payload, errors);
  return errors.length === 0 ? { valid: true, value: value as unknown as RuntimeRequest, errors } : { valid: false, errors };
}

function validateEncounterPayload(payload: Record<string, any>, errors: string[]): void {
  if (payload.encounterDefinitionKind !== "encounter-profile" || payload.encounterDefinitionSchemaVersion !== 1) errors.push("unsupported encounter definition");
  if (payload.hunterDefinitionKind !== "hunter-profile" || payload.hunterDefinitionSchemaVersion !== 1) errors.push("unsupported encounter hunter definition");
  if (payload.hunterHealthDefinitionKind !== "health-profile" || payload.hunterHealthDefinitionSchemaVersion !== 1) errors.push("unsupported encounter hunter health definition");
  if (payload.staminaDefinitionKind !== "stamina-profile" || payload.staminaDefinitionSchemaVersion !== 1) errors.push("unsupported encounter stamina definition");
  if (payload.weaponDefinitionKind !== "weapon-profile" || payload.weaponDefinitionSchemaVersion !== 1) errors.push("unsupported encounter weapon definition");
  if (payload.offensiveActionDefinitionKind !== "offensive-action-profile" || payload.offensiveActionDefinitionSchemaVersion !== 1) errors.push("unsupported encounter offensive action definition");
  if (payload.actionTimelineDefinitionKind !== "action-timeline-profile" || payload.actionTimelineDefinitionSchemaVersion !== 1) errors.push("unsupported encounter action timeline definition");
  if (payload.hitboxDefinitionKind !== "contact-volume-profile" || payload.hitboxDefinitionSchemaVersion !== 1) errors.push("unsupported encounter hitbox definition");
  if (payload.enemyDefinitionKind !== "large-enemy-profile" || payload.enemyDefinitionSchemaVersion !== 1) errors.push("unsupported encounter enemy definition");
  if (payload.enemyHealthDefinitionKind !== "health-profile" || payload.enemyHealthDefinitionSchemaVersion !== 1) errors.push("unsupported encounter enemy health definition");
  if (payload.reactionDefinitionKind !== "damage-reaction-profile" || payload.reactionDefinitionSchemaVersion !== 1) errors.push("unsupported encounter reaction definition");
  if (payload.hurtboxDefinitionKind !== "contact-volume-profile" || payload.hurtboxDefinitionSchemaVersion !== 1) errors.push("unsupported encounter hurtbox definitions");
  if (payload.arenaDefinitionKind !== "arena-profile" || payload.arenaDefinitionSchemaVersion !== 1) errors.push("unsupported encounter arena definition");
  const encounter = validateEncounterDefinition(payload.encounterProfile); if (!encounter.valid) errors.push(...encounter.errors.map((error) => error.message));
  const hunter = validateHunterDefinition(payload.hunterProfile); if (!hunter.valid) errors.push(...hunter.errors.map((error) => error.message));
  const hunterHealth = validateHealthDefinition(payload.hunterHealthProfile); if (!hunterHealth.valid) errors.push(...hunterHealth.errors.map((error) => error.message));
  const stamina = validateStaminaDefinition(payload.staminaProfile); if (!stamina.valid) errors.push(...stamina.errors.map((error) => error.message));
  const weapon = validateWeaponDefinition(payload.weaponProfile); if (!weapon.valid) errors.push(...weapon.errors.map((error) => error.message));
  const action = validateOffensiveActionDefinition(payload.offensiveActionProfile); if (!action.valid) errors.push(...action.errors.map((error) => error.message));
  const timeline = validateActionTimelineDefinition(payload.actionTimelineProfile); if (!timeline.valid) errors.push(...timeline.errors.map((error) => error.message));
  const hitbox = validateContactVolumeDefinition(payload.hitboxProfile); if (!hitbox.valid) errors.push(...hitbox.errors.map((error) => error.message));
  const enemy = validateLargeEnemyDefinition(payload.enemyProfile); if (!enemy.valid) errors.push(...enemy.errors.map((error) => error.message));
  const enemyHealth = validateHealthDefinition(payload.enemyHealthProfile); if (!enemyHealth.valid) errors.push(...enemyHealth.errors.map((error) => error.message));
  const reaction = validateDamageReactionDefinition(payload.reactionProfile); if (!reaction.valid) errors.push(...reaction.errors.map((error) => error.message));
  const arena = validateArenaDefinition(payload.arenaProfile); if (!arena.valid) errors.push(...arena.errors.map((error) => error.message));
  const hurtboxes = Array.isArray(payload.hurtboxProfiles) ? payload.hurtboxProfiles.map((value: unknown) => validateContactVolumeDefinition(value)) : []; if (!Array.isArray(payload.hurtboxProfiles)) errors.push("encounter hurtbox profiles must be an array");
  for (const hurtbox of hurtboxes) { if (!hurtbox.valid) errors.push(...hurtbox.errors.map((error) => error.message)); else if (hurtbox.profile?.role !== "hurtbox") errors.push("encounter body-part contact volume must be a hurtbox"); }
  const selectedHurtbox = validateContactVolumeDefinition(payload.selectedHurtboxProfile); if (!selectedHurtbox.valid) errors.push(...selectedHurtbox.errors.map((error) => error.message)); else if (selectedHurtbox.profile?.role !== "hurtbox") errors.push("encounter selected contact volume must be a hurtbox");
  if (hitbox.profile?.role !== "hitbox") errors.push("encounter weapon contact volume must be a hitbox");
  const topPaths = payload.resolvedDefinitionPaths; const hunterPaths = payload.hunterResolvedDefinitionPaths; const weaponPaths = payload.weaponResolvedDefinitionPaths; const enemyPaths = payload.enemyResolvedDefinitionPaths;
  if (!isRecord(topPaths) || ![topPaths.hunterFile, topPaths.weaponFile, topPaths.enemyFile, topPaths.arenaFile].every(nonBlank)) errors.push("encounter resolved definition paths are invalid");
  if (!isRecord(hunterPaths) || ![hunterPaths.healthFile, hunterPaths.staminaFile].every(nonBlank)) errors.push("encounter hunter paths are invalid");
  if (!isRecord(weaponPaths) || ![weaponPaths.offensiveActionFile, weaponPaths.actionTimelineFile, weaponPaths.hitboxFile].every(nonBlank)) errors.push("encounter weapon paths are invalid");
  if (!isRecord(enemyPaths) || !nonBlank(enemyPaths.healthFile) || !nonBlank(enemyPaths.reactionFile) || !Array.isArray(enemyPaths.bodyParts)) errors.push("encounter enemy paths are invalid");
  const selectedIndex = enemy.profile?.bodyParts.findIndex((part) => part.targetable) ?? -1; if (selectedIndex < 0 || enemy.profile?.bodyParts[selectedIndex]?.id !== payload.selectedBodyPartId || selectedHurtbox.profile?.id !== hurtboxes[selectedIndex]?.profile?.id) errors.push("encounter selected body part must be the first targetable declaration");
  const scenario = payload.scenario; if (!isRecord(scenario)) { errors.push("scenario must be an object"); return; }
  if (!["successful-hunt", "stamina-exhausted"].includes(String(scenario.id))) errors.push("unsupported encounter scenario");
  if (!finiteInRange(scenario.durationSeconds, Number.EPSILON, 60)) errors.push("durationSeconds must be finite and bounded"); if (!finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1)) errors.push("fixedDeltaSeconds must be finite and bounded"); if (!finiteInRange(scenario.startingStamina, 0, Number.MAX_SAFE_INTEGER)) errors.push("startingStamina must be finite and non-negative");
  const mode = scenario.mode ?? "runtime"; if (!["runtime", "interactive", "recovery-initial", "recovery-resume"].includes(String(mode))) errors.push("unsupported encounter runtime mode");
  if (mode === "interactive" && scenario.autoDrive !== true) errors.push("interactive encounter automation must use input driving");
  if (mode !== "runtime" && (typeof scenario.checkpointPath !== "string" || !/[\\/]\.mam-engine[\\/]runtime-sessions[\\/][A-Za-z0-9_-]+[\\/]encounter-checkpoint\.json$/.test(scenario.checkpointPath) || scenario.checkpointPath.includes(".."))) errors.push("encounter checkpoint path must remain inside a runtime session");
  if (mode === "recovery-initial" && (!Number.isInteger(scenario.interruptAfterRound) || scenario.interruptAfterRound < 1 || (encounter.profile && scenario.interruptAfterRound >= encounter.profile.maxRounds))) errors.push("recovery interruption round is invalid");
  if (encounter.profile && hunterHealth.profile && stamina.profile && weapon.profile && action.profile && timeline.profile && hitbox.profile?.role === "hitbox" && enemy.profile && enemyHealth.profile && reaction.profile && arena.profile && selectedHurtbox.profile?.role === "hurtbox" && isRecord(topPaths) && isRecord(weaponPaths) && isRecord(enemyPaths) && finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1) && ["successful-hunt", "stamina-exhausted"].includes(String(scenario.id))) {
    if (action.profile && timeline.profile && hitbox.profile) errors.push(...validateWeaponCompatibility(weapon.profile, action.profile, timeline.profile, hitbox.profile).map((error) => error.message));
    try { const simulation = simulateEncounter({ profile: encounter.profile, resolvedDefinitionPaths: topPaths as any, arena: arena.profile, hunterHealth: hunterHealth.profile, hunterStamina: stamina.profile, weapon: { profile: weapon.profile, resolvedDefinitionPaths: weaponPaths as any, offensiveAction: action.profile, actionTimeline: timeline.profile, hitbox: hitbox.profile }, enemy: enemy.profile, enemyResolvedDefinitionPaths: enemyPaths as any, enemyHealth: enemyHealth.profile, enemyReaction: reaction.profile, selectedBodyPartId: String(payload.selectedBodyPartId), selectedHurtbox: selectedHurtbox.profile, scenario: scenario.id, fixedDeltaSeconds: scenario.fixedDeltaSeconds }); if (simulation.hunterStartingStamina !== scenario.startingStamina) errors.push("scenario starting stamina must match encounter simulation"); if (mode === "recovery-resume") { const checkpoint = validateEncounterCheckpoint(scenario.recoveryCheckpoint, { encounterId: encounter.profile.id, scenarioId: scenario.id, selectedBodyPartId: String(payload.selectedBodyPartId), maximumRounds: encounter.profile.maxRounds, startingStamina: simulation.hunterStartingStamina, maximumStamina: stamina.profile.maxStamina, startingEnemyHealth: enemyHealth.profile.startingHealth, maximumEnemyHealth: enemyHealth.profile.maxHealth, requireResumable: true }); if (!checkpoint.valid) errors.push(...checkpoint.errors); } } catch (caught) { errors.push(caught instanceof Error ? caught.message : String(caught)); }
  }
}

function nonBlank(value: unknown): boolean { return typeof value === "string" && value.length > 0; }

function validateLargeEnemyPayload(payload: Record<string, any>, errors: string[]): void {
  if (payload.largeEnemyDefinitionKind !== "large-enemy-profile" || payload.largeEnemyDefinitionSchemaVersion !== 1) errors.push("unsupported large-enemy definition");
  if (payload.healthDefinitionKind !== "health-profile" || payload.healthDefinitionSchemaVersion !== 1) errors.push("unsupported large-enemy health definition");
  if (payload.reactionDefinitionKind !== "damage-reaction-profile" || payload.reactionDefinitionSchemaVersion !== 1) errors.push("unsupported large-enemy reaction definition");
  if (payload.hurtboxDefinitionKind !== "contact-volume-profile" || payload.hurtboxDefinitionSchemaVersion !== 1) errors.push("unsupported large-enemy hurtbox definition");
  const enemy = validateLargeEnemyDefinition(payload.largeEnemyProfile); if (!enemy.valid) errors.push(...enemy.errors.map((error) => error.message));
  const health = validateHealthDefinition(payload.healthProfile); if (!health.valid) errors.push(...health.errors.map((error) => error.message));
  const reaction = validateDamageReactionDefinition(payload.reactionProfile); if (!reaction.valid) errors.push(...reaction.errors.map((error) => error.message));
  const hurtboxes = Array.isArray(payload.hurtboxProfiles) ? payload.hurtboxProfiles.map((value: unknown) => validateContactVolumeDefinition(value)) : [];
  if (!Array.isArray(payload.hurtboxProfiles)) errors.push("large-enemy hurtbox profiles must be an array");
  for (const hurtbox of hurtboxes) { if (!hurtbox.valid) errors.push(...hurtbox.errors.map((error) => error.message)); else if (hurtbox.profile?.role !== "hurtbox") errors.push("large-enemy body-part contact volume must be a hurtbox"); }
  const paths = payload.resolvedDefinitionPaths;
  if (!isRecord(paths) || typeof paths.healthFile !== "string" || paths.healthFile.length === 0 || typeof paths.reactionFile !== "string" || paths.reactionFile.length === 0 || !Array.isArray(paths.bodyParts)) errors.push("large-enemy resolved definition paths are invalid");
  if (enemy.profile && (hurtboxes.length !== enemy.profile.bodyParts.length || !isRecord(paths) || !Array.isArray(paths.bodyParts) || paths.bodyParts.length !== enemy.profile.bodyParts.length)) errors.push("large-enemy body-part references must preserve declaration order");
  if (enemy.profile && isRecord(paths) && Array.isArray(paths.bodyParts)) enemy.profile.bodyParts.forEach((part, index) => { const resolved = paths.bodyParts[index]; if (!isRecord(resolved) || resolved.id !== part.id || typeof resolved.hurtboxFile !== "string" || resolved.hurtboxFile.length === 0) errors.push("large-enemy resolved body-part path is invalid"); });
  const scenario = payload.scenario; if (!isRecord(scenario)) { errors.push("scenario must be an object"); return; }
  if (!["full-cycle", "primary-part-disabled"].includes(String(scenario.id))) errors.push("unsupported large-enemy scenario");
  if (!finiteInRange(scenario.durationSeconds, Number.EPSILON, 60)) errors.push("durationSeconds must be finite and bounded");
  if (!finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1)) errors.push("fixedDeltaSeconds must be finite and bounded");
  if (enemy.profile && isRecord(paths) && Array.isArray(paths.bodyParts) && finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1) && ["full-cycle", "primary-part-disabled"].includes(String(scenario.id))) {
    if (scenario.id === "primary-part-disabled" && enemy.profile.bodyParts.filter((part) => part.targetable).length < 2) errors.push("primary-part-disabled requires another targetable body part");
    else { const simulation = simulateLargeEnemyBehavior(enemy.profile, paths as any, scenario.id, scenario.fixedDeltaSeconds); if (scenario.durationSeconds !== simulation.totalCycleDurationSeconds) errors.push("scenario duration must match large-enemy simulation"); }
  }
}

function validateWeaponPayload(payload: Record<string, any>, errors: string[]): void {
  if (payload.weaponDefinitionKind !== "weapon-profile" || payload.weaponDefinitionSchemaVersion !== 1) errors.push("unsupported weapon definition");
  if (payload.offensiveActionDefinitionKind !== "offensive-action-profile" || payload.offensiveActionDefinitionSchemaVersion !== 1) errors.push("unsupported weapon offensive action definition");
  if (payload.actionTimelineDefinitionKind !== "action-timeline-profile" || payload.actionTimelineDefinitionSchemaVersion !== 1) errors.push("unsupported weapon action timeline definition");
  if (payload.hitboxDefinitionKind !== "contact-volume-profile" || payload.hitboxDefinitionSchemaVersion !== 1) errors.push("unsupported weapon hitbox definition");
  if (payload.staminaDefinitionKind !== "stamina-profile" || payload.staminaDefinitionSchemaVersion !== 1) errors.push("unsupported weapon stamina definition");
  if (payload.healthDefinitionKind !== "health-profile" || payload.healthDefinitionSchemaVersion !== 1) errors.push("unsupported weapon health definition");
  if (payload.hurtboxDefinitionKind !== "contact-volume-profile" || payload.hurtboxDefinitionSchemaVersion !== 1) errors.push("unsupported weapon hurtbox definition");
  if (payload.reactionDefinitionKind !== "damage-reaction-profile" || payload.reactionDefinitionSchemaVersion !== 1) errors.push("unsupported weapon reaction definition");
  const weapon = validateWeaponDefinition(payload.weaponProfile); if (!weapon.valid) errors.push(...weapon.errors.map((error) => error.message));
  const action = validateOffensiveActionDefinition(payload.offensiveActionProfile); if (!action.valid) errors.push(...action.errors.map((error) => error.message));
  const timeline = validateActionTimelineDefinition(payload.actionTimelineProfile); if (!timeline.valid) errors.push(...timeline.errors.map((error) => error.message));
  const hitbox = validateContactVolumeDefinition(payload.hitboxProfile); if (!hitbox.valid) errors.push(...hitbox.errors.map((error) => error.message));
  const stamina = validateStaminaDefinition(payload.staminaProfile); if (!stamina.valid) errors.push(...stamina.errors.map((error) => error.message));
  const health = validateHealthDefinition(payload.healthProfile); if (!health.valid) errors.push(...health.errors.map((error) => error.message));
  const hurtbox = validateContactVolumeDefinition(payload.hurtboxProfile); if (!hurtbox.valid) errors.push(...hurtbox.errors.map((error) => error.message));
  const reaction = validateDamageReactionDefinition(payload.reactionProfile); if (!reaction.valid) errors.push(...reaction.errors.map((error) => error.message));
  if (hitbox.profile?.role !== "hitbox") errors.push("weapon referenced contact volume must be a hitbox"); if (hurtbox.profile?.role !== "hurtbox") errors.push("weapon target contact volume must be a hurtbox");
  const paths = payload.resolvedDefinitionPaths; if (!isRecord(paths) || ![paths.offensiveActionFile, paths.actionTimelineFile, paths.hitboxFile].every((value) => typeof value === "string" && value.length > 0)) errors.push("weapon resolved definition paths are invalid");
  if (weapon.profile && action.profile && timeline.profile && hitbox.profile) errors.push(...validateWeaponCompatibility(weapon.profile, action.profile, timeline.profile, hitbox.profile).map((error) => error.message));
  const scenario = payload.scenario; if (!isRecord(scenario)) { errors.push("scenario must be an object"); return; }
  if (!["successful-strike", "insufficient-stamina"].includes(String(scenario.id))) errors.push("unsupported weapon scenario");
  if (scenario.targetActionWasActive !== true) errors.push("weapon scenario requires an active target action");
  if (!finiteInRange(scenario.durationSeconds, 0, 60)) errors.push("durationSeconds must be finite and bounded"); if (!finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1)) errors.push("fixedDeltaSeconds must be finite and bounded");
  if (weapon.profile && action.profile && timeline.profile && hitbox.profile?.role === "hitbox" && stamina.profile && health.profile && hurtbox.profile?.role === "hurtbox" && reaction.profile && isRecord(paths) && finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1)) {
    const simulation = simulateWeaponStrike(weapon.profile, paths as any, stamina.profile, health.profile, hurtbox.profile, reaction.profile, action.profile, timeline.profile, hitbox.profile, scenario.fixedDeltaSeconds);
    const expectedDuration = simulation.actionAccepted ? action.profile.durationSeconds + action.profile.cooldownSeconds + simulation.reactionDurationSeconds : 0;
    if (scenario.durationSeconds !== expectedDuration) errors.push("scenario duration must match weapon simulation");
    if (scenario.id === "successful-strike" && (!simulation.actionAccepted || !simulation.contactOccurred || simulation.appliedDamage <= 0)) errors.push("successful-strike scenario requires an accepted contacting hit");
    if (scenario.id === "insufficient-stamina" && (simulation.actionAccepted || simulation.consumedStamina !== 0 || simulation.contactOccurred || simulation.appliedDamage !== 0)) errors.push("insufficient-stamina scenario requires rejection before contact and damage");
  }
}

function validateDamageReactionPayload(payload: Record<string, any>, errors: string[]): void {
  if (payload.reactionDefinitionKind !== "damage-reaction-profile" || payload.reactionDefinitionSchemaVersion !== 1) errors.push("unsupported damage reaction definition");
  if (payload.healthDefinitionKind !== "health-profile" || payload.healthDefinitionSchemaVersion !== 1) errors.push("unsupported damage reaction health definition");
  if (payload.offensiveActionDefinitionKind !== "offensive-action-profile" || payload.offensiveActionDefinitionSchemaVersion !== 1) errors.push("unsupported damage reaction offensive action definition");
  const reaction = validateDamageReactionDefinition(payload.reactionProfile); if (!reaction.valid) errors.push(...reaction.errors.map((error) => error.message));
  const health = validateHealthDefinition(payload.healthProfile); if (!health.valid) errors.push(...health.errors.map((error) => error.message));
  const action = validateOffensiveActionDefinition(payload.offensiveActionProfile); if (!action.valid) errors.push(...action.errors.map((error) => error.message));
  const scenario = payload.scenario; if (!isRecord(scenario)) { errors.push("scenario must be an object"); return; }
  if (!["hit-continues", "stagger-interrupts", "defeat-interrupts"].includes(String(scenario.id))) errors.push("unsupported damage reaction scenario");
  if (scenario.targetActionWasActive !== true) errors.push("damage reaction scenario requires an active target action");
  if (!finiteInRange(scenario.durationSeconds, 0, 60)) errors.push("durationSeconds must be finite and bounded");
  if (!finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1)) errors.push("fixedDeltaSeconds must be finite and bounded");
  if (reaction.valid && reaction.profile && health.valid && health.profile && action.valid && action.profile && finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1)) {
    const simulation = simulateDamageReactionHit(reaction.profile, health.profile, action.profile, true, scenario.fixedDeltaSeconds);
    if (scenario.durationSeconds !== simulation.reactionTotalSteps * scenario.fixedDeltaSeconds) errors.push("scenario duration must match damage reaction simulation");
    if (scenario.id === "hit-continues" && (simulation.reactionType !== "hit" || simulation.finalTargetActionState !== "continuing")) errors.push("hit-continues scenario requires a continuing hit reaction");
    if (scenario.id === "stagger-interrupts" && (simulation.reactionType !== "stagger" || !simulation.targetActionInterrupted)) errors.push("stagger-interrupts scenario requires an interrupting stagger");
    if (scenario.id === "defeat-interrupts" && (simulation.reactionType !== "defeat" || !simulation.targetActionInterrupted)) errors.push("defeat-interrupts scenario requires an interrupting defeat");
  }
}

function validateContactVolumePayload(payload: Record<string, any>, errors: string[]): void {
  if (payload.hitboxDefinitionKind !== "contact-volume-profile" || payload.hitboxDefinitionSchemaVersion !== 1) errors.push("unsupported contact volume hitbox definition");
  if (payload.hurtboxDefinitionKind !== "contact-volume-profile" || payload.hurtboxDefinitionSchemaVersion !== 1) errors.push("unsupported contact volume hurtbox definition");
  const hitbox = validateContactVolumeDefinition(payload.hitboxProfile); if (!hitbox.valid) errors.push(...hitbox.errors.map((error) => error.message));
  const hurtbox = validateContactVolumeDefinition(payload.hurtboxProfile); if (!hurtbox.valid) errors.push(...hurtbox.errors.map((error) => error.message));
  if (hitbox.profile?.role !== "hitbox") errors.push("contact volume first profile must be a hitbox");
  if (hurtbox.profile?.role !== "hurtbox") errors.push("contact volume second profile must be a hurtbox");
  const scenario = payload.scenario; if (!isRecord(scenario)) { errors.push("scenario must be an object"); return; }
  if (!["overlapping-active", "window-miss"].includes(String(scenario.id))) errors.push("unsupported contact volume scenario");
  if (!finiteInRange(scenario.durationSeconds, Number.EPSILON, 60)) errors.push("durationSeconds must be finite and bounded");
  if (!finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1)) errors.push("fixedDeltaSeconds must be finite and bounded");
  if (hitbox.valid && hitbox.profile?.role === "hitbox" && hurtbox.valid && hurtbox.profile?.role === "hurtbox" && finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1)) {
    const simulation = simulateContact(hitbox.profile, hurtbox.profile, scenario.fixedDeltaSeconds);
    if (scenario.durationSeconds !== simulation.totalSteps * scenario.fixedDeltaSeconds) errors.push("scenario duration must match contact simulation");
    if (scenario.id === "overlapping-active" && (!simulation.spatialOverlap || !simulation.contactOccurred)) errors.push("overlapping-active scenario requires spatial and active overlap");
    if (scenario.id === "window-miss" && (!simulation.spatialOverlap || simulation.contactOccurred)) errors.push("window-miss scenario requires spatial overlap without active overlap");
  }
}

function validateActionTimelinePayload(payload: Record<string, any>, errors: string[]): void {
  if (payload.definitionKind !== "action-timeline-profile" || payload.definitionSchemaVersion !== 1) errors.push("unsupported action timeline definition");
  const profile = validateActionTimelineDefinition(payload.profile); if (!profile.valid) errors.push(...profile.errors.map((error) => error.message));
  const scenario = payload.scenario; if (!isRecord(scenario)) { errors.push("scenario must be an object"); return; }
  if (scenario.id !== "default") errors.push("unsupported action timeline scenario");
  if (!finiteInRange(scenario.durationSeconds, Number.EPSILON, 60)) errors.push("durationSeconds must be finite and bounded");
  if (!finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1)) errors.push("fixedDeltaSeconds must be finite and bounded");
  if (profile.valid && profile.profile && scenario.durationSeconds !== profile.profile.durationSeconds) errors.push("scenario duration must match action timeline duration");
}

function validateTargetedCombatPayload(payload: Record<string, any>, errors: string[]): void {
  if (payload.targetingDefinitionKind !== "targeting-profile" || payload.targetingDefinitionSchemaVersion !== 1) errors.push("unsupported targeted combat targeting definition");
  if (payload.staminaDefinitionKind !== "stamina-profile" || payload.staminaDefinitionSchemaVersion !== 1) errors.push("unsupported targeted combat stamina definition");
  if (payload.healthDefinitionKind !== "health-profile" || payload.healthDefinitionSchemaVersion !== 1) errors.push("unsupported targeted combat health definition");
  if (payload.offensiveActionDefinitionKind !== "offensive-action-profile" || payload.offensiveActionDefinitionSchemaVersion !== 1) errors.push("unsupported targeted combat action definition");
  const targeting = validateTargetingDefinition(payload.targetingProfile); if (!targeting.valid) errors.push(...targeting.errors.map((error) => error.message));
  const stamina = validateStaminaDefinition(payload.staminaProfile); if (!stamina.valid) errors.push(...stamina.errors.map((error) => error.message));
  const health = validateHealthDefinition(payload.healthProfile); if (!health.valid) errors.push(...health.errors.map((error) => error.message));
  const action = validateOffensiveActionDefinition(payload.offensiveActionProfile); if (!action.valid) errors.push(...action.errors.map((error) => error.message));
  const scenario = payload.scenario; if (!isRecord(scenario)) { errors.push("scenario must be an object"); return; }
  if (!["target-available", "no-valid-target"].includes(String(scenario.id))) errors.push("unsupported targeted combat scenario");
  if (!finiteInRange(scenario.durationSeconds, Number.EPSILON, 60)) errors.push("durationSeconds must be finite and bounded");
  if (!finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1)) errors.push("fixedDeltaSeconds must be finite and bounded");
  if (targeting.valid && targeting.profile && stamina.valid && stamina.profile && health.valid && health.profile && action.valid && action.profile && ["target-available", "no-valid-target"].includes(String(scenario.id))) {
    const simulation = simulateTargetedCombatExchange(targeting.profile, stamina.profile, health.profile, action.profile, scenario.id);
    if (!simulation) errors.push("targeted combat action has no valid active step");
  }
}

function validateStaminaCombatPayload(payload: Record<string, any>, errors: string[]): void {
  if (payload.staminaDefinitionKind !== "stamina-profile" || payload.staminaDefinitionSchemaVersion !== 1) errors.push("unsupported stamina combat stamina definition");
  if (payload.healthDefinitionKind !== "health-profile" || payload.healthDefinitionSchemaVersion !== 1) errors.push("unsupported stamina combat health definition");
  if (payload.offensiveActionDefinitionKind !== "offensive-action-profile" || payload.offensiveActionDefinitionSchemaVersion !== 1) errors.push("unsupported stamina combat action definition");
  const stamina = validateStaminaDefinition(payload.staminaProfile); if (!stamina.valid) errors.push(...stamina.errors.map((error) => error.message));
  const health = validateHealthDefinition(payload.healthProfile); if (!health.valid) errors.push(...health.errors.map((error) => error.message));
  const action = validateOffensiveActionDefinition(payload.offensiveActionProfile); if (!action.valid) errors.push(...action.errors.map((error) => error.message));
  const scenario = payload.scenario; if (!isRecord(scenario)) { errors.push("scenario must be an object"); return; }
  if (!["accepted", "insufficient-stamina"].includes(String(scenario.id))) errors.push("unsupported stamina combat scenario");
  if (!finiteInRange(scenario.durationSeconds, Number.EPSILON, 60)) errors.push("durationSeconds must be finite and bounded");
  if (!finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1)) errors.push("fixedDeltaSeconds must be finite and bounded");
  if (stamina.valid && stamina.profile && health.valid && health.profile && action.valid && action.profile) {
    const simulation = simulateStaminaCombatExchange(stamina.profile, health.profile, action.profile);
    if (!simulation) errors.push("stamina combat action has no valid active step");
    else if (scenario.id === "accepted" && !simulation.actionAccepted) errors.push("accepted scenario requires sufficient stamina");
    else if (scenario.id === "insufficient-stamina" && simulation.actionAccepted) errors.push("insufficient-stamina scenario requires rejected action");
  }
}

function validateStaminaPayload(payload: Record<string, any>, errors: string[]): void {
  if (payload.staminaDefinitionKind !== "stamina-profile" || payload.staminaDefinitionSchemaVersion !== 1) errors.push("unsupported stamina definition");
  const stamina = validateStaminaDefinition(payload.staminaProfile); if (!stamina.valid) errors.push(...stamina.errors.map((error) => error.message));
  if (payload.actionDefinitionSchemaVersion !== 1) errors.push("unsupported stamina action schema version");
  if (payload.actionDefinitionKind === "offensive-action-profile") { const action = validateOffensiveActionDefinition(payload.actionProfile); if (!action.valid) errors.push(...action.errors.map((error) => error.message)); }
  else if (payload.actionDefinitionKind === "defensive-action-profile") { const action = validateDefensiveActionDefinition(payload.actionProfile); if (!action.valid) errors.push(...action.errors.map((error) => error.message)); }
  else errors.push("unsupported stamina action definition");
  const scenario = payload.scenario; if (!isRecord(scenario)) { errors.push("scenario must be an object"); return; }
  if (scenario.id !== "action-cost") errors.push("unsupported stamina scenario");
  if (!finiteInRange(scenario.durationSeconds, Number.EPSILON, 60)) errors.push("durationSeconds must be finite and bounded");
  if (!finiteInRange(scenario.fixedDeltaSeconds, Number.EPSILON, 1)) errors.push("fixedDeltaSeconds must be finite and bounded");
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
