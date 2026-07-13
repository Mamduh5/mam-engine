class_name MamMovementCore
extends RefCounted

const EPSILON := 0.000000000001
static var _owners: Dictionary = {}

var _body: CharacterBody3D
var _profile: Dictionary = {}
var _bound := false
var _stamina := 0.0
var _sprinting := false
var _regen_delay := 0.0
var _dodge_elapsed := 0.0
var _dodge_direction := Vector3.FORWARD
var _dodging := false
var _previous_dodge_pressed := false
var _facing := Vector3.FORWARD

func bind(body: Variant, profile: Variant) -> Dictionary:
	if _bound: return _failure("MAM_BIND_DUPLICATE", "body", "This runtime is already bound")
	if not body is CharacterBody3D: return _failure("MAM_BIND_BODY_INVALID", "body", "A CharacterBody3D is required")
	if typeof(profile) != TYPE_DICTIONARY or not _profile_complete(profile): return _failure("MAM_BIND_PROFILE_INVALID", "profile", "A complete loaded movement profile is required")
	var key: int = body.get_instance_id()
	if _owners.has(key): return _failure("MAM_BIND_BODY_OWNED", "body", "CharacterBody3D is already bound to another movement runtime")
	_body = body; _profile = profile; _bound = true; _owners[key] = weakref(self)
	_stamina = float(_profile.stamina.maximum); _facing = -_body.global_basis.z.normalized()
	if _facing.length_squared() <= EPSILON: _facing = Vector3.FORWARD
	return _success(_state(false, []))

func physics_step(delta: float, movement_input: Variant, camera_basis: Variant) -> Dictionary:
	if not _bound or not is_instance_valid(_body): return _failure("MAM_STEP_NOT_BOUND", "body", "Movement runtime is not bound")
	if not is_finite(delta) or delta <= 0.0: return _failure("MAM_STEP_DELTA_INVALID", "delta", "Physics delta must be finite and positive")
	if typeof(movement_input) != TYPE_DICTIONARY or not movement_input.has_all(["movement", "walk", "sprintHeld", "dodgePressed"]): return _failure("MAM_STEP_INPUT_INVALID", "input", "Explicit movement, walk, sprintHeld, and dodgePressed values are required")
	if not movement_input.movement is Vector2: return _failure("MAM_STEP_INPUT_INVALID", "input.movement", "Movement must be a Vector2")
	if typeof(movement_input.walk) != TYPE_BOOL or typeof(movement_input.sprintHeld) != TYPE_BOOL or typeof(movement_input.dodgePressed) != TYPE_BOOL: return _failure("MAM_STEP_INPUT_INVALID", "input", "Walk, sprintHeld, and dodgePressed must be booleans")
	if typeof(camera_basis) != TYPE_DICTIONARY or not camera_basis.has_all(["forward", "right"]) or not camera_basis.forward is Vector3 or not camera_basis.right is Vector3: return _failure("MAM_STEP_CAMERA_BASIS_INVALID", "cameraBasis", "Explicit forward and right Vector3 values are required")
	var forward: Vector3 = camera_basis.forward; var right: Vector3 = camera_basis.right; forward.y = 0.0; right.y = 0.0
	if forward.length_squared() <= EPSILON or right.length_squared() <= EPSILON: return _failure("MAM_STEP_CAMERA_BASIS_INVALID", "cameraBasis", "Horizontal camera basis vectors must be non-zero")
	forward = forward.normalized(); right = right.normalized()
	if absf(forward.dot(right)) > 0.001: return _failure("MAM_STEP_CAMERA_BASIS_INVALID", "cameraBasis", "Horizontal camera basis vectors must be orthogonal")
	var axis: Vector2 = movement_input.movement
	if axis.length() > 1.0: axis = axis.normalized()
	var desired_direction := right * axis.x + forward * axis.y
	if desired_direction.length_squared() > EPSILON: desired_direction = desired_direction.normalized()
	var dodge_pressed := bool(movement_input.dodgePressed); var dodge_accepted := false
	if dodge_pressed and not _previous_dodge_pressed and not _dodging and _stamina >= float(_profile.dodge.staminaCost):
		_dodging = true; dodge_accepted = true; _dodge_elapsed = 0.0; _stamina -= float(_profile.dodge.staminaCost); _regen_delay = float(_profile.stamina.regenerationDelaySeconds)
		_dodge_direction = desired_direction if desired_direction.length_squared() > EPSILON else _facing
	_previous_dodge_pressed = dodge_pressed
	if _dodging: _step_dodge(delta, desired_direction)
	else: _step_ground(delta, desired_direction, bool(movement_input.walk), bool(movement_input.sprintHeld))
	return _success(_state(dodge_accepted, []))

