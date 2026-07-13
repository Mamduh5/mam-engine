class_name RuntimeProtocol
extends RefCounted

const MovementProfileRuntime = preload("res://scripts/movement_profile.gd")
const CameraProfileRuntime = preload("res://scripts/camera_profile.gd")
const TargetingProfileRuntime = preload("res://scripts/targeting_profile.gd")
const DefensiveActionProfileRuntime = preload("res://scripts/defensive_action_profile.gd")
const OffensiveActionProfileRuntime = preload("res://scripts/offensive_action_profile.gd")
const HealthProfileRuntime = preload("res://scripts/health_profile.gd")
const StaminaProfileRuntime = preload("res://scripts/stamina_profile.gd")
const OffensiveActionFixtureRuntime = preload("res://scripts/offensive_action_fixture.gd")
const StaminaFixtureRuntime = preload("res://scripts/stamina_fixture.gd")
const ContactVolumeProfileRuntime = preload("res://scripts/contact_volume_profile.gd")
const DamageReactionProfileRuntime = preload("res://scripts/damage_reaction_profile.gd")
const WeaponProfileRuntime = preload("res://scripts/weapon_profile.gd")
const LargeEnemyProfileRuntime = preload("res://scripts/large_enemy_profile.gd")
const SCHEMA_VERSION := "mam.runtime/v1"
const COMMAND_ID := "runtime.fixture.run"
const MOVEMENT_FIXTURE_ID := "movement/basic-ground"
const CAMERA_FIXTURE_ID := "camera/basic-third-person"
const TARGETING_FIXTURE_ID := "targeting/basic-lock-on"
const DEFENSIVE_ACTION_FIXTURE_ID := "defensive-action/basic-dodge"
const OFFENSIVE_ACTION_FIXTURE_ID := "offensive-action/basic-light-attack"
const HEALTH_FIXTURE_ID := "health/basic-confirmed-hit"
const COMBAT_FIXTURE_ID := "combat/basic-exchange"
const STAMINA_FIXTURE_ID := "stamina/basic-action-cost"
const STAMINA_COMBAT_FIXTURE_ID := "combat/stamina-gated-exchange"
const TARGETED_COMBAT_FIXTURE_ID := "combat/targeted-stamina-exchange"
const ACTION_TIMELINE_FIXTURE_ID := "action-timeline/basic-animation-events"
const CONTACT_VOLUME_FIXTURE_ID := "contact-volume/basic-sphere-overlap"
const DAMAGE_REACTION_FIXTURE_ID := "damage-reaction/basic-resolution"
const WEAPON_FIXTURE_ID := "weapon/training-strike"
const LARGE_ENEMY_FIXTURE_ID := "large-enemy/training-behemoth"
const ENCOUNTER_FIXTURE_ID := "encounter/training-hunt"
const MOVEMENT_SCENARIOS := ["accelerate", "stop", "sprint", "dodge", "turn"]
const CAMERA_SCENARIOS := ["orbit", "pitch-clamp", "recenter", "follow", "collision", "basis"]
const TARGETING_SCENARIOS := ["acquire", "eligibility", "tie-break", "retention", "loss", "reacquire", "switch-left", "switch-right", "switch-cooldown", "framing-acquire", "framing-switch", "framing-loss", "framing-reacquire"]

