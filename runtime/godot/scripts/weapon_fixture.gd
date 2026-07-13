class_name WeaponFixture
extends Node3D

const StaminaFixtureRuntime = preload("res://scripts/stamina_fixture.gd")
const HealthFixtureRuntime = preload("res://scripts/health_fixture.gd")
const DamageReactionFixtureRuntime = preload("res://scripts/damage_reaction_fixture.gd")
const OffensiveActionFixtureRuntime = preload("res://scripts/offensive_action_fixture.gd")
const ContactVolumeFixtureRuntime = preload("res://scripts/contact_volume_fixture.gd")
const EPSILON := 0.000000000001

@onready var animation_player: AnimationPlayer = $AnimationPlayer
var weapon_profile: Dictionary = {}
var resolved_paths: Dictionary = {}
var stamina_profile: Dictionary = {}
var health_profile: Dictionary = {}
var hurtbox_profile: Dictionary = {}
var reaction_profile: Dictionary = {}
var action_profile: Dictionary = {}
var timeline_profile: Dictionary = {}
var hitbox_profile: Dictionary = {}
var current_step: int = 0
var emitted_events: Array[Dictionary] = []
var hitbox_area: Area3D
var hurtbox_area: Area3D
var hitbox_enabled: bool = false
var hitbox_enable_count: int = 0
var physics_steps: int = 0

func configure(weapon: Dictionary, paths: Dictionary, stamina: Dictionary, health: Dictionary, hurtbox: Dictionary, reaction: Dictionary, action: Dictionary, timeline: Dictionary, hitbox: Dictionary) -> void:
	weapon_profile = weapon; resolved_paths = paths; stamina_profile = stamina; health_profile = health; hurtbox_profile = hurtbox; reaction_profile = reaction; action_profile = action; timeline_profile = timeline; hitbox_profile = hitbox

func run_scenario(scenario: Dictionary) -> Dictionary:
	if not ["successful-strike", "insufficient-stamina"].has(scenario.id): return {}
	var delta: float = float(scenario.fixedDeltaSeconds)
	var stamina_result: Dictionary = StaminaFixtureRuntime.evaluate(stamina_profile, action_profile)
	if not bool(stamina_result.actionAccepted): return _rejected_result(stamina_result, scenario, delta)
	var timeline_steps: int = maxi(1, ceili(float(timeline_profile.durationSeconds) / delta - EPSILON))
	var lifecycle_steps: int = OffensiveActionFixtureRuntime.lifecycle_steps(action_profile, delta)
	var hitbox_start_step: int = ContactVolumeFixtureRuntime.authored_step(float(hitbox_profile.activeStartSeconds), delta)
	var hitbox_end_step: int = ContactVolumeFixtureRuntime.authored_step(float(hitbox_profile.activeEndSeconds), delta)
	var hurtbox_start_step: int = ContactVolumeFixtureRuntime.authored_step(float(hurtbox_profile.activeStartSeconds), delta)
	var hurtbox_end_step: int = ContactVolumeFixtureRuntime.authored_step(float(hurtbox_profile.activeEndSeconds), delta)
	hitbox_area = _create_area("WeaponHitbox", hitbox_profile, 1, 2); hurtbox_area = _create_area("TargetHurtbox", hurtbox_profile, 2, 1); add_child(hitbox_area); add_child(hurtbox_area)
	_set_hitbox_active(false); _set_active(hurtbox_area, false); await _settle_physics()
	_build_animation(); animation_player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL; animation_player.callback_mode_method = AnimationMixer.ANIMATION_CALLBACK_MODE_METHOD_IMMEDIATE
	current_step = 1; animation_player.play(StringName(timeline_profile.animationName)); animation_player.advance(0.0)
	var contact_occurred: bool = false; var first_contact_step: Variant = null; var damage_application_count: int = 0; var hit: Dictionary = {}; var reaction: Dictionary = {}
	for step: int in range(1, timeline_steps + 1):
		current_step = step; _set_active(hurtbox_area, step >= hurtbox_start_step and step <= hurtbox_end_step); animation_player.advance(delta); await _settle_physics()
		if not contact_occurred and hitbox_enabled and hitbox_area.overlaps_area(hurtbox_area):
			contact_occurred = true; first_contact_step = step; damage_application_count = 1; hit = HealthFixtureRuntime.resolve_damage_value(health_profile, float(action_profile.damage)); reaction = DamageReactionFixtureRuntime.resolve_reaction(reaction_profile, hit, bool(scenario.targetActionWasActive), delta)
	_set_hitbox_active(false); _set_active(hurtbox_area, false)
	for _step: int in range(timeline_steps + 1, lifecycle_steps + 1): await get_tree().physics_frame; physics_steps += 1
	if hit.is_empty(): hit = HealthFixtureRuntime.resolve_damage_value(health_profile, 0.0); reaction = DamageReactionFixtureRuntime.resolve_reaction(reaction_profile, hit, bool(scenario.targetActionWasActive), delta)
	for _step: int in range(int(reaction.reactionTotalSteps)): await get_tree().physics_frame; physics_steps += 1
	return _result(stamina_result, timeline_steps, hitbox_start_step, hitbox_end_step, contact_occurred, first_contact_step, hit, reaction, damage_application_count, delta)

