extends Node3D

const CameraCore = preload("res://addons/mam_engine/runtime/mam_camera_core.gd")
const EPSILON := 0.000000000001
const ANGLE_TOLERANCE := 0.25

var profile: Dictionary
var core: RefCounted
var bind_result: Dictionary = {}
@onready var target: Node3D = $Target
@onready var rig_root: Node3D = $FollowAnchor
@onready var yaw_pivot: Node3D = $FollowAnchor/YawPivot
@onready var pitch_pivot: Node3D = $FollowAnchor/YawPivot/PitchPivot
@onready var collision_probe: ShapeCast3D = $CollisionProbe
@onready var camera: Camera3D = $FollowAnchor/YawPivot/PitchPivot/Camera3D
@onready var wall: StaticBody3D = $CollisionWall
@onready var wall_shape: CollisionShape3D = $CollisionWall/CollisionShape3D

func configure(value: Dictionary) -> void:
	profile = value
	target.position = Vector3.ZERO
	_set_wall_enabled(false)
	_bind_core(profile)

func run_scenario(scenario: Dictionary) -> Dictionary:
	var metrics: Dictionary
	match scenario.id:
		"orbit": metrics = await _orbit(scenario)
		"pitch-clamp": metrics = await _pitch_clamp(scenario)
		"recenter": metrics = await _recenter(scenario)
		"follow": metrics = await _follow(scenario)
		"collision": metrics = await _collision(scenario)
		"basis": metrics = _basis()
		_: metrics = {}
	metrics.lens = {"fieldOfViewDegrees": camera.fov, "nearClipDistance": camera.near, "farClipDistance": camera.far}
	return metrics

func _orbit(scenario: Dictionary) -> Dictionary:
	_bind_core(profile)
	var steps := _steps(scenario)
	var state: Dictionary = bind_result.data
	var initial_yaw := float(state.yawDegrees)
	var initial_pitch := float(state.pitchDegrees)
	var previous_yaw := initial_yaw
	var previous_pitch := initial_pitch
	var yaw_travel := 0.0
	var pitch_travel := 0.0
	for _index in range(steps):
		state = await _step(float(scenario.fixedDeltaSeconds), Vector2(1.0, 0.5), Vector3.ZERO, 0.0)
		yaw_travel += CameraCore.shortest_angle_difference(previous_yaw, float(state.yawDegrees))
		pitch_travel += float(state.pitchDegrees) - previous_pitch
		previous_yaw = float(state.yawDegrees)
		previous_pitch = float(state.pitchDegrees)
	return {"durationSeconds": steps * float(scenario.fixedDeltaSeconds), "initialYawDegrees": initial_yaw, "finalYawDegrees": state.yawDegrees, "totalYawTravelDegrees": yaw_travel, "initialPitchDegrees": initial_pitch, "finalPitchDegrees": state.pitchDegrees, "totalPitchTravelDegrees": pitch_travel, "physicsSteps": steps, "fixedDeltaSeconds": scenario.fixedDeltaSeconds}

func _pitch_clamp(scenario: Dictionary) -> Dictionary:
	var steps := _steps(scenario)
	var positive_step: Variant = null
	var negative_step: Variant = null
	var pitch_sign := -1.0 if bool(profile.orbit.invertPitch) else 1.0
	_bind_core(profile)
	var positive: float = float(bind_result.data.pitchDegrees)
	for step in range(1, steps + 1):
		var state := await _step(float(scenario.fixedDeltaSeconds), Vector2(0.0, pitch_sign), Vector3.ZERO, 0.0)
		positive = float(state.pitchDegrees)
		if positive_step == null and positive == float(profile.orbit.maximumPitchDegrees):
			positive_step = step
	_bind_core(profile)
	var negative: float = float(bind_result.data.pitchDegrees)
	for step in range(1, steps + 1):
		var state := await _step(float(scenario.fixedDeltaSeconds), Vector2(0.0, -pitch_sign), Vector3.ZERO, 0.0)
		negative = float(state.pitchDegrees)
		if negative_step == null and negative == float(profile.orbit.minimumPitchDegrees):
			negative_step = step
	return {"minimumObservedPitchDegrees": negative, "maximumObservedPitchDegrees": positive, "configuredMinimumPitchDegrees": profile.orbit.minimumPitchDegrees, "configuredMaximumPitchDegrees": profile.orbit.maximumPitchDegrees, "positiveClampReached": positive_step != null, "negativeClampReached": negative_step != null, "stepsToPositiveClamp": positive_step, "stepsToNegativeClamp": negative_step, "physicsSteps": steps, "fixedDeltaSeconds": scenario.fixedDeltaSeconds}