static func validate_request(request: Variant) -> Array[String]:
	var errors: Array[String] = []
	if typeof(request) != TYPE_DICTIONARY: return ["request must be an object"]
	if request.get("schemaVersion") != SCHEMA_VERSION: errors.append("unsupported protocol version")
	if request.get("commandId") != COMMAND_ID: errors.append("unknown command ID")
	var fixture_id: Variant = request.get("fixtureId")
	if not [MOVEMENT_FIXTURE_ID, CAMERA_FIXTURE_ID, TARGETING_FIXTURE_ID, DEFENSIVE_ACTION_FIXTURE_ID, OFFENSIVE_ACTION_FIXTURE_ID, HEALTH_FIXTURE_ID, COMBAT_FIXTURE_ID, STAMINA_FIXTURE_ID, STAMINA_COMBAT_FIXTURE_ID, TARGETED_COMBAT_FIXTURE_ID, ACTION_TIMELINE_FIXTURE_ID, CONTACT_VOLUME_FIXTURE_ID, DAMAGE_REACTION_FIXTURE_ID, WEAPON_FIXTURE_ID, LARGE_ENEMY_FIXTURE_ID, ENCOUNTER_FIXTURE_ID].has(fixture_id): errors.append("unknown fixture ID")
	if typeof(request.get("correlationId")) != TYPE_STRING or request.get("correlationId").is_empty(): errors.append("missing correlation ID")
	if not _finite_number(request.get("timeoutMs")) or float(request.get("timeoutMs", 0)) <= 0.0 or float(request.get("timeoutMs", 0)) > 60000.0: errors.append("invalid timeout")
	var payload: Variant = request.get("payload")
	if typeof(payload) != TYPE_DICTIONARY: return errors + ["payload must be an object"]
	var scenario: Variant = payload.get("scenario")
	if typeof(scenario) != TYPE_DICTIONARY: return errors + ["scenario must be an object"]
	if fixture_id == MOVEMENT_FIXTURE_ID:
		if payload.has("definitionKind") and payload.get("definitionKind") != "movement-profile": errors.append("unsupported definition kind")
		if payload.get("definitionSchemaVersion") != 1: errors.append("unsupported movement schema version")
		errors.append_array(MovementProfileRuntime.validate(payload.get("profile")))
		if not MOVEMENT_SCENARIOS.has(scenario.get("id")): errors.append("unsupported scenario")
		if not _finite_number(scenario.get("cameraYawDegrees")): errors.append("invalid camera yaw")
	elif fixture_id == CAMERA_FIXTURE_ID:
		if payload.get("definitionKind") != "camera-profile": errors.append("unsupported definition kind")
		if payload.get("definitionSchemaVersion") != 1: errors.append("unsupported camera schema version")
		errors.append_array(CameraProfileRuntime.validate(payload.get("profile")))
		if not CAMERA_SCENARIOS.has(scenario.get("id")): errors.append("unsupported camera scenario")
	elif fixture_id == DEFENSIVE_ACTION_FIXTURE_ID:
		if payload.get("definitionKind") != "defensive-action-profile" or payload.get("definitionSchemaVersion") != 1: errors.append("unsupported defensive action definition")
		errors.append_array(DefensiveActionProfileRuntime.validate(payload.get("profile")))
		if scenario.get("id") != "default": errors.append("unsupported defensive action scenario")
	elif fixture_id == OFFENSIVE_ACTION_FIXTURE_ID:
		if payload.get("definitionKind") != "offensive-action-profile" or payload.get("definitionSchemaVersion") != 1: errors.append("unsupported offensive action definition")
		errors.append_array(OffensiveActionProfileRuntime.validate(payload.get("profile")))
		if scenario.get("id") != "default": errors.append("unsupported offensive action scenario")
	elif fixture_id == HEALTH_FIXTURE_ID:
		if payload.get("definitionKind") != "health-profile" or payload.get("definitionSchemaVersion") != 1: errors.append("unsupported health definition")
		if payload.get("offensiveActionDefinitionKind") != "offensive-action-profile" or payload.get("offensiveActionDefinitionSchemaVersion") != 1: errors.append("unsupported health offensive action definition")
		errors.append_array(HealthProfileRuntime.validate(payload.get("profile"))); errors.append_array(OffensiveActionProfileRuntime.validate(payload.get("offensiveActionProfile")))
		if scenario.get("id") != "confirmed-hit": errors.append("unsupported health scenario")
	elif fixture_id == COMBAT_FIXTURE_ID:
		if payload.get("healthDefinitionKind") != "health-profile" or payload.get("healthDefinitionSchemaVersion") != 1: errors.append("unsupported combat health definition")
		if payload.get("offensiveActionDefinitionKind") != "offensive-action-profile" or payload.get("offensiveActionDefinitionSchemaVersion") != 1: errors.append("unsupported combat offensive action definition")
		errors.append_array(HealthProfileRuntime.validate(payload.get("healthProfile")))
		var action_errors := OffensiveActionProfileRuntime.validate(payload.get("offensiveActionProfile")); errors.append_array(action_errors)
		if scenario.get("id") != "default": errors.append("unsupported combat scenario")
		if action_errors.is_empty() and _finite_number(scenario.get("fixedDeltaSeconds")) and float(scenario.fixedDeltaSeconds) > 0.0:
			var start_step := OffensiveActionFixtureRuntime.active_start_step(payload.offensiveActionProfile, float(scenario.fixedDeltaSeconds))
			var end_step := OffensiveActionFixtureRuntime.active_end_step(payload.offensiveActionProfile, float(scenario.fixedDeltaSeconds))
			var total_steps := OffensiveActionFixtureRuntime.lifecycle_steps(payload.offensiveActionProfile, float(scenario.fixedDeltaSeconds))
			if start_step > end_step or start_step > total_steps: errors.append("combat active window has no valid step")
	elif fixture_id == STAMINA_FIXTURE_ID:
		if payload.get("staminaDefinitionKind") != "stamina-profile" or payload.get("staminaDefinitionSchemaVersion") != 1: errors.append("unsupported stamina definition")
		errors.append_array(StaminaProfileRuntime.validate(payload.get("staminaProfile")))
		if payload.get("actionDefinitionSchemaVersion") != 1: errors.append("unsupported stamina action schema version")
		if payload.get("actionDefinitionKind") == "offensive-action-profile": errors.append_array(OffensiveActionProfileRuntime.validate(payload.get("actionProfile")))
		elif payload.get("actionDefinitionKind") == "defensive-action-profile": errors.append_array(DefensiveActionProfileRuntime.validate(payload.get("actionProfile")))
		else: errors.append("unsupported stamina action definition")
		if scenario.get("id") != "action-cost": errors.append("unsupported stamina scenario")
	elif fixture_id == STAMINA_COMBAT_FIXTURE_ID:
		if payload.get("staminaDefinitionKind") != "stamina-profile" or payload.get("staminaDefinitionSchemaVersion") != 1: errors.append("unsupported stamina combat stamina definition")
		if payload.get("healthDefinitionKind") != "health-profile" or payload.get("healthDefinitionSchemaVersion") != 1: errors.append("unsupported stamina combat health definition")
		if payload.get("offensiveActionDefinitionKind") != "offensive-action-profile" or payload.get("offensiveActionDefinitionSchemaVersion") != 1: errors.append("unsupported stamina combat action definition")
		var stamina_errors := StaminaProfileRuntime.validate(payload.get("staminaProfile")); errors.append_array(stamina_errors)
		errors.append_array(HealthProfileRuntime.validate(payload.get("healthProfile")))
		var action_errors := OffensiveActionProfileRuntime.validate(payload.get("offensiveActionProfile")); errors.append_array(action_errors)
		if not ["accepted", "insufficient-stamina"].has(scenario.get("id")): errors.append("unsupported stamina combat scenario")
		if stamina_errors.is_empty() and action_errors.is_empty():
			var stamina_result := StaminaFixtureRuntime.evaluate(payload.staminaProfile, payload.offensiveActionProfile)
			if scenario.get("id") == "accepted" and not stamina_result.actionAccepted: errors.append("accepted scenario requires sufficient stamina")
			elif scenario.get("id") == "insufficient-stamina" and stamina_result.actionAccepted: errors.append("insufficient-stamina scenario requires rejected action")
			elif stamina_result.actionAccepted and _finite_number(scenario.get("fixedDeltaSeconds")) and float(scenario.fixedDeltaSeconds) > 0.0:
				var start_step := OffensiveActionFixtureRuntime.active_start_step(payload.offensiveActionProfile, float(scenario.fixedDeltaSeconds))
				var end_step := OffensiveActionFixtureRuntime.active_end_step(payload.offensiveActionProfile, float(scenario.fixedDeltaSeconds))
				var total_steps := OffensiveActionFixtureRuntime.lifecycle_steps(payload.offensiveActionProfile, float(scenario.fixedDeltaSeconds))
				if start_step > end_step or start_step > total_steps: errors.append("stamina combat action has no valid active step")
	elif fixture_id == TARGETED_COMBAT_FIXTURE_ID:
		if payload.get("targetingDefinitionKind") != "targeting-profile" or payload.get("targetingDefinitionSchemaVersion") != 1: errors.append("unsupported targeted combat targeting definition")
		if payload.get("staminaDefinitionKind") != "stamina-profile" or payload.get("staminaDefinitionSchemaVersion") != 1: errors.append("unsupported targeted combat stamina definition")
		if payload.get("healthDefinitionKind") != "health-profile" or payload.get("healthDefinitionSchemaVersion") != 1: errors.append("unsupported targeted combat health definition")
		if payload.get("offensiveActionDefinitionKind") != "offensive-action-profile" or payload.get("offensiveActionDefinitionSchemaVersion") != 1: errors.append("unsupported targeted combat action definition")
		errors.append_array(TargetingProfileRuntime.validate(payload.get("targetingProfile")))
		errors.append_array(StaminaProfileRuntime.validate(payload.get("staminaProfile")))
		errors.append_array(HealthProfileRuntime.validate(payload.get("healthProfile")))
		var action_errors := OffensiveActionProfileRuntime.validate(payload.get("offensiveActionProfile")); errors.append_array(action_errors)
		if not ["target-available", "no-valid-target"].has(scenario.get("id")): errors.append("unsupported targeted combat scenario")
		if action_errors.is_empty() and _finite_number(scenario.get("fixedDeltaSeconds")) and float(scenario.fixedDeltaSeconds) > 0.0:
			var start_step := OffensiveActionFixtureRuntime.active_start_step(payload.offensiveActionProfile, float(scenario.fixedDeltaSeconds))
			var end_step := OffensiveActionFixtureRuntime.active_end_step(payload.offensiveActionProfile, float(scenario.fixedDeltaSeconds))
			var total_steps := OffensiveActionFixtureRuntime.lifecycle_steps(payload.offensiveActionProfile, float(scenario.fixedDeltaSeconds))
			if start_step > end_step or start_step > total_steps: errors.append("targeted combat action has no valid active step")
	elif fixture_id == ACTION_TIMELINE_FIXTURE_ID:
		if payload.get("definitionKind") != "action-timeline-profile" or payload.get("definitionSchemaVersion") != 1: errors.append("unsupported action timeline definition")
		var timeline_profile: Variant = payload.get("profile")
		if typeof(timeline_profile) != TYPE_DICTIONARY: errors.append("action timeline profile must be an object")
		elif typeof(timeline_profile.get("events")) != TYPE_ARRAY: errors.append("action timeline events must be an array")
		if scenario.get("id") != "default": errors.append("unsupported action timeline scenario")
		if typeof(timeline_profile) == TYPE_DICTIONARY and _finite_number(timeline_profile.get("durationSeconds")) and scenario.get("durationSeconds") != timeline_profile.get("durationSeconds"): errors.append("scenario duration must match action timeline duration")
	elif fixture_id == CONTACT_VOLUME_FIXTURE_ID:
		if payload.get("hitboxDefinitionKind") != "contact-volume-profile" or payload.get("hitboxDefinitionSchemaVersion") != 1: errors.append("unsupported contact volume hitbox definition")
		if payload.get("hurtboxDefinitionKind") != "contact-volume-profile" or payload.get("hurtboxDefinitionSchemaVersion") != 1: errors.append("unsupported contact volume hurtbox definition")
		var hitbox_errors: Array[String] = ContactVolumeProfileRuntime.validate(payload.get("hitboxProfile")); errors.append_array(hitbox_errors)
		var hurtbox_errors: Array[String] = ContactVolumeProfileRuntime.validate(payload.get("hurtboxProfile")); errors.append_array(hurtbox_errors)
		if hitbox_errors.is_empty() and payload.hitboxProfile.get("role") != "hitbox": errors.append("contact volume first profile must be a hitbox")
		if hurtbox_errors.is_empty() and payload.hurtboxProfile.get("role") != "hurtbox": errors.append("contact volume second profile must be a hurtbox")
		if not ["overlapping-active", "window-miss"].has(scenario.get("id")): errors.append("unsupported contact volume scenario")
	elif fixture_id == DAMAGE_REACTION_FIXTURE_ID:
		if payload.get("reactionDefinitionKind") != "damage-reaction-profile" or payload.get("reactionDefinitionSchemaVersion") != 1: errors.append("unsupported damage reaction definition")
		if payload.get("healthDefinitionKind") != "health-profile" or payload.get("healthDefinitionSchemaVersion") != 1: errors.append("unsupported damage reaction health definition")
		if payload.get("offensiveActionDefinitionKind") != "offensive-action-profile" or payload.get("offensiveActionDefinitionSchemaVersion") != 1: errors.append("unsupported damage reaction offensive action definition")
		errors.append_array(DamageReactionProfileRuntime.validate(payload.get("reactionProfile")))
		errors.append_array(HealthProfileRuntime.validate(payload.get("healthProfile")))
		errors.append_array(OffensiveActionProfileRuntime.validate(payload.get("offensiveActionProfile")))
		if not ["hit-continues", "stagger-interrupts", "defeat-interrupts"].has(scenario.get("id")): errors.append("unsupported damage reaction scenario")
		if scenario.get("targetActionWasActive") != true: errors.append("damage reaction scenario requires an active target action")
	elif fixture_id == WEAPON_FIXTURE_ID:
		if payload.get("weaponDefinitionKind") != "weapon-profile" or payload.get("weaponDefinitionSchemaVersion") != 1: errors.append("unsupported weapon definition")
		if payload.get("offensiveActionDefinitionKind") != "offensive-action-profile" or payload.get("offensiveActionDefinitionSchemaVersion") != 1: errors.append("unsupported weapon offensive action definition")
		if payload.get("actionTimelineDefinitionKind") != "action-timeline-profile" or payload.get("actionTimelineDefinitionSchemaVersion") != 1: errors.append("unsupported weapon action timeline definition")
		if payload.get("hitboxDefinitionKind") != "contact-volume-profile" or payload.get("hitboxDefinitionSchemaVersion") != 1: errors.append("unsupported weapon hitbox definition")
		if payload.get("staminaDefinitionKind") != "stamina-profile" or payload.get("staminaDefinitionSchemaVersion") != 1: errors.append("unsupported weapon stamina definition")
		if payload.get("healthDefinitionKind") != "health-profile" or payload.get("healthDefinitionSchemaVersion") != 1: errors.append("unsupported weapon health definition")
		if payload.get("hurtboxDefinitionKind") != "contact-volume-profile" or payload.get("hurtboxDefinitionSchemaVersion") != 1: errors.append("unsupported weapon hurtbox definition")
		if payload.get("reactionDefinitionKind") != "damage-reaction-profile" or payload.get("reactionDefinitionSchemaVersion") != 1: errors.append("unsupported weapon reaction definition")
		var weapon_errors: Array[String] = WeaponProfileRuntime.validate(payload.get("weaponProfile")); errors.append_array(weapon_errors)
		var weapon_action_errors: Array[String] = OffensiveActionProfileRuntime.validate(payload.get("offensiveActionProfile")); errors.append_array(weapon_action_errors)
		var weapon_timeline_errors: Array[String] = WeaponProfileRuntime.validate_timeline(payload.get("actionTimelineProfile")); errors.append_array(weapon_timeline_errors)
		var weapon_hitbox_errors: Array[String] = ContactVolumeProfileRuntime.validate(payload.get("hitboxProfile")); errors.append_array(weapon_hitbox_errors)
		var weapon_stamina_errors: Array[String] = StaminaProfileRuntime.validate(payload.get("staminaProfile")); errors.append_array(weapon_stamina_errors)
		var weapon_health_errors: Array[String] = HealthProfileRuntime.validate(payload.get("healthProfile")); errors.append_array(weapon_health_errors)
		var weapon_hurtbox_errors: Array[String] = ContactVolumeProfileRuntime.validate(payload.get("hurtboxProfile")); errors.append_array(weapon_hurtbox_errors)
		var weapon_reaction_errors: Array[String] = DamageReactionProfileRuntime.validate(payload.get("reactionProfile")); errors.append_array(weapon_reaction_errors)
		if weapon_hurtbox_errors.is_empty() and payload.hurtboxProfile.get("role") != "hurtbox": errors.append("weapon target contact volume must be a hurtbox")
		if weapon_errors.is_empty() and weapon_action_errors.is_empty() and weapon_timeline_errors.is_empty() and weapon_hitbox_errors.is_empty(): errors.append_array(WeaponProfileRuntime.validate_references(payload.weaponProfile, payload.offensiveActionProfile, payload.actionTimelineProfile, payload.hitboxProfile, payload.get("resolvedDefinitionPaths")))
		if not ["successful-strike", "insufficient-stamina"].has(scenario.get("id")): errors.append("unsupported weapon scenario")
		if scenario.get("targetActionWasActive") != true: errors.append("weapon scenario requires an active target action")
		if weapon_stamina_errors.is_empty() and weapon_action_errors.is_empty():
			var weapon_stamina_result: Dictionary = StaminaFixtureRuntime.evaluate(payload.staminaProfile, payload.offensiveActionProfile)
			if scenario.get("id") == "successful-strike" and not bool(weapon_stamina_result.actionAccepted): errors.append("successful weapon strike requires sufficient stamina")
			if scenario.get("id") == "insufficient-stamina" and bool(weapon_stamina_result.actionAccepted): errors.append("insufficient weapon strike requires rejected stamina")
	elif fixture_id == LARGE_ENEMY_FIXTURE_ID:
		if payload.get("largeEnemyDefinitionKind") != "large-enemy-profile" or payload.get("largeEnemyDefinitionSchemaVersion") != 1: errors.append("unsupported large-enemy definition")
		if payload.get("healthDefinitionKind") != "health-profile" or payload.get("healthDefinitionSchemaVersion") != 1: errors.append("unsupported large-enemy health definition")
		if payload.get("reactionDefinitionKind") != "damage-reaction-profile" or payload.get("reactionDefinitionSchemaVersion") != 1: errors.append("unsupported large-enemy reaction definition")
		if payload.get("hurtboxDefinitionKind") != "contact-volume-profile" or payload.get("hurtboxDefinitionSchemaVersion") != 1: errors.append("unsupported large-enemy hurtbox definition")
		var enemy_errors: Array[String] = LargeEnemyProfileRuntime.validate(payload.get("largeEnemyProfile")); errors.append_array(enemy_errors)
		errors.append_array(HealthProfileRuntime.validate(payload.get("healthProfile"))); errors.append_array(DamageReactionProfileRuntime.validate(payload.get("reactionProfile")))
		if enemy_errors.is_empty(): errors.append_array(LargeEnemyProfileRuntime.validate_references(payload.largeEnemyProfile, payload.get("resolvedDefinitionPaths"), payload.get("hurtboxProfiles")))
		if not ["full-cycle", "primary-part-disabled"].has(scenario.get("id")): errors.append("unsupported large-enemy scenario")
		if enemy_errors.is_empty() and scenario.get("id") == "primary-part-disabled":
			var targetable_count: int = 0
			for part: Dictionary in payload.largeEnemyProfile.bodyParts:
				if bool(part.targetable): targetable_count += 1
			if targetable_count < 2: errors.append("primary-part-disabled requires another targetable body part")
	elif fixture_id == ENCOUNTER_FIXTURE_ID:
		errors.append_array(_validate_encounter_payload(payload, scenario))
	else:
		if payload.get("definitionKind") != "targeting-profile" or payload.get("definitionSchemaVersion") != 1: errors.append("unsupported targeting definition")
		if payload.get("cameraDefinitionKind") != "camera-profile" or payload.get("cameraDefinitionSchemaVersion") != 1: errors.append("unsupported targeting camera definition")
		errors.append_array(TargetingProfileRuntime.validate(payload.get("profile"))); errors.append_array(CameraProfileRuntime.validate(payload.get("cameraProfile")))
		if not TARGETING_SCENARIOS.has(scenario.get("id")): errors.append("unsupported targeting scenario")
		errors.append_array(_validate_targeting_plan(scenario))
	if not _finite_number(scenario.get("durationSeconds")) or float(scenario.get("durationSeconds", 0)) < 0.0: errors.append("invalid scenario duration")
	if not _finite_number(scenario.get("fixedDeltaSeconds")) or float(scenario.get("fixedDeltaSeconds", 0)) <= 0.0 or float(scenario.get("fixedDeltaSeconds", 0)) > 1.0: errors.append("invalid fixed timestep")
	if fixture_id == MOVEMENT_FIXTURE_ID and abs(float(scenario.get("fixedDeltaSeconds", 0)) - (1.0 / 60.0)) > 0.000000001: errors.append("invalid fixed timestep")
	return errors

