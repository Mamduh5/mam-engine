class_name MovementSandboxFixture
extends Node3D

const EPSILON: float = 0.000000000001
const ARENA_RADIUS: float = 11.0

@onready var actor: CharacterBody3D = $Player
@onready var camera: Camera3D = $Camera3D
@onready var status_label: Label = $Hud/Panel/Status

var profile: Dictionary = {}
var stamina: float = 0.0
var sprinting: bool = false
var regeneration_delay: float = 0.0
var dodge_remaining: float = 0.0
var dodge_direction: Vector3 = Vector3.FORWARD
var previous_space: bool = false

func configure(value: Dictionary) -> void:
	profile = value
	stamina = float(profile.stamina.maximum)
	actor.position = Vector3(0.0, 0.9, 0.0)
	actor.velocity = Vector3.ZERO
	_update_camera()

func run_scenario(scenario: Dictionary) -> Dictionary:
	var automated: bool = bool(scenario.automatedInput)
	var fixed_delta: float = float(scenario.fixedDeltaSeconds)
	var steps: int = 0
	var move_input_steps: int = 0
	var sprint_input_steps: int = 0
	var dodge_input_count: int = 0
	var sprint_observed: bool = false
	var dodge_observed: bool = false
	var maximum_speed: float = 0.0
	var distance_travelled: float = 0.0
	var starting_position: Vector3 = actor.position
	while automated or not Input.is_key_pressed(KEY_ESCAPE):
		await get_tree().physics_frame
		steps += 1
		var control: Dictionary = _control_state(steps, automated)
		var input_direction := Vector3(float(control.x), 0.0, float(control.z))
		if input_direction.length_squared() > EPSILON:
			input_direction = input_direction.normalized()
			move_input_steps += 1
		var sprint_pressed: bool = bool(control.sprint)
		if sprint_pressed: sprint_input_steps += 1
		var space_pressed: bool = bool(control.dodge)
		if space_pressed and not previous_space and dodge_remaining <= 0.0 and stamina >= float(profile.dodge.staminaCost):
			stamina -= float(profile.dodge.staminaCost)
			regeneration_delay = float(profile.stamina.regenerationDelaySeconds)
			dodge_remaining = float(profile.dodge.durationSeconds)
			dodge_direction = input_direction if input_direction.length_squared() > EPSILON else Vector3.FORWARD
			dodge_input_count += 1
			dodge_observed = true
		previous_space = space_pressed
		var before: Vector3 = actor.position
		if dodge_remaining > 0.0:
			var dodge_speed: float = float(profile.dodge.distance) / float(profile.dodge.durationSeconds)
			actor.velocity = dodge_direction * dodge_speed
			dodge_remaining = maxf(0.0, dodge_remaining - fixed_delta)
		else:
			_update_stamina(sprint_pressed, fixed_delta)
			var target_speed: float = float(profile.ground.sprintSpeed) if sprinting else float(profile.ground.runSpeed)
			var desired: Vector3 = input_direction * target_speed
			var rate: float = float(profile.ground.acceleration) if desired.length() >= actor.velocity.length() else float(profile.ground.deceleration)
			actor.velocity = actor.velocity.move_toward(desired, rate * fixed_delta)
			if sprinting: sprint_observed = true
		actor.velocity.y = 0.0
		actor.move_and_slide()
		_clamp_to_arena()
		distance_travelled += before.distance_to(actor.position)
		maximum_speed = maxf(maximum_speed, Vector2(actor.velocity.x, actor.velocity.z).length())
		if actor.velocity.length_squared() > EPSILON:
			var target_yaw: float = atan2(-actor.velocity.x, -actor.velocity.z)
			actor.rotation.y = rotate_toward(actor.rotation.y, target_yaw, deg_to_rad(float(profile.ground.rotationSpeedDegrees)) * fixed_delta)
		_update_camera()
		_update_hud(automated)
		if automated and steps >= 180: break
	var final_position: Vector3 = actor.position
	return {
		"physicsSteps": steps,
		"profileId": str(profile.id),
		"mode": "automated" if automated else "interactive",
		"startingPosition": _vector(starting_position),
		"finalPosition": _vector(final_position),
		"displacement": starting_position.distance_to(final_position),
		"distanceTravelled": distance_travelled,
		"maximumObservedSpeed": maximum_speed,
		"startingStamina": float(profile.stamina.maximum),
		"remainingStamina": stamina,
		"sprintObserved": sprint_observed,
		"dodgeObserved": dodge_observed,
		"moveInputSteps": move_input_steps,
		"sprintInputSteps": sprint_input_steps,
		"dodgeInputCount": dodge_input_count,
		"finalState": "complete"
	}

func _control_state(step: int, automated: bool) -> Dictionary:
	if automated:
		return { "x": 0.0, "z": -1.0 if step <= 150 else 0.0, "sprint": step >= 61 and step <= 120, "dodge": step == 121 }
	return {
		"x": float(int(Input.is_key_pressed(KEY_D)) - int(Input.is_key_pressed(KEY_A))),
		"z": float(int(Input.is_key_pressed(KEY_S)) - int(Input.is_key_pressed(KEY_W))),
		"sprint": Input.is_key_pressed(KEY_SHIFT),
		"dodge": Input.is_key_pressed(KEY_SPACE)
	}

func _update_stamina(sprint_pressed: bool, delta: float) -> void:
	if sprint_pressed and (sprinting or stamina >= float(profile.stamina.minimumToStartSprint)) and stamina > 0.0:
		sprinting = true
		var consumed: float = minf(stamina, float(profile.stamina.sprintCostPerSecond) * delta)
		stamina -= consumed
		regeneration_delay = float(profile.stamina.regenerationDelaySeconds)
		if stamina <= EPSILON: stamina = 0.0; sprinting = false
	else:
		sprinting = false
		regeneration_delay = maxf(0.0, regeneration_delay - delta)
		if regeneration_delay <= 0.0: stamina = minf(float(profile.stamina.maximum), stamina + float(profile.stamina.regenerationPerSecond) * delta)

func _clamp_to_arena() -> void:
	var horizontal := Vector2(actor.position.x, actor.position.z)
	if horizontal.length() > ARENA_RADIUS:
		horizontal = horizontal.normalized() * ARENA_RADIUS
		actor.position.x = horizontal.x
		actor.position.z = horizontal.y

func _update_camera() -> void:
	camera.position = actor.position + Vector3(7.0, 6.0, 9.0)
	camera.look_at(actor.position + Vector3(0.0, 0.8, 0.0), Vector3.UP)

func _update_hud(automated: bool) -> void:
	var speed: float = Vector2(actor.velocity.x, actor.velocity.z).length()
	var mode: String = "DODGE" if dodge_remaining > 0.0 else ("SPRINT" if sprinting else ("MOVE" if speed > 0.01 else "IDLE"))
	status_label.text = "WASD Move   Shift Sprint   Space Dodge   Escape Exit\nSpeed: %.2f   Stamina: %.1f / %.1f   Mode: %s%s" % [speed, stamina, float(profile.stamina.maximum), mode, "   [AUTOMATED]" if automated else ""]

func _vector(value: Vector3) -> Dictionary:
	return { "x": value.x, "y": value.y, "z": value.z }