func _recenter(scenario: Dictionary) -> Dictionary:
	var scenario_profile: Dictionary = profile.duplicate(true)
	scenario_profile.orbit.initialYawDegrees = 120.0
	var variant: String = str(scenario.get("variant", "default"))
	if variant == "disabled":
		scenario_profile.recenter.enabled = false
	_bind_core(scenario_profile)
	var state: Dictionary = bind_result.data
	var movement_magnitude: float = maxf(0.0, float(profile.recenter.movementInputThreshold) - 0.01) if variant == "below-threshold" else 1.0
	var manual_orbit := Vector2(1.0, 0.0) if variant == "manual-input" else Vector2.ZERO
	var initial_error := absf(CameraCore.shortest_angle_difference(float(state.yawDegrees), 0.0))
	var previous_yaw := float(state.yawDegrees)
	var start: Variant = null
	var completed: Variant = null
	var maximum_speed := 0.0
	var steps := _steps(scenario)
	for step in range(1, steps + 1):
		state = await _step(float(scenario.fixedDeltaSeconds), manual_orbit, Vector3.FORWARD, movement_magnitude)
		if bool(state.recentering):
			if start == null:
				start = step * float(scenario.fixedDeltaSeconds)
			maximum_speed = maxf(maximum_speed, absf(CameraCore.shortest_angle_difference(previous_yaw, float(state.yawDegrees))) / float(scenario.fixedDeltaSeconds))
		previous_yaw = float(state.yawDegrees)
		if completed == null and start != null and absf(CameraCore.shortest_angle_difference(float(state.yawDegrees), 0.0)) <= ANGLE_TOLERANCE:
			completed = step * float(scenario.fixedDeltaSeconds)
	return {"initialYawErrorDegrees": initial_error, "delaySeconds": profile.recenter.delaySeconds, "recenterStartSeconds": start, "timeToWithinToleranceSeconds": completed, "finalYawErrorDegrees": absf(CameraCore.shortest_angle_difference(float(state.yawDegrees), 0.0)), "maximumAngularSpeedDegreesPerSecond": maximum_speed, "physicsSteps": steps, "fixedDeltaSeconds": scenario.fixedDeltaSeconds}

func _follow(scenario: Dictionary) -> Dictionary:
	_set_wall_enabled(false)
	var scenario_profile: Dictionary = profile.duplicate(true)
	scenario_profile.collision.enabled = false
	_bind_core(scenario_profile)
	var steps := _steps(scenario)
	var movement_steps := floori(steps / 2.0)
	var yaw := float(profile.orbit.initialYawDegrees)
	var state: Dictionary = bind_result.data
	var maximum_error := 0.0
	for index in range(steps):
		if index < movement_steps:
			target.position.x += float(scenario.fixedDeltaSeconds)
		state = await _step(float(scenario.fixedDeltaSeconds), Vector2.ZERO, Vector3.ZERO, 0.0)
		var desired := CameraCore.camera_position_for(target.global_position, yaw, profile)
		maximum_error = maxf(maximum_error, _state_vector(state.cameraPosition).distance_to(desired))
	var final_desired := CameraCore.camera_position_for(target.global_position, yaw, profile)
	return {"durationSeconds": steps * float(scenario.fixedDeltaSeconds), "initialFollowError": 0.0, "maximumFollowError": maximum_error, "finalFollowError": _state_vector(state.cameraPosition).distance_to(final_desired), "finalCameraPosition": _vector(_state_vector(state.cameraPosition)), "finalTargetPosition": _vector(target.position), "physicsSteps": steps, "fixedDeltaSeconds": scenario.fixedDeltaSeconds}