static func _validate_encounter_payload(payload: Dictionary, scenario: Dictionary) -> Array[String]:
	var errors: Array[String] = []
	if payload.get("encounterDefinitionKind") != "encounter-profile" or payload.get("encounterDefinitionSchemaVersion") != 1: errors.append("unsupported encounter definition")
	if payload.get("hunterDefinitionKind") != "hunter-profile" or payload.get("hunterDefinitionSchemaVersion") != 1: errors.append("unsupported encounter hunter definition")
	if payload.get("hunterHealthDefinitionKind") != "health-profile" or payload.get("hunterHealthDefinitionSchemaVersion") != 1: errors.append("unsupported encounter hunter health definition")
	if payload.get("staminaDefinitionKind") != "stamina-profile" or payload.get("staminaDefinitionSchemaVersion") != 1: errors.append("unsupported encounter stamina definition")
	if payload.get("weaponDefinitionKind") != "weapon-profile" or payload.get("weaponDefinitionSchemaVersion") != 1: errors.append("unsupported encounter weapon definition")
	if payload.get("offensiveActionDefinitionKind") != "offensive-action-profile" or payload.get("offensiveActionDefinitionSchemaVersion") != 1: errors.append("unsupported encounter action definition")
	if payload.get("actionTimelineDefinitionKind") != "action-timeline-profile" or payload.get("actionTimelineDefinitionSchemaVersion") != 1: errors.append("unsupported encounter timeline definition")
	if payload.get("hitboxDefinitionKind") != "contact-volume-profile" or payload.get("hitboxDefinitionSchemaVersion") != 1: errors.append("unsupported encounter hitbox definition")
	if payload.get("enemyDefinitionKind") != "large-enemy-profile" or payload.get("enemyDefinitionSchemaVersion") != 1: errors.append("unsupported encounter enemy definition")
	if payload.get("enemyHealthDefinitionKind") != "health-profile" or payload.get("enemyHealthDefinitionSchemaVersion") != 1: errors.append("unsupported encounter enemy health definition")
	if payload.get("reactionDefinitionKind") != "damage-reaction-profile" or payload.get("reactionDefinitionSchemaVersion") != 1: errors.append("unsupported encounter reaction definition")
	if payload.get("hurtboxDefinitionKind") != "contact-volume-profile" or payload.get("hurtboxDefinitionSchemaVersion") != 1: errors.append("unsupported encounter hurtbox definitions")
	if payload.get("arenaDefinitionKind") != "arena-profile" or payload.get("arenaDefinitionSchemaVersion") != 1: errors.append("unsupported encounter arena definition")
	var encounter: Variant = payload.get("encounterProfile"); var hunter: Variant = payload.get("hunterProfile"); var arena: Variant = payload.get("arenaProfile")
	if typeof(encounter) != TYPE_DICTIONARY or encounter.get("schemaVersion") != 1 or encounter.get("kind") != "encounter-profile" or not _finite_number(encounter.get("maxRounds")) or int(encounter.get("maxRounds", 0)) < 1 or float(encounter.get("maxRounds", 0)) != int(encounter.get("maxRounds", 0)): errors.append("invalid encounter profile")
	if typeof(hunter) != TYPE_DICTIONARY or hunter.get("schemaVersion") != 1 or hunter.get("kind") != "hunter-profile": errors.append("invalid encounter hunter profile")
	if typeof(arena) != TYPE_DICTIONARY or arena.get("schemaVersion") != 1 or arena.get("kind") != "arena-profile" or not _finite_number(arena.get("radius")) or float(arena.get("radius", 0)) <= 0.0 or not _valid_vector(arena.get("playerSpawn")) or not _valid_vector(arena.get("enemySpawn")): errors.append("invalid encounter arena profile")
	errors.append_array(HealthProfileRuntime.validate(payload.get("hunterHealthProfile"))); errors.append_array(StaminaProfileRuntime.validate(payload.get("staminaProfile")))
	var weapon_errors: Array[String] = WeaponProfileRuntime.validate(payload.get("weaponProfile")); errors.append_array(weapon_errors)
	var action_errors: Array[String] = OffensiveActionProfileRuntime.validate(payload.get("offensiveActionProfile")); errors.append_array(action_errors)
	var timeline_errors: Array[String] = WeaponProfileRuntime.validate_timeline(payload.get("actionTimelineProfile")); errors.append_array(timeline_errors)
	var hitbox_errors: Array[String] = ContactVolumeProfileRuntime.validate(payload.get("hitboxProfile")); errors.append_array(hitbox_errors)
	var enemy_errors: Array[String] = LargeEnemyProfileRuntime.validate(payload.get("enemyProfile")); errors.append_array(enemy_errors)
	errors.append_array(HealthProfileRuntime.validate(payload.get("enemyHealthProfile"))); errors.append_array(DamageReactionProfileRuntime.validate(payload.get("reactionProfile")))
	var hurtboxes: Variant = payload.get("hurtboxProfiles"); if typeof(hurtboxes) != TYPE_ARRAY: errors.append("encounter hurtboxes must be an array")
	else:
		for hurtbox: Variant in hurtboxes: errors.append_array(ContactVolumeProfileRuntime.validate(hurtbox))
	var selected_hurtbox_errors: Array[String] = ContactVolumeProfileRuntime.validate(payload.get("selectedHurtboxProfile")); errors.append_array(selected_hurtbox_errors)
	if hitbox_errors.is_empty() and payload.hitboxProfile.get("role") != "hitbox": errors.append("encounter weapon volume must be a hitbox")
	if selected_hurtbox_errors.is_empty() and payload.selectedHurtboxProfile.get("role") != "hurtbox": errors.append("encounter selected volume must be a hurtbox")
	if weapon_errors.is_empty() and action_errors.is_empty() and timeline_errors.is_empty() and hitbox_errors.is_empty(): errors.append_array(WeaponProfileRuntime.validate_references(payload.weaponProfile, payload.offensiveActionProfile, payload.actionTimelineProfile, payload.hitboxProfile, payload.get("weaponResolvedDefinitionPaths")))
	if enemy_errors.is_empty(): errors.append_array(LargeEnemyProfileRuntime.validate_references(payload.enemyProfile, payload.get("enemyResolvedDefinitionPaths"), hurtboxes))
	var selected_id: String = ""
	if enemy_errors.is_empty():
		for part: Dictionary in payload.enemyProfile.bodyParts:
			if bool(part.targetable): selected_id = str(part.id); break
	if selected_id.is_empty() or selected_id != str(payload.get("selectedBodyPartId", "")): errors.append("encounter selected body part must be first targetable")
	if not ["successful-hunt", "stamina-exhausted"].has(scenario.get("id")): errors.append("unsupported encounter scenario")
	if not _finite_number(scenario.get("startingStamina")) or float(scenario.get("startingStamina", -1)) < 0.0: errors.append("invalid encounter starting stamina")
	var mode: String = str(scenario.get("mode", "runtime"))
	if not ["runtime", "interactive", "recovery-initial", "recovery-resume"].has(mode): errors.append("unsupported encounter runtime mode")
	if mode == "interactive" and scenario.get("autoDrive") != true: errors.append("interactive encounter requires input driving")
	if mode != "runtime":
		var checkpoint_path: String = str(scenario.get("checkpointPath", ""))
		if not checkpoint_path.contains(".mam-engine") or not checkpoint_path.contains("runtime-sessions") or not checkpoint_path.ends_with("encounter-checkpoint.json") or checkpoint_path.contains(".."): errors.append("invalid encounter checkpoint path")
	if mode == "recovery-initial" and (not _finite_number(scenario.get("interruptAfterRound")) or int(scenario.get("interruptAfterRound", 0)) < 1 or (typeof(encounter) == TYPE_DICTIONARY and int(scenario.get("interruptAfterRound", 0)) >= int(encounter.get("maxRounds", 0)))): errors.append("invalid recovery interruption round")
	if mode == "recovery-resume": errors.append_array(_validate_encounter_checkpoint(scenario.get("recoveryCheckpoint"), payload, scenario))
	return errors

