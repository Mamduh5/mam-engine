class_name EncounterFixture
extends Node3D

const LargeEnemyFixtureScene: PackedScene = preload("res://scenes/large_enemy_fixture.tscn")
const WeaponFixtureScene: PackedScene = preload("res://scenes/weapon_fixture.tscn")
const AtomicJsonFile = preload("res://scripts/atomic_json_file.gd")
const CHECKPOINT_SCHEMA_VERSION: String = "mam.encounter-checkpoint/v1"

var encounter_profile: Dictionary = {}; var resolved_paths: Dictionary = {}; var hunter_health_profile: Dictionary = {}; var stamina_profile: Dictionary = {}
var weapon_profile: Dictionary = {}; var weapon_paths: Dictionary = {}; var action_profile: Dictionary = {}; var timeline_profile: Dictionary = {}; var hitbox_profile: Dictionary = {}
var enemy_profile: Dictionary = {}; var enemy_paths: Dictionary = {}; var enemy_health_profile: Dictionary = {}; var reaction_profile: Dictionary = {}; var hurtbox_profiles: Array = []
var selected_body_part_id: String = ""; var selected_hurtbox_profile: Dictionary = {}; var arena_profile: Dictionary = {}; var scenario_profile: Dictionary = {}
var arena_root: Node3D; var hunter_root: Node3D; var status_label: Label
var current_stamina: float = 0.0; var current_enemy_health: float = 0.0; var starting_stamina: float = 0.0
var next_round_number: int = 1; var rounds_completed: int = 0; var cycles_completed: int = 0; var accepted_strikes: int = 0; var contact_count: int = 0; var strike_count: int = 0
var total_consumed: float = 0.0; var total_damage: float = 0.0; var last_reaction: String = "none"; var failure_reason: String = "round-limit"; var encounter_state: String = "in-progress"
var summaries: Array[Dictionary] = []; var physics_steps: int = 0; var input_events_processed: int = 0; var advance_requested: bool = false; var round_running: bool = false; var exit_requested: bool = false
var checkpoint_created: bool = false; var controlled_interruption: bool = false; var resumed_from_round: Variant = null

func configure(payload: Dictionary) -> void:
	encounter_profile = payload.encounterProfile; resolved_paths = payload.resolvedDefinitionPaths; hunter_health_profile = payload.hunterHealthProfile; stamina_profile = payload.staminaProfile
	weapon_profile = payload.weaponProfile; weapon_paths = payload.weaponResolvedDefinitionPaths; action_profile = payload.offensiveActionProfile; timeline_profile = payload.actionTimelineProfile; hitbox_profile = payload.hitboxProfile
	enemy_profile = payload.enemyProfile; enemy_paths = payload.enemyResolvedDefinitionPaths; enemy_health_profile = payload.enemyHealthProfile; reaction_profile = payload.reactionProfile; hurtbox_profiles = payload.hurtboxProfiles
	selected_body_part_id = str(payload.selectedBodyPartId); selected_hurtbox_profile = payload.selectedHurtboxProfile; arena_profile = payload.arenaProfile

func run_scenario(scenario: Dictionary) -> Dictionary:
	scenario_profile = scenario; _construct_scene(); _reset_state()
	var mode: String = str(scenario.get("mode", "runtime"))
	if mode == "recovery-resume": _load_checkpoint(scenario.recoveryCheckpoint)
	_update_status()
	while encounter_state == "in-progress" and not exit_requested:
		if mode == "interactive":
			if bool(scenario.get("autoDrive", false)): _inject_advance_event()
			while not advance_requested and not exit_requested: await get_tree().process_frame
		else: advance_requested = true
		if exit_requested: break
		advance_requested = false; await _advance_one_round(); _write_checkpoint_if_requested(); _update_status()
		if mode == "recovery-initial" and rounds_completed == int(scenario.get("interruptAfterRound", 1)):
			controlled_interruption = true; break
	return _report(mode)

func _input(event: InputEvent) -> void:
	if not (event is InputEventKey): return
	var key: InputEventKey = event as InputEventKey
	if not key.pressed or key.echo: return
	if key.keycode == KEY_ESCAPE: exit_requested = true; return
	if key.keycode == KEY_R and encounter_state != "in-progress": _reset_state(); _update_status(); return
	if [KEY_ENTER, KEY_SPACE].has(key.keycode) and encounter_state == "in-progress" and not round_running and not advance_requested:
		advance_requested = true; input_events_processed += 1