func _collision(scenario: Dictionary) -> Dictionary:
	target.position = Vector3.ZERO
	var desired: float = float(profile.follow.distance)
	var origin := CameraCore.follow_look_at_position(target.global_position, profile)
	var desired_position := CameraCore.camera_position_for(target.global_position, float(profile.orbit.initialYawDegrees), profile)
	var direction := (desired_position - origin).normalized()
	_set_wall_enabled(true)
	wall.global_transform = Transform3D(Basis.looking_at(direction, Vector3.UP), origin + direction * 2.51)
	_bind_core(profile)
	var steps := _steps(scenario)
	var obstruction_steps := maxi(1, floori(steps / 4.0))
	var minimum := desired
	var compressed := desired
	var detected := false
	var state: Dictionary = bind_result.data
	for index in range(steps):
		if index == obstruction_steps:
			_set_wall_enabled(false)
		state = await _step(float(scenario.fixedDeltaSeconds), Vector2.ZERO, Vector3.ZERO, 0.0)
		minimum = minf(minimum, float(state.actualDistance))
		if bool(state.collisionDetected):
			detected = true
			compressed = minf(compressed, float(state.actualDistance))
	return {"desiredDistance": desired, "minimumObservedDistance": minimum, "compressedDistance": compressed, "finalRecoveredDistance": state.actualDistance, "compressionRatio": compressed / desired, "recoveryDurationSeconds": maxf(0.0, (steps - obstruction_steps) * float(scenario.fixedDeltaSeconds)), "physicsSteps": steps, "fixedDeltaSeconds": scenario.fixedDeltaSeconds, "collisionDetected": detected}

func _basis() -> Dictionary:
	var samples := []
	for yaw in [0.0, 90.0, -90.0, 180.0]:
		var scenario_profile: Dictionary = profile.duplicate(true)
		scenario_profile.orbit.initialYawDegrees = yaw
		_bind_core(scenario_profile)
		var forward: Vector3 = bind_result.data.cameraForward
		var right: Vector3 = bind_result.data.cameraRight
		samples.append({"yawDegrees": yaw, "forward": _vector(forward), "right": _vector(right), "orthogonalityDot": forward.dot(right), "forwardMagnitude": forward.length(), "rightMagnitude": right.length()})
	return {"yawRange": "[-180, 180)", "samples": samples}

func _bind_core(value: Dictionary) -> void:
	if core != null:
		core.unbind()
	core = CameraCore.new()
	bind_result = core.bind({"followTarget": target, "rigRoot": rig_root, "yawPivot": yaw_pivot, "pitchPivot": pitch_pivot, "camera": camera, "collisionProbe": collision_probe}, value)

func _step(delta: float, orbit: Vector2, movement_direction: Vector3, movement_magnitude: float) -> Dictionary:
	await get_tree().physics_frame
	var result: Dictionary = core.physics_step(delta, {"orbit": orbit, "movementWorldDirection": movement_direction, "movementMagnitude": movement_magnitude})
	return result.data

func _set_wall_enabled(value: bool) -> void:
	wall.visible = value
	wall.process_mode = Node.PROCESS_MODE_INHERIT if value else Node.PROCESS_MODE_DISABLED
	wall_shape.set_deferred("disabled", not value)

func _steps(scenario: Dictionary) -> int:
	return maxi(0, ceili(float(scenario.durationSeconds) / float(scenario.fixedDeltaSeconds) - EPSILON))

func _state_vector(value: Variant) -> Vector3:
	return value

func _vector(value: Vector3) -> Dictionary:
	return {"x": value.x, "y": value.y, "z": value.z}
