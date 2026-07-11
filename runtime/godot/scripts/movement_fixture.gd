class_name MovementFixtureBody
extends CharacterBody3D

var profile: Dictionary
const EPSILON := 0.000000000001

func configure(value: Dictionary) -> void:
	profile = value
	position = Vector3(0, 0.9, 0)
	velocity = Vector3.ZERO
	rotation = Vector3.ZERO

func run_scenario(scenario: Dictionary) -> Dictionary:
	match scenario.id:
		"accelerate": return await _accelerate(scenario)
		"stop": return await _stop(scenario)
		"sprint": return await _sprint(scenario)
		"dodge": return await _dodge(scenario)
		"turn": return await _turn(scenario)
	return {}

func _direction(camera_yaw_degrees: float) -> Vector3:
	return Basis(Vector3.UP, deg_to_rad(camera_yaw_degrees)) * Vector3.FORWARD

func _move_horizontal(direction: Vector3, speed: float, delta: float) -> void:
	velocity.x = direction.x * speed
	velocity.z = direction.z * speed
	velocity.y = 0.0
	if direction.length_squared() > EPSILON:
		var target_yaw := atan2(-direction.x, -direction.z)
		rotation.y = rotate_toward(rotation.y, target_yaw, deg_to_rad(float(profile.ground.rotationSpeedDegrees)) * delta)
	move_and_slide()

func _accelerate(scenario: Dictionary) -> Dictionary:
	var steps := ceili(float(scenario.durationSeconds) / float(scenario.fixedDeltaSeconds) - EPSILON)
	var speed := 0.0
	var distance := 0.0
	var maximum_speed := 0.0
	var time_to_ninety_five: Variant = null
	var direction := _direction(float(scenario.cameraYawDegrees))
	for step in range(1, steps + 1):
		await get_tree().physics_frame
		speed = min(float(profile.ground.runSpeed), speed + float(profile.ground.acceleration) * float(scenario.fixedDeltaSeconds))
		distance += speed * float(scenario.fixedDeltaSeconds)
		maximum_speed = max(maximum_speed, speed)
		if time_to_ninety_five == null and speed >= float(profile.ground.runSpeed) * 0.95:
			time_to_ninety_five = step * float(scenario.fixedDeltaSeconds)
		_move_horizontal(direction, speed, float(scenario.fixedDeltaSeconds))
	return _with_position({"durationSeconds": steps * float(scenario.fixedDeltaSeconds), "finalSpeed": speed, "maximumObservedSpeed": maximum_speed, "timeToNinetyFivePercentSeconds": time_to_ninety_five, "totalDistance": distance, "physicsSteps": steps})

func _stop(scenario: Dictionary) -> Dictionary:
	var maximum_steps := ceili(float(scenario.durationSeconds) / float(scenario.fixedDeltaSeconds) - EPSILON)
	var speed: float = float(profile.ground.runSpeed)
	var distance := 0.0
	var stopping_time: Variant = null
	var steps := 0
	var direction := _direction(float(scenario.cameraYawDegrees))
	for step in range(1, maximum_steps + 1):
		await get_tree().physics_frame
		speed = max(0.0, speed - float(profile.ground.deceleration) * float(scenario.fixedDeltaSeconds))
		distance += speed * float(scenario.fixedDeltaSeconds)
		steps = step
		_move_horizontal(direction, speed, float(scenario.fixedDeltaSeconds))
		if speed == 0.0:
			stopping_time = step * float(scenario.fixedDeltaSeconds)
			break
	return _with_position({"stoppingTimeSeconds": stopping_time, "stoppingDistance": distance, "finalSpeed": speed, "physicsSteps": steps})