func _rejected_result(stamina_result: Dictionary, scenario: Dictionary, delta: float) -> Dictionary:
	var hit: Dictionary = HealthFixtureRuntime.resolve_damage_value(health_profile, 0.0)
	var reaction: Dictionary = DamageReactionFixtureRuntime.resolve_reaction(reaction_profile, hit, bool(scenario.targetActionWasActive), delta)
	return {
		"weaponId": str(weapon_profile.id), "resolvedDefinitionPaths": resolved_paths, "actionAccepted": false, "sufficientStamina": bool(stamina_result.sufficientStamina), "startingStamina": float(stamina_result.startingStamina), "requestedStaminaCost": float(stamina_result.requestedStaminaCost), "consumedStamina": float(stamina_result.consumedStamina), "remainingStamina": float(stamina_result.remainingStamina), "finalStaminaState": str(stamina_result.finalStaminaState),
		"timelineTotalSteps": 0, "emittedEvents": [], "offensiveActiveStartStep": null, "offensiveActiveEndStep": null, "hitboxActiveStartStep": null, "hitboxActiveEndStep": null, "contactOccurred": false, "firstContactStep": null,
		"incomingDamage": float(hit.incomingDamage), "appliedDamage": float(hit.appliedDamage), "remainingHealth": float(hit.remainingHealth), "overkillDamage": float(hit.overkillDamage), "defeated": bool(hit.defeated), "reactionType": str(reaction.reactionType), "reactionDurationSeconds": float(reaction.reactionDurationSeconds), "reactionTotalSteps": int(reaction.reactionTotalSteps), "targetActionInterrupted": bool(reaction.targetActionInterrupted), "finalActionState": "rejected", "finalTargetActionState": str(reaction.finalTargetActionState), "finalTargetState": str(reaction.finalTargetState),
		"animationStarted": false, "emittedEventCount": 0, "hitboxEnableCount": 0, "damageApplicationCount": 0, "physicsSteps": physics_steps
	}

func _result(stamina_result: Dictionary, timeline_steps: int, hitbox_start_step: int, hitbox_end_step: int, contact_occurred: bool, first_contact_step: Variant, hit: Dictionary, reaction: Dictionary, damage_application_count: int, delta: float) -> Dictionary:
	return {
		"weaponId": str(weapon_profile.id), "resolvedDefinitionPaths": resolved_paths, "actionAccepted": true, "sufficientStamina": bool(stamina_result.sufficientStamina), "startingStamina": float(stamina_result.startingStamina), "requestedStaminaCost": float(stamina_result.requestedStaminaCost), "consumedStamina": float(stamina_result.consumedStamina), "remainingStamina": float(stamina_result.remainingStamina), "finalStaminaState": str(stamina_result.finalStaminaState),
		"timelineTotalSteps": timeline_steps, "emittedEvents": emitted_events, "offensiveActiveStartStep": OffensiveActionFixtureRuntime.active_start_step(action_profile, delta), "offensiveActiveEndStep": OffensiveActionFixtureRuntime.active_end_step(action_profile, delta), "hitboxActiveStartStep": hitbox_start_step, "hitboxActiveEndStep": hitbox_end_step, "contactOccurred": contact_occurred, "firstContactStep": first_contact_step,
		"incomingDamage": float(hit.incomingDamage), "appliedDamage": float(hit.appliedDamage), "remainingHealth": float(hit.remainingHealth), "overkillDamage": float(hit.overkillDamage), "defeated": bool(hit.defeated), "reactionType": str(reaction.reactionType), "reactionDurationSeconds": float(reaction.reactionDurationSeconds), "reactionTotalSteps": int(reaction.reactionTotalSteps), "targetActionInterrupted": bool(reaction.targetActionInterrupted), "finalActionState": "ready", "finalTargetActionState": str(reaction.finalTargetActionState), "finalTargetState": str(reaction.finalTargetState),
		"animationStarted": true, "emittedEventCount": emitted_events.size(), "hitboxEnableCount": hitbox_enable_count, "damageApplicationCount": damage_application_count, "physicsSteps": physics_steps
	}

func _build_animation() -> void:
	var animation: Animation = Animation.new(); animation.length = float(timeline_profile.durationSeconds); animation.loop_mode = Animation.LOOP_NONE
	for event: Dictionary in timeline_profile.events:
		var track_index: int = animation.add_track(Animation.TYPE_METHOD); animation.track_set_path(track_index, NodePath(".")); var method_key: Dictionary = {"method": &"_record_timeline_event", "args": [str(event.id), str(event.name), float(event.timeSeconds)]}; animation.track_insert_key(track_index, float(event.timeSeconds), method_key)
	var library: AnimationLibrary = AnimationLibrary.new(); library.add_animation(StringName(timeline_profile.animationName), animation); animation_player.add_animation_library(&"", library)

func _record_timeline_event(event_id: String, event_name: String, authored_time_seconds: float) -> void:
	emitted_events.append({"id": event_id, "name": event_name, "authoredTimeSeconds": authored_time_seconds, "emittedStep": current_step})
	if event_id == str(weapon_profile.hitboxEnableEventId): _set_hitbox_active(true)
	elif event_id == str(weapon_profile.hitboxDisableEventId): _set_hitbox_active(false)

func _create_area(node_name: String, profile: Dictionary, layer: int, mask: int) -> Area3D:
	var area: Area3D = Area3D.new(); area.name = node_name; area.position = Vector3(float(profile.center.x), float(profile.center.y), float(profile.center.z)); area.collision_layer = layer; area.collision_mask = mask; area.monitoring = true; area.monitorable = true
	var shape_node: CollisionShape3D = CollisionShape3D.new(); var sphere: SphereShape3D = SphereShape3D.new(); sphere.radius = float(profile.radius); shape_node.shape = sphere; area.add_child(shape_node); return area

func _set_hitbox_active(active: bool) -> void:
	if active and not hitbox_enabled: hitbox_enable_count += 1
	hitbox_enabled = active
	if is_instance_valid(hitbox_area): hitbox_area.monitoring = active

func _set_active(area: Area3D, active: bool) -> void: area.monitoring = active
func _settle_physics() -> void: await get_tree().physics_frame; physics_steps += 1; await get_tree().physics_frame; physics_steps += 1