func unbind() -> Dictionary:
	if not _bound: return _failure("MAM_UNBIND_NOT_BOUND", "body", "Movement runtime is not bound")
	_owners.erase(_body.get_instance_id()); _body = null; _profile = {}; _bound = false
	return _success({"mode": "UNBOUND", "accepted": true})

func _step_ground(delta: float, direction: Vector3, walk: bool, sprint_held: bool) -> void:
	if sprint_held and (_sprinting or _stamina >= float(_profile.stamina.minimumToStartSprint)) and _stamina > 0.0:
		_sprinting = true; _stamina = maxf(0.0, _stamina - float(_profile.stamina.sprintCostPerSecond) * delta); _regen_delay = float(_profile.stamina.regenerationDelaySeconds)
		if _stamina <= EPSILON: _stamina = 0.0; _sprinting = false
	else:
		_sprinting = false; _regen_delay = maxf(0.0, _regen_delay - delta)
		if _regen_delay <= 0.0: _stamina = minf(float(_profile.stamina.maximum), _stamina + float(_profile.stamina.regenerationPerSecond) * delta)
	var target_speed := float(_profile.ground.sprintSpeed) if _sprinting else (float(_profile.ground.walkSpeed) if walk else float(_profile.ground.runSpeed))
	var current := Vector3(_body.velocity.x, 0.0, _body.velocity.z); var desired := direction * target_speed
	var rate := float(_profile.ground.acceleration) if desired.length() >= current.length() else float(_profile.ground.deceleration)
	current = current.move_toward(desired, rate * delta); _apply_velocity(current, delta)

func _step_dodge(delta: float, desired_direction: Vector3) -> void:
	if desired_direction.length_squared() > EPSILON: _dodge_direction = _dodge_direction.lerp(desired_direction, float(_profile.dodge.steeringMultiplier)).normalized()
	var duration := float(_profile.dodge.durationSeconds); var effective := minf(delta, duration - _dodge_elapsed); var speed := float(_profile.dodge.distance) / duration
	_apply_velocity(_dodge_direction * speed * effective / delta, delta); _dodge_elapsed += effective
	if _dodge_elapsed >= duration - EPSILON: _dodging = false

func _apply_velocity(horizontal: Vector3, delta: float) -> void:
	_body.velocity = Vector3(horizontal.x, 0.0, horizontal.z)
	if horizontal.length_squared() > EPSILON:
		_facing = horizontal.normalized(); var yaw := atan2(-_facing.x, -_facing.z); _body.rotation.y = rotate_toward(_body.rotation.y, yaw, deg_to_rad(float(_profile.ground.rotationSpeedDegrees)) * delta)
	_body.move_and_slide()

func _state(dodge_accepted: bool, diagnostics: Array) -> Dictionary:
	var horizontal := Vector3.ZERO if not is_instance_valid(_body) else Vector3(_body.velocity.x, 0.0, _body.velocity.z)
	var iframe := _dodging and _dodge_elapsed >= float(_profile.dodge.invulnerabilityStartSeconds) and _dodge_elapsed <= float(_profile.dodge.invulnerabilityEndSeconds)
	return {"mode": "DODGE" if _dodging else ("SPRINT" if _sprinting else ("MOVE" if horizontal.length() > 0.01 else "IDLE")), "horizontalVelocity": horizontal, "horizontalSpeed": horizontal.length(), "facingDirection": _facing, "stamina": _stamina, "sprinting": _sprinting, "dodgeElapsedSeconds": _dodge_elapsed if _dodging else 0.0, "dodgeRemainingSeconds": maxf(0.0, float(_profile.dodge.durationSeconds) - _dodge_elapsed) if _dodging else 0.0, "invulnerable": iframe, "dodgeAccepted": dodge_accepted, "accepted": true, "diagnostics": diagnostics}

func _success(data: Dictionary) -> Dictionary: return {"status": "passed", "data": data, "diagnostics": []}
func _failure(code: String, path: String, message: String) -> Dictionary: return {"status": "failed", "data": {}, "diagnostics": [{"code": code, "severity": "error", "path": path, "message": message}]}

func _profile_complete(value: Dictionary) -> bool:
	if not value.has_all(["ground", "stamina", "dodge"]) or typeof(value.ground) != TYPE_DICTIONARY or typeof(value.stamina) != TYPE_DICTIONARY or typeof(value.dodge) != TYPE_DICTIONARY: return false
	return value.ground.has_all(["walkSpeed", "runSpeed", "sprintSpeed", "acceleration", "deceleration", "rotationSpeedDegrees", "orientationMode"]) and value.stamina.has_all(["maximum", "sprintCostPerSecond", "regenerationPerSecond", "regenerationDelaySeconds", "minimumToStartSprint"]) and value.dodge.has_all(["distance", "durationSeconds", "staminaCost", "invulnerabilityStartSeconds", "invulnerabilityEndSeconds", "directionMode", "steeringMultiplier"])
