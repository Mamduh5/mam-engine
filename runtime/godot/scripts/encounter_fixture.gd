class_name EncounterFixture
extends Node3D

const LargeEnemyFixtureScene: PackedScene = preload("res://scenes/large_enemy_fixture.tscn")
const WeaponFixtureScene: PackedScene = preload("res://scenes/weapon_fixture.tscn")

var encounter_profile: Dictionary = {}
var resolved_paths: Dictionary = {}
var hunter_profile: Dictionary = {}
var hunter_health_profile: Dictionary = {}
var stamina_profile: Dictionary = {}
var weapon_profile: Dictionary = {}
var weapon_paths: Dictionary = {}
var action_profile: Dictionary = {}
var timeline_profile: Dictionary = {}
var hitbox_profile: Dictionary = {}
var enemy_profile: Dictionary = {}
var enemy_paths: Dictionary = {}
var enemy_health_profile: Dictionary = {}
var reaction_profile: Dictionary = {}
var hurtbox_profiles: Array = []
var selected_body_part_id: String = ""
var selected_hurtbox_profile: Dictionary = {}
var arena_profile: Dictionary = {}
var physics_steps: int = 0
var arena_root: Node3D
var hunter_root: Node3D

func configure(payload: Dictionary) -> void:
	encounter_profile = payload.encounterProfile; resolved_paths = payload.resolvedDefinitionPaths
	hunter_profile = payload.hunterProfile; hunter_health_profile = payload.hunterHealthProfile; stamina_profile = payload.staminaProfile
	weapon_profile = payload.weaponProfile; weapon_paths = payload.weaponResolvedDefinitionPaths; action_profile = payload.offensiveActionProfile; timeline_profile = payload.actionTimelineProfile; hitbox_profile = payload.hitboxProfile
	enemy_profile = payload.enemyProfile; enemy_paths = payload.enemyResolvedDefinitionPaths; enemy_health_profile = payload.enemyHealthProfile; reaction_profile = payload.reactionProfile; hurtbox_profiles = payload.hurtboxProfiles
	selected_body_part_id = str(payload.selectedBodyPartId); selected_hurtbox_profile = payload.selectedHurtboxProfile; arena_profile = payload.arenaProfile

