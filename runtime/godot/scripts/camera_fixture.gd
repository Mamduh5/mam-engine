extends Node3D

const EPSILON := 0.000000000001
const ANGLE_TOLERANCE := 0.25
var profile: Dictionary
@onready var target: Node3D = $Target
@onready var yaw_pivot: Node3D = $FollowAnchor/YawPivot
@onready var pitch_pivot: Node3D = $FollowAnchor/YawPivot/PitchPivot
@onready var collision_probe: ShapeCast3D = $CollisionProbe
@onready var camera: Camera3D = $FollowAnchor/YawPivot/PitchPivot/Camera3D
@onready var wall: StaticBody3D = $CollisionWall

func configure(value: Dictionary) -> void:
	profile = value
	target.position = Vector3.ZERO
	yaw_pivot.rotation.y = deg_to_rad(float(profile.orbit.initialYawDegrees))
	pitch_pivot.rotation.x = deg_to_rad(float(profile.orbit.initialPitchDegrees))
	camera.fov = float(profile.lens.fieldOfViewDegrees)
	camera.near = float(profile.lens.nearClipDistance)
	camera.far = float(profile.lens.farClipDistance)
	var sphere := SphereShape3D.new()
	sphere.radius = float(profile.collision.probeRadius)
	collision_probe.shape = sphere
	collision_probe.enabled = true
	wall.visible = true
	wall.process_mode = Node.PROCESS_MODE_INHERIT

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
	var steps := _steps(scenario)
	var yaw: float = float(profile.orbit.initialYawDegrees)
	var pitch: float = float(profile.orbit.initialPitchDegrees)
	var yaw_travel := 0.0
	var pitch_travel := 0.0
	var yaw_rate: float = float(profile.orbit.yawSpeedDegreesPerSecond) * (-1.0 if profile.orbit.invertYaw else 1.0)
	var pitch_rate: float = float(profile.orbit.pitchSpeedDegreesPerSecond) * 0.5 * (-1.0 if profile.orbit.invertPitch else 1.0)
	for _index in range(steps):
		await get_tree().physics_frame
		var yaw_change: float = yaw_rate * float(scenario.fixedDeltaSeconds)
		var next_pitch: float = clampf(pitch + pitch_rate * float(scenario.fixedDeltaSeconds), float(profile.orbit.minimumPitchDegrees), float(profile.orbit.maximumPitchDegrees))
		yaw = _normalize_yaw(yaw + yaw_change); yaw_travel += yaw_change; pitch_travel += next_pitch - pitch; pitch = next_pitch
		yaw_pivot.rotation.y = deg_to_rad(yaw); pitch_pivot.rotation.x = deg_to_rad(pitch)
	return {"durationSeconds": steps * float(scenario.fixedDeltaSeconds), "initialYawDegrees": profile.orbit.initialYawDegrees, "finalYawDegrees": yaw, "totalYawTravelDegrees": yaw_travel, "initialPitchDegrees": profile.orbit.initialPitchDegrees, "finalPitchDegrees": pitch, "totalPitchTravelDegrees": pitch_travel, "physicsSteps": steps, "fixedDeltaSeconds": scenario.fixedDeltaSeconds}

func _pitch_clamp(scenario: Dictionary) -> Dictionary:
	var steps := _steps(scenario); var positive: float = float(profile.orbit.initialPitchDegrees); var negative: float = positive; var positive_step: Variant = null; var negative_step: Variant = null
	for step in range(1, steps + 1):
		await get_tree().physics_frame
		positive = clampf(positive + float(profile.orbit.pitchSpeedDegreesPerSecond) * float(scenario.fixedDeltaSeconds), float(profile.orbit.minimumPitchDegrees), float(profile.orbit.maximumPitchDegrees))
		negative = clampf(negative - float(profile.orbit.pitchSpeedDegreesPerSecond) * float(scenario.fixedDeltaSeconds), float(profile.orbit.minimumPitchDegrees), float(profile.orbit.maximumPitchDegrees))
		if float(profile.orbit.maximumPitchDegrees) - positive <= 0.000000001: positive = float(profile.orbit.maximumPitchDegrees)
		if negative - float(profile.orbit.minimumPitchDegrees) <= 0.000000001: negative = float(profile.orbit.minimumPitchDegrees)
		if positive_step == null and positive == float(profile.orbit.maximumPitchDegrees): positive_step = step
		if negative_step == null and negative == float(profile.orbit.minimumPitchDegrees): negative_step = step
	return {"minimumObservedPitchDegrees": negative, "maximumObservedPitchDegrees": positive, "configuredMinimumPitchDegrees": profile.orbit.minimumPitchDegrees, "configuredMaximumPitchDegrees": profile.orbit.maximumPitchDegrees, "positiveClampReached": positive_step != null, "negativeClampReached": negative_step != null, "stepsToPositiveClamp": positive_step, "stepsToNegativeClamp": negative_step, "physicsSteps": steps, "fixedDeltaSeconds": scenario.fixedDeltaSeconds}