func _sprint(scenario: Dictionary) -> Dictionary:
	var steps := ceili(float(scenario.durationSeconds) / float(scenario.fixedDeltaSeconds) - EPSILON)
	var speed: float = float(profile.ground.runSpeed)
	var stamina: float = float(profile.stamina.maximum)
	var distance := 0.0
	var consumed := 0.0
	var unavailable: Variant = null
	var sprinting: bool = stamina >= float(profile.stamina.minimumToStartSprint)
	var time_since_sprint := 0.0
	var direction := _direction(float(scenario.cameraYawDegrees))
	for step in range(1, steps + 1):
		await get_tree().physics_frame
		if sprinting:
			var cost: float = min(stamina, float(profile.stamina.sprintCostPerSecond) * float(scenario.fixedDeltaSeconds))
			stamina -= cost; consumed += cost; time_since_sprint = 0.0
			if stamina <= EPSILON and float(profile.stamina.sprintCostPerSecond) > 0.0:
				stamina = 0.0; sprinting = false
				if unavailable == null: unavailable = step * float(scenario.fixedDeltaSeconds)
		else:
			time_since_sprint += float(scenario.fixedDeltaSeconds)
			if time_since_sprint >= float(profile.stamina.regenerationDelaySeconds): stamina = min(float(profile.stamina.maximum), stamina + float(profile.stamina.regenerationPerSecond) * float(scenario.fixedDeltaSeconds))
			if stamina >= float(profile.stamina.minimumToStartSprint): sprinting = true
		var target: float = float(profile.ground.sprintSpeed) if sprinting else float(profile.ground.runSpeed)
		var rate: float = float(profile.ground.acceleration) if target >= speed else float(profile.ground.deceleration)
		speed = min(target, speed + rate * float(scenario.fixedDeltaSeconds)) if target >= speed else max(target, speed - rate * float(scenario.fixedDeltaSeconds))
		distance += speed * float(scenario.fixedDeltaSeconds)
		_move_horizontal(direction, speed, float(scenario.fixedDeltaSeconds))
	return _with_position({"durationSeconds": steps * float(scenario.fixedDeltaSeconds), "totalDistance": distance, "finalSpeed": speed, "staminaConsumed": consumed, "finalStamina": stamina, "timeUntilSprintUnavailableSeconds": unavailable, "physicsSteps": steps})

func _dodge(scenario: Dictionary) -> Dictionary:
	var steps := ceili(float(profile.dodge.durationSeconds) / float(scenario.fixedDeltaSeconds) - EPSILON)
	var elapsed := 0.0
	var distance := 0.0
	var speed: float = float(profile.dodge.distance) / float(profile.dodge.durationSeconds)
	var direction := _direction(float(scenario.cameraYawDegrees))
	for _step in range(steps):
		await get_tree().physics_frame
		var delta: float = min(float(scenario.fixedDeltaSeconds), float(profile.dodge.durationSeconds) - elapsed)
		var desired_direction := _direction(float(scenario.cameraYawDegrees))
		direction = direction.lerp(desired_direction, float(profile.dodge.steeringMultiplier)).normalized()
		distance += speed * delta; elapsed += delta
		_move_horizontal(direction, speed * delta / float(scenario.fixedDeltaSeconds), float(scenario.fixedDeltaSeconds))
	return _with_position({"configuredDistance": profile.dodge.distance, "simulatedDistance": distance, "durationSeconds": profile.dodge.durationSeconds, "invulnerabilityStartSeconds": profile.dodge.invulnerabilityStartSeconds, "invulnerabilityEndSeconds": profile.dodge.invulnerabilityEndSeconds, "invulnerabilityDurationSeconds": float(profile.dodge.invulnerabilityEndSeconds) - float(profile.dodge.invulnerabilityStartSeconds), "staminaConsumed": profile.dodge.staminaCost, "physicsSteps": steps})

func _turn(scenario: Dictionary) -> Dictionary:
	var target := 90.0
	var yaw := 0.0
	var steps := 0
	var maximum_angular_speed := 0.0
	var maximum_step: float = float(profile.ground.rotationSpeedDegrees) * float(scenario.fixedDeltaSeconds)
	while yaw < target and steps < 10000:
		await get_tree().physics_frame
		var change: float = min(maximum_step, target - yaw)
		yaw += change; steps += 1
		maximum_angular_speed = max(maximum_angular_speed, change / float(scenario.fixedDeltaSeconds))
		rotation.y = deg_to_rad(yaw)
	return _with_position({"targetYawDegrees": target, "finalYawDegrees": yaw, "maximumAngularSpeedDegreesPerSecond": maximum_angular_speed, "timeToTargetYawSeconds": steps * float(scenario.fixedDeltaSeconds), "physicsSteps": steps})

func _with_position(metrics: Dictionary) -> Dictionary:
	metrics.finalPosition = {"x": position.x, "y": position.y, "z": position.z}
	return metrics