static func _validate_encounter_checkpoint(value: Variant, payload: Dictionary, scenario: Dictionary) -> Array[String]:
	var errors: Array[String] = []
	if typeof(value) != TYPE_DICTIONARY: return ["recovery checkpoint must be an object"]
	if value.get("schemaVersion") != "mam.encounter-checkpoint/v1": errors.append("unsupported checkpoint schema version")
	if value.get("encounterId") != payload.encounterProfile.get("id"): errors.append("checkpoint encounter ID mismatch")
	if value.get("scenarioId") != scenario.get("id"): errors.append("checkpoint scenario ID mismatch")
	if value.get("selectedBodyPartId") != payload.get("selectedBodyPartId"): errors.append("checkpoint selected body part mismatch")
	var rounds: int = int(value.get("roundsCompleted", -1)); var next_round: int = int(value.get("nextRoundNumber", -1))
	if rounds < 1 or next_round != rounds + 1 or next_round > int(payload.encounterProfile.maxRounds): errors.append("checkpoint round boundary is invalid")
	if int(value.get("enemyBehaviorCyclesCompleted", -1)) != rounds or int(value.get("strikeCount", -1)) != rounds: errors.append("checkpoint counters are inconsistent")
	if typeof(value.get("roundSummaries")) != TYPE_ARRAY or value.roundSummaries.size() != rounds: errors.append("checkpoint summaries are inconsistent")
	if not _finite_number(value.get("currentHunterStamina")) or float(value.get("currentHunterStamina", -1)) < 0.0 or float(value.get("currentHunterStamina", 0)) > float(payload.staminaProfile.maxStamina): errors.append("checkpoint stamina is invalid")
	if not _finite_number(value.get("currentEnemyHealth")) or float(value.get("currentEnemyHealth", -1)) < 0.0 or float(value.get("currentEnemyHealth", 0)) > float(payload.enemyHealthProfile.maxHealth): errors.append("checkpoint enemy health is invalid")
	if value.get("encounterState") != "in-progress": errors.append("checkpoint is not resumable")
	return errors