func _advance_one_round() -> void:
	round_running = true
	var round_number: int = next_round_number
	var enemy_cycle: Variant = LargeEnemyFixtureScene.instantiate(); enemy_cycle.position = _vector(arena_profile.enemySpawn); arena_root.add_child(enemy_cycle); enemy_cycle.configure(enemy_profile, enemy_paths, hurtbox_profiles)
	var cycle_result: Dictionary = await enemy_cycle.run_scenario({"id": "full-cycle", "durationSeconds": _cycle_duration(), "fixedDeltaSeconds": float(scenario_profile.fixedDeltaSeconds)})
	physics_steps += int(cycle_result.get("physicsSteps", 0)); cycles_completed += 1
	var stamina_before: float = current_stamina; var health_before: float = current_enemy_health
	var current_stamina_profile: Dictionary = stamina_profile.duplicate(true); current_stamina_profile.maxStamina = maxf(float(current_stamina_profile.maxStamina), current_stamina); current_stamina_profile.startingStamina = current_stamina
	var current_health_profile: Dictionary = enemy_health_profile.duplicate(true); current_health_profile.startingHealth = current_enemy_health
	var weapon_runtime: Variant = WeaponFixtureScene.instantiate(); hunter_root.add_child(weapon_runtime); weapon_runtime.configure(weapon_profile, weapon_paths, current_stamina_profile, current_health_profile, selected_hurtbox_profile, reaction_profile, action_profile, timeline_profile, hitbox_profile)
	var strike: Dictionary = await weapon_runtime.run_scenario({"id": "successful-strike", "durationSeconds": float(action_profile.durationSeconds) + float(action_profile.cooldownSeconds), "fixedDeltaSeconds": float(scenario_profile.fixedDeltaSeconds), "targetActionWasActive": true})
	physics_steps += int(strike.get("physicsSteps", 0)); rounds_completed += 1; strike_count += 1; next_round_number += 1
	current_stamina = float(strike.remainingStamina); current_enemy_health = float(strike.remainingHealth); last_reaction = str(strike.reactionType); total_consumed += float(strike.consumedStamina); total_damage += float(strike.appliedDamage)
	if bool(strike.actionAccepted): accepted_strikes += 1
	if bool(strike.contactOccurred): contact_count += 1
	var reason: String = "none"
	if not bool(strike.defeated):
		if not bool(strike.actionAccepted): reason = "insufficient-stamina"
		elif not bool(strike.contactOccurred): reason = "no-contact"
		elif round_number == int(encounter_profile.maxRounds): reason = "round-limit"
	var round_outcome: String = "victory" if bool(strike.defeated) else ("continued" if reason == "none" else "failed")
	summaries.append({"roundNumber": round_number, "enemyCycleCompleted": true, "startingStamina": stamina_before, "actionAccepted": bool(strike.actionAccepted), "consumedStamina": float(strike.consumedStamina), "remainingStamina": current_stamina, "startingEnemyHealth": health_before, "contactOccurred": bool(strike.contactOccurred), "damageApplied": float(strike.appliedDamage), "remainingEnemyHealth": current_enemy_health, "reactionType": last_reaction, "enemyDefeated": bool(strike.defeated), "roundOutcome": round_outcome, "failureReason": reason})
	failure_reason = reason
	if bool(strike.defeated): encounter_state = "completed"; failure_reason = "none"
	elif reason != "none": encounter_state = "failed"
	round_running = false

func _reset_state() -> void:
	starting_stamina = float(scenario_profile.startingStamina); current_stamina = starting_stamina; current_enemy_health = float(enemy_health_profile.startingHealth)
	next_round_number = 1; rounds_completed = 0; cycles_completed = 0; accepted_strikes = 0; contact_count = 0; strike_count = 0; total_consumed = 0.0; total_damage = 0.0; last_reaction = "none"; failure_reason = "round-limit"; encounter_state = "in-progress"; summaries = []; physics_steps = 0; input_events_processed = 0; advance_requested = false; round_running = false; exit_requested = false; checkpoint_created = false; controlled_interruption = false; resumed_from_round = null

func _load_checkpoint(checkpoint: Dictionary) -> void:
	next_round_number = int(checkpoint.nextRoundNumber); rounds_completed = int(checkpoint.roundsCompleted); cycles_completed = int(checkpoint.enemyBehaviorCyclesCompleted); current_stamina = float(checkpoint.currentHunterStamina); current_enemy_health = float(checkpoint.currentEnemyHealth); total_consumed = float(checkpoint.totalConsumedStamina); total_damage = float(checkpoint.totalAppliedDamage); strike_count = int(checkpoint.strikeCount); accepted_strikes = int(checkpoint.acceptedStrikeCount); contact_count = int(checkpoint.contactCount); last_reaction = str(checkpoint.lastReactionType); summaries = []
	for summary: Dictionary in checkpoint.roundSummaries: summaries.append(summary.duplicate(true))
	encounter_state = str(checkpoint.encounterState); resumed_from_round = next_round_number

