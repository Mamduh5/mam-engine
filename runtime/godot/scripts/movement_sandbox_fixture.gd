class_name MovementSandboxFixture
extends Node3D

const EPSILON: float = 0.000000000001
const ARENA_RADIUS: float = 11.0
const MovementRuntime = preload("res://addons/mam_engine/runtime/mam_movement_runtime.gd")

@onready var actor: CharacterBody3D = $Player
@onready var camera: Camera3D = $Camera3D
@onready var status_label: Label = $Hud/Panel/Status

var profile: Dictionary = {}
var runtime: RefCounted
var runtime_state: Dictionary = {}

func configure(value: Dictionary) -> void:
	profile = value
	actor.position = Vector3(0.0, 0.9, 0.0)
	actor.velocity = Vector3.ZERO
	runtime = MovementRuntime.new()
	runtime_state = runtime.bind(actor, profile).data
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
		var input_direction := Vector2(float(control.x), -float(control.z))
		if input_direction.length_squared() > EPSILON:
			input_direction = input_direction.normalized()
			move_input_steps += 1
		var sprint_pressed: bool = bool(control.sprint)
		if sprint_pressed: sprint_input_steps += 1
		var space_pressed: bool = bool(control.dodge)
		var before: Vector3 = actor.position
		var step_result: Dictionary = runtime.physics_step(fixed_delta, {"movement": input_direction, "walk": false, "sprintHeld": sprint_pressed, "dodgePressed": space_pressed}, {"forward": Vector3.FORWARD, "right": Vector3.RIGHT})
		runtime_state = step_result.data
		if runtime_state.dodgeAccepted: dodge_input_count += 1; dodge_observed = true
		if runtime_state.sprinting: sprint_observed = true
		_clamp_to_arena()
		distance_travelled += before.distance_to(actor.position)
		maximum_speed = maxf(maximum_speed, Vector2(actor.velocity.x, actor.velocity.z).length())
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
		"remainingStamina": runtime_state.stamina,
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
	var mode: String = str(runtime_state.get("mode", "IDLE"))
	status_label.text = "WASD Move   Shift Sprint   Space Dodge   Escape Exit\nSpeed: %.2f   Stamina: %.1f / %.1f   Mode: %s%s" % [speed, float(runtime_state.get("stamina", 0.0)), float(profile.stamina.maximum), mode, "   [AUTOMATED]" if automated else ""]

func _vector(value: Vector3) -> Dictionary:
	return { "x": value.x, "y": value.y, "z": value.z }