static func _validate_targeting_plan(plan: Dictionary) -> Array[String]:
	var errors: Array[String] = []
	var allowed_plan := ["id", "durationSeconds", "fixedDeltaSeconds", "origin", "viewForward", "initialTargetId", "initialSwitchCooldownSeconds", "candidates", "events"]
	for key in plan:
		if not allowed_plan.has(key): errors.append("unsupported targeting plan field")
	for field in ["origin", "viewForward"]:
		var vector: Variant = plan.get(field)
		if not _valid_vector(vector): errors.append("invalid targeting " + field)
	if _valid_vector(plan.get("viewForward")) and Vector3(float(plan.viewForward.x), float(plan.viewForward.y), float(plan.viewForward.z)).length() <= 0.000000000001: errors.append("zero targeting view forward")
	if not _finite_number(plan.get("initialSwitchCooldownSeconds")) or float(plan.get("initialSwitchCooldownSeconds", -1)) < 0.0: errors.append("invalid targeting cooldown")
	if typeof(plan.get("candidates")) != TYPE_ARRAY or typeof(plan.get("events")) != TYPE_ARRAY: return errors + ["invalid targeting plan collections"]
	var ids := {}
	for candidate in plan.candidates:
		if typeof(candidate) != TYPE_DICTIONARY or typeof(candidate.get("id")) != TYPE_STRING or candidate.get("id").is_empty() or ids.has(candidate.get("id")): errors.append("invalid targeting candidate ID"); continue
		ids[candidate.id] = true
		for key in candidate:
			if not ["id", "targetPoint", "targetable", "priority", "obstruction"].has(key): errors.append("unsupported targeting candidate field")
		if not _valid_vector(candidate.get("targetPoint")) or typeof(candidate.get("targetable")) != TYPE_BOOL or not _finite_number(candidate.get("priority")) or float(candidate.get("priority", -1)) < 0.0 or float(candidate.get("priority", 2)) > 1.0 or not ["none", "controlled-wall"].has(candidate.get("obstruction")): errors.append("invalid targeting candidate")
		if _same_point(candidate.get("targetPoint"), plan.get("origin")) and not (plan.get("id") == "eligibility" and candidate.get("id") == "overlap"): errors.append("invalid targeting candidate direction")
	if plan.get("initialTargetId") != null and not ids.has(plan.get("initialTargetId")): errors.append("invalid initial target")
	var steps := ceili(float(plan.get("durationSeconds", 0)) / float(plan.get("fixedDeltaSeconds", 1)) - 0.000000000001) if _finite_number(plan.get("durationSeconds")) and _finite_number(plan.get("fixedDeltaSeconds")) and float(plan.get("fixedDeltaSeconds")) > 0.0 else 0
	var event_keys := {}
	for event in plan.events:
		if typeof(event) != TYPE_DICTIONARY or not _finite_number(event.get("step")) or int(event.get("step", 0)) < 1 or int(event.get("step", 0)) > steps or absf(float(event.get("step", 0)) - int(event.get("step", 0))) > 0.0 or not ["request-acquire", "set-obstruction", "set-targetable", "move-target", "request-switch"].has(event.get("type")): errors.append("invalid targeting event"); continue
		if ["set-obstruction", "set-targetable", "move-target"].has(event.type) and not ids.has(event.get("targetId")): errors.append("invalid targeting event target")
		var event_type := str(event.get("type", ""))
		var allowed: Array = ["step", "type"]

		if event.type == "set-obstruction":
			allowed += ["targetId", "obstruction"]
			if not ["none", "controlled-wall"].has(event.get("obstruction")):
				errors.append("invalid obstruction event")

		elif event.type == "set-targetable":
			allowed += ["targetId", "targetable"]
			if typeof(event.get("targetable")) != TYPE_BOOL:
				errors.append("invalid targetable event")

		elif event.type == "move-target":
			allowed += ["targetId", "targetPoint"]
			if not _valid_vector(event.get("targetPoint")) or _same_point(event.get("targetPoint"), plan.get("origin")):
				errors.append("invalid move event")

		elif event.type == "request-switch":
			allowed += ["direction"]
			if not ["left", "right"].has(event.get("direction")):
				errors.append("invalid switch event")

		for key in event:
			if not allowed.has(key):
				errors.append("unsupported targeting event field: " + str(key))
		var event_key := "%s:%s:%s" % [event.step, event.type, event.get("targetId", "")]
		if event_keys.has(event_key): errors.append("duplicate targeting event")
		event_keys[event_key] = true
	return errors

static func _valid_vector(value: Variant) -> bool: return typeof(value) == TYPE_DICTIONARY and _finite_number(value.get("x")) and _finite_number(value.get("y")) and _finite_number(value.get("z"))
static func _same_point(left: Variant, right: Variant) -> bool: return _valid_vector(left) and _valid_vector(right) and float(left.x) == float(right.x) and float(left.y) == float(right.y) and float(left.z) == float(right.z)

static func response(request: Dictionary, command_id: String, status: String, metrics: Dictionary, validation_errors: Array = [], runtime_errors: Array = []) -> Dictionary:
	return { "schemaVersion": SCHEMA_VERSION, "commandId": command_id, "fixtureId": str(request.get("fixtureId", "")), "correlationId": str(request.get("correlationId", "")), "status": status, "metrics": metrics, "warnings": [], "validationErrors": validation_errors, "runtimeErrors": runtime_errors, "changedFiles": [], "evidence": { "godotVersion": Engine.get_version_info().get("string", "unknown"), "physicsTicksPerSecond": Engine.physics_ticks_per_second } }

static func _finite_number(value: Variant) -> bool: return (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value))