func _recenter(scenario: Dictionary) -> Dictionary:
	var movement_yaw := 0.0; var yaw := 120.0; var idle := 0.0; var start: Variant = null; var completed: Variant = null; var maximum_speed := 0.0; var steps := _steps(scenario)
	var variant: String = str(scenario.get("variant", "default")); var enabled: bool = bool(profile.recenter.enabled) and variant != "disabled"; var movement_magnitude: float = float(profile.recenter.movementInputThreshold) - 0.01 if variant == "below-threshold" else 1.0; var manual_input := 1.0 if variant == "manual-input" else 0.0
	for step in range(1, steps + 1):
		await get_tree().physics_frame
		if abs(manual_input) > EPSILON:
			yaw = _normalize_yaw(yaw + manual_input * float(profile.orbit.yawSpeedDegreesPerSecond) * float(scenario.fixedDeltaSeconds) * (-1.0 if profile.orbit.invertYaw else 1.0)); idle = 0.0; continue
		idle += float(scenario.fixedDeltaSeconds)
		if not enabled or movement_magnitude < float(profile.recenter.movementInputThreshold) or idle + EPSILON < float(profile.recenter.delaySeconds): continue
		if start == null: start = step * float(scenario.fixedDeltaSeconds)
		var difference := _angle_difference(yaw, movement_yaw); var change: float = signf(difference) * minf(absf(difference), float(profile.recenter.yawSpeedDegreesPerSecond) * float(scenario.fixedDeltaSeconds))
		yaw = _normalize_yaw(yaw + change); maximum_speed = maxf(maximum_speed, absf(change) / float(scenario.fixedDeltaSeconds))
		if completed == null and absf(_angle_difference(yaw, movement_yaw)) <= ANGLE_TOLERANCE: completed = step * float(scenario.fixedDeltaSeconds)
	return {"initialYawErrorDegrees": 120.0, "delaySeconds": profile.recenter.delaySeconds, "recenterStartSeconds": start, "timeToWithinToleranceSeconds": completed, "finalYawErrorDegrees": absf(_angle_difference(yaw, movement_yaw)), "maximumAngularSpeedDegreesPerSecond": maximum_speed, "physicsSteps": steps, "fixedDeltaSeconds": scenario.fixedDeltaSeconds}

func _follow(scenario: Dictionary) -> Dictionary:
	var steps := _steps(scenario); var movement_steps := floori(steps / 2.0); var offset := Vector3(float(profile.follow.shoulderOffset), float(profile.follow.height), -float(profile.follow.distance)); var target_position := Vector3.ZERO; var camera_position := offset; var maximum_error := 0.0; var orientation_yaw := 0.0
	for index in range(steps):
		await get_tree().physics_frame
		if index < movement_steps: target_position.x += float(scenario.fixedDeltaSeconds)
		var desired := target_position + offset; camera_position = _smooth_vector(camera_position, desired, float(scenario.fixedDeltaSeconds), float(profile.follow.positionHalfLifeSeconds)); maximum_error = maxf(maximum_error, camera_position.distance_to(desired))
		orientation_yaw = _smooth_angle(orientation_yaw, 0.0, float(scenario.fixedDeltaSeconds), float(profile.follow.rotationHalfLifeSeconds)); yaw_pivot.rotation.y = deg_to_rad(orientation_yaw)
		target.position = target_position; camera.global_position = camera_position
	var final_desired := target_position + offset
	return {"durationSeconds": steps * float(scenario.fixedDeltaSeconds), "initialFollowError": 0.0, "maximumFollowError": maximum_error, "finalFollowError": camera_position.distance_to(final_desired), "finalCameraPosition": _vector(camera_position), "finalTargetPosition": _vector(target_position), "physicsSteps": steps, "fixedDeltaSeconds": scenario.fixedDeltaSeconds}