func run_scenario(scenario: Dictionary) -> Dictionary:
	_construct_scene()
	var delta: float = float(scenario.fixedDeltaSeconds)
	var stamina: float = float(scenario.startingStamina)
	var starting_stamina: float = stamina
	var enemy_health: float = float(enemy_health_profile.startingHealth)
	var starting_enemy_health: float = enemy_health
	var rounds_completed: int = 0
	var cycles_completed: int = 0
	var accepted_strikes: int = 0
	var contact_count: int = 0
	var total_damage: float = 0.0
	var last_reaction: String = "none"
	var failure_reason: String = "round-limit"
	var summaries: Array[Dictionary] = []
	for round_number: int in range(1, int(encounter_profile.maxRounds) + 1):
		if enemy_health <= 0.0: break
		var enemy_cycle: Variant = LargeEnemyFixtureScene.instantiate()
		enemy_cycle.position = _vector(arena_profile.enemySpawn); arena_root.add_child(enemy_cycle)
		enemy_cycle.configure(enemy_profile, enemy_paths, hurtbox_profiles)
		var cycle_result: Dictionary = await enemy_cycle.run_scenario({"id": "full-cycle", "durationSeconds": _cycle_duration(), "fixedDeltaSeconds": delta})
		physics_steps += int(cycle_result.get("physicsSteps", 0)); cycles_completed += 1
		var stamina_before: float = stamina; var health_before: float = enemy_health
		var current_stamina: Dictionary = stamina_profile.duplicate(true); current_stamina.maxStamina = maxf(float(current_stamina.maxStamina), stamina); current_stamina.startingStamina = stamina
		var current_health: Dictionary = enemy_health_profile.duplicate(true); current_health.startingHealth = enemy_health
		var weapon_runtime: Variant = WeaponFixtureScene.instantiate(); hunter_root.add_child(weapon_runtime)
		weapon_runtime.configure(weapon_profile, weapon_paths, current_stamina, current_health, selected_hurtbox_profile, reaction_profile, action_profile, timeline_profile, hitbox_profile)
		var strike: Dictionary = await weapon_runtime.run_scenario({"id": "successful-strike", "durationSeconds": float(action_profile.durationSeconds) + float(action_profile.cooldownSeconds), "fixedDeltaSeconds": delta, "targetActionWasActive": true})
		physics_steps += int(strike.get("physicsSteps", 0)); rounds_completed += 1
		stamina = float(strike.remainingStamina); enemy_health = float(strike.remainingHealth); last_reaction = str(strike.reactionType)
		if bool(strike.actionAccepted): accepted_strikes += 1
		if bool(strike.contactOccurred): contact_count += 1
		total_damage += float(strike.appliedDamage)
		var reason: String = "none"
		if not bool(strike.defeated):
			if not bool(strike.actionAccepted): reason = "insufficient-stamina"
			elif not bool(strike.contactOccurred): reason = "no-contact"
			elif round_number == int(encounter_profile.maxRounds): reason = "round-limit"
		var round_outcome: String = "victory" if bool(strike.defeated) else ("continued" if reason == "none" else "failed")
		summaries.append({"roundNumber": round_number, "enemyCycleCompleted": true, "startingStamina": stamina_before, "actionAccepted": bool(strike.actionAccepted), "consumedStamina": float(strike.consumedStamina), "remainingStamina": stamina, "startingEnemyHealth": health_before, "contactOccurred": bool(strike.contactOccurred), "damageApplied": float(strike.appliedDamage), "remainingEnemyHealth": enemy_health, "reactionType": last_reaction, "enemyDefeated": bool(strike.defeated), "roundOutcome": round_outcome, "failureReason": reason})
		failure_reason = reason
		if round_outcome != "continued": break
	var defeated: bool = enemy_health <= 0.0
	if defeated: failure_reason = "none"
	return {
		"encounterId": str(encounter_profile.id), "resolvedDefinitionPaths": resolved_paths, "arenaRadius": float(arena_profile.radius),
		"hunterSpawn": _vector_report(hunter_root.position), "enemySpawn": _vector_report(_vector(arena_profile.enemySpawn)), "spawnSeparation": _vector(arena_profile.playerSpawn).distance_to(_vector(arena_profile.enemySpawn)),
		"selectedBodyPartId": selected_body_part_id, "maximumRounds": int(encounter_profile.maxRounds), "roundsStarted": summaries.size(), "roundsCompleted": rounds_completed, "enemyBehaviorCyclesCompleted": cycles_completed,
		"hunterStartingHealth": float(hunter_health_profile.startingHealth), "hunterFinalHealth": float(hunter_health_profile.startingHealth), "hunterStartingStamina": starting_stamina, "hunterConsumedStamina": starting_stamina - stamina, "hunterRemainingStamina": stamina,
		"enemyStartingHealth": starting_enemy_health, "enemyRemainingHealth": enemy_health, "totalDamageApplied": total_damage, "strikeCount": summaries.size(), "acceptedStrikeCount": accepted_strikes, "contactCount": contact_count, "lastReactionType": last_reaction,
		"enemyDefeated": defeated, "objectiveCompleted": defeated, "outcome": "victory" if defeated else "failed", "failureReason": failure_reason, "finalHunterState": "alive", "finalEnemyState": "defeated" if defeated else "alive", "finalEncounterState": "completed" if defeated else "failed", "roundSummaries": summaries,
		"physicsSteps": physics_steps
	}

func _construct_scene() -> void:
	arena_root = Node3D.new(); arena_root.name = "ArenaRoot"; arena_root.set_meta("radius", float(arena_profile.radius)); add_child(arena_root)
	hunter_root = Node3D.new(); hunter_root.name = "HunterRoot"; hunter_root.position = _vector(arena_profile.playerSpawn); arena_root.add_child(hunter_root)

func _cycle_duration() -> float: return float(enemy_profile.idleDurationSeconds) + float(enemy_profile.telegraphDurationSeconds) + float(enemy_profile.attackDurationSeconds) + float(enemy_profile.recoveryDurationSeconds)
func _vector(value: Dictionary) -> Vector3: return Vector3(float(value.x), float(value.y), float(value.z))
func _vector_report(value: Vector3) -> Dictionary: return {"x": value.x, "y": value.y, "z": value.z}