func _write_checkpoint_if_requested() -> void:
	var checkpoint_path: String = str(scenario_profile.get("checkpointPath", "")); if checkpoint_path.is_empty(): return
	var checkpoint: Dictionary = {"schemaVersion": CHECKPOINT_SCHEMA_VERSION, "encounterId": str(encounter_profile.id), "scenarioId": str(scenario_profile.id), "selectedBodyPartId": selected_body_part_id, "nextRoundNumber": next_round_number, "roundsCompleted": rounds_completed, "enemyBehaviorCyclesCompleted": cycles_completed, "currentHunterStamina": current_stamina, "currentEnemyHealth": current_enemy_health, "totalConsumedStamina": total_consumed, "totalAppliedDamage": total_damage, "strikeCount": strike_count, "acceptedStrikeCount": accepted_strikes, "contactCount": contact_count, "lastReactionType": last_reaction, "roundSummaries": summaries, "encounterState": encounter_state}
	checkpoint_created = AtomicJsonFile.write(checkpoint_path, checkpoint)

func _inject_advance_event() -> void:
	var event: InputEventKey = InputEventKey.new(); event.keycode = KEY_ENTER; event.pressed = true; Input.parse_input_event(event)

func _construct_scene() -> void:
	arena_root = Node3D.new(); arena_root.name = "ArenaRoot"; arena_root.set_meta("radius", float(arena_profile.radius)); add_child(arena_root)
	hunter_root = Node3D.new(); hunter_root.name = "HunterRoot"; hunter_root.position = _vector(arena_profile.playerSpawn); arena_root.add_child(hunter_root)
	var overlay: CanvasLayer = CanvasLayer.new(); overlay.name = "StatusOverlay"; status_label = Label.new(); status_label.name = "EncounterStatus"; overlay.add_child(status_label); add_child(overlay)

func _update_status() -> void:
	status_label.text = "Round: %d\nStamina: %.2f\nEnemy Health: %.2f\nTarget: %s\nState: %s\nOutcome: %s" % [next_round_number, current_stamina, current_enemy_health, selected_body_part_id, encounter_state, "victory" if encounter_state == "completed" else ("failed" if encounter_state == "failed" else "pending")]

func _report(mode: String) -> Dictionary:
	var defeated: bool = current_enemy_health <= 0.0
	return {"encounterId": str(encounter_profile.id), "resolvedDefinitionPaths": resolved_paths, "arenaRadius": float(arena_profile.radius), "hunterSpawn": _vector_report(hunter_root.position), "enemySpawn": _vector_report(_vector(arena_profile.enemySpawn)), "spawnSeparation": _vector(arena_profile.playerSpawn).distance_to(_vector(arena_profile.enemySpawn)), "selectedBodyPartId": selected_body_part_id, "maximumRounds": int(encounter_profile.maxRounds), "roundsStarted": summaries.size(), "roundsCompleted": rounds_completed, "enemyBehaviorCyclesCompleted": cycles_completed, "hunterStartingHealth": float(hunter_health_profile.startingHealth), "hunterFinalHealth": float(hunter_health_profile.startingHealth), "hunterStartingStamina": starting_stamina, "hunterConsumedStamina": total_consumed, "hunterRemainingStamina": current_stamina, "enemyStartingHealth": float(enemy_health_profile.startingHealth), "enemyRemainingHealth": current_enemy_health, "totalDamageApplied": total_damage, "strikeCount": strike_count, "acceptedStrikeCount": accepted_strikes, "contactCount": contact_count, "lastReactionType": last_reaction, "enemyDefeated": defeated, "objectiveCompleted": defeated, "outcome": "victory" if defeated else "failed", "failureReason": failure_reason, "finalHunterState": "alive", "finalEnemyState": "defeated" if defeated else "alive", "finalEncounterState": "completed" if defeated else "failed", "roundSummaries": summaries, "physicsSteps": physics_steps, "interactiveModeConfirmed": mode == "interactive" and DisplayServer.get_name() != "headless", "inputEventsProcessed": input_events_processed, "restartAvailable": true, "checkpointCreated": checkpoint_created, "controlledInterruption": controlled_interruption, "resumedFromRound": resumed_from_round}

func _cycle_duration() -> float: return float(enemy_profile.idleDurationSeconds) + float(enemy_profile.telegraphDurationSeconds) + float(enemy_profile.attackDurationSeconds) + float(enemy_profile.recoveryDurationSeconds)
func _vector(value: Dictionary) -> Vector3: return Vector3(float(value.x), float(value.y), float(value.z))
func _vector_report(value: Vector3) -> Dictionary: return {"x": value.x, "y": value.y, "z": value.z}