func _collision(scenario: Dictionary) -> Dictionary:
	var steps := _steps(scenario); var obstruction_steps := maxi(1, floori(steps / 4.0)); var desired: float = float(profile.follow.distance); var distance := desired; var minimum := desired; var compressed := desired; var detected := false
	var origin := Vector3(0.0, float(profile.follow.lookAtHeight), 0.0); var desired_position := Vector3(float(profile.follow.shoulderOffset), float(profile.follow.height), -desired); var direction := (desired_position - origin).normalized()
	wall.global_transform = Transform3D(Basis.looking_at(direction, Vector3.UP), origin + direction * 2.51)
	collision_probe.global_position = origin; collision_probe.target_position = direction * desired
	for index in range(steps):
		await get_tree().physics_frame
		if index == obstruction_steps: wall.process_mode = Node.PROCESS_MODE_DISABLED; $CollisionWall/CollisionShape3D.disabled = true
		if bool(profile.collision.enabled) and index < obstruction_steps:
			collision_probe.force_shapecast_update()
			if collision_probe.is_colliding():
				detected = true
				var hit_distance: float = origin.distance_to(collision_probe.get_collision_point(0)) - float(profile.collision.probeRadius)
				distance = maxf(float(profile.collision.minimumDistance), minf(desired, hit_distance)); compressed = distance
		else:
			distance = _smooth_scalar(distance, desired, float(scenario.fixedDeltaSeconds), float(profile.collision.returnHalfLifeSeconds)) if bool(profile.collision.enabled) else desired
		minimum = minf(minimum, distance); camera.global_position = origin + direction * distance
	return {"desiredDistance": desired, "minimumObservedDistance": minimum, "compressedDistance": compressed, "finalRecoveredDistance": distance, "compressionRatio": compressed / desired, "recoveryDurationSeconds": maxf(0.0, (steps - obstruction_steps) * float(scenario.fixedDeltaSeconds)), "physicsSteps": steps, "fixedDeltaSeconds": scenario.fixedDeltaSeconds, "collisionDetected": detected}

func _basis() -> Dictionary:
	var samples := []
	for yaw in [0.0, 90.0, -90.0, 180.0]:
		var radians := deg_to_rad(yaw); var forward := Vector3(-sin(radians), 0.0, -cos(radians)); var right := Vector3(cos(radians), 0.0, -sin(radians))
		samples.append({"yawDegrees": yaw, "forward": _vector(forward), "right": _vector(right), "orthogonalityDot": forward.dot(right), "forwardMagnitude": forward.length(), "rightMagnitude": right.length()})
	return {"yawRange": "[-180, 180)", "samples": samples}

func _steps(scenario: Dictionary) -> int: return maxi(0, ceili(float(scenario.durationSeconds) / float(scenario.fixedDeltaSeconds) - EPSILON))
func _remaining(delta: float, half_life: float) -> float: return 0.0 if half_life == 0.0 else pow(2.0, -delta / half_life)
func _smooth_scalar(current: float, target_value: float, delta: float, half_life: float) -> float: return target_value + (current - target_value) * _remaining(delta, half_life)
func _smooth_vector(current: Vector3, target_value: Vector3, delta: float, half_life: float) -> Vector3: return target_value + (current - target_value) * _remaining(delta, half_life)
func _smooth_angle(current: float, target_value: float, delta: float, half_life: float) -> float: return _normalize_yaw(target_value - _angle_difference(current, target_value) * _remaining(delta, half_life))
func _normalize_yaw(value: float) -> float: return fmod(fmod(value + 180.0, 360.0) + 360.0, 360.0) - 180.0
func _angle_difference(current: float, target_value: float) -> float: return _normalize_yaw(target_value - current)
func _vector(value: Vector3) -> Dictionary: return {"x": value.x, "y": value.y, "z": value.z}
