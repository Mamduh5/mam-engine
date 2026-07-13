class_name MovementFixtureBody
extends CharacterBody3D

const MovementCore = preload("res://addons/mam_engine/runtime/mam_movement_core.gd")
const EPSILON := 0.000000000001
var profile: Dictionary
var core: RefCounted

func configure(value: Dictionary) -> void:
	if core != null: core.unbind()
	profile = value; position = Vector3(0, 0.9, 0); velocity = Vector3.ZERO; rotation = Vector3.ZERO
	core = MovementCore.new(); core.bind(self, profile)

func run_scenario(scenario: Dictionary) -> Dictionary:
	match scenario.id:
		"accelerate": return await _accelerate(scenario)
		"stop": return await _stop(scenario)
		"sprint": return await _sprint(scenario)
		"dodge": return await _dodge(scenario)
		"turn": return await _turn(scenario)
	return {}

func _basis(yaw: float) -> Dictionary:
	var basis := Basis(Vector3.UP, deg_to_rad(yaw))
	return {"forward": basis * Vector3.FORWARD, "right": basis * Vector3.RIGHT}
func _fixture_input(move: Vector2, sprint := false, dodge := false) -> Dictionary:
	return {"movement": move, "walk": false, "sprintHeld": sprint, "dodgePressed": dodge}
func _step(delta: float, input: Dictionary, yaw: float) -> Dictionary:
	await get_tree().physics_frame
	return core.physics_step(delta, input, _basis(yaw)).data

func _accelerate(scenario: Dictionary) -> Dictionary:
	var delta := float(scenario.fixedDeltaSeconds); var steps := ceili(float(scenario.durationSeconds) / delta - EPSILON); var start := position; var maximum := 0.0; var time_95: Variant = null; var state := {}
	for step in range(1, steps + 1):
		state = await _step(delta, _fixture_input(Vector2(0, 1)), float(scenario.cameraYawDegrees)); maximum = maxf(maximum, state.horizontalSpeed)
		if time_95 == null and state.horizontalSpeed >= float(profile.ground.runSpeed) * 0.95: time_95 = step * delta
	return _with_position({"durationSeconds": steps * delta, "finalSpeed": state.horizontalSpeed, "maximumObservedSpeed": maximum, "timeToNinetyFivePercentSeconds": time_95, "totalDistance": start.distance_to(position), "physicsSteps": steps})

func _stop(scenario: Dictionary) -> Dictionary:
	var delta := float(scenario.fixedDeltaSeconds)
	while Vector2(velocity.x, velocity.z).length() < float(profile.ground.runSpeed) - EPSILON: await _step(delta, _fixture_input(Vector2(0, 1)), float(scenario.cameraYawDegrees))
	position = Vector3(0, 0.9, 0); var start := position; var max_steps := ceili(float(scenario.durationSeconds) / delta - EPSILON); var stopped: Variant = null; var state := {}; var steps := 0
	for step in range(1, max_steps + 1):
		state = await _step(delta, _fixture_input(Vector2.ZERO), float(scenario.cameraYawDegrees)); steps = step
		if state.horizontalSpeed <= EPSILON: stopped = step * delta; break
	return _with_position({"stoppingTimeSeconds": stopped, "stoppingDistance": start.distance_to(position), "finalSpeed": state.horizontalSpeed, "physicsSteps": steps})

func _sprint(scenario: Dictionary) -> Dictionary:
	var delta := float(scenario.fixedDeltaSeconds)
	while Vector2(velocity.x, velocity.z).length() < float(profile.ground.runSpeed) - EPSILON: await _step(delta, _fixture_input(Vector2(0, 1)), float(scenario.cameraYawDegrees))
	position = Vector3(0, 0.9, 0); var start := position; var steps := ceili(float(scenario.durationSeconds) / delta - EPSILON); var unavailable: Variant = null; var consumed := 0.0; var previous := float(profile.stamina.maximum); var state := {}
	for step in range(1, steps + 1):
		state = await _step(delta, _fixture_input(Vector2(0, 1), true), float(scenario.cameraYawDegrees)); consumed += maxf(0.0, previous - float(state.stamina)); previous = state.stamina
		if unavailable == null and not state.sprinting: unavailable = step * delta
	return _with_position({"durationSeconds": steps * delta, "totalDistance": start.distance_to(position), "finalSpeed": state.horizontalSpeed, "staminaConsumed": consumed, "finalStamina": state.stamina, "timeUntilSprintUnavailableSeconds": unavailable, "physicsSteps": steps})

func _dodge(scenario: Dictionary) -> Dictionary:
	var delta := float(scenario.fixedDeltaSeconds); var steps := ceili(float(profile.dodge.durationSeconds) / delta - EPSILON); var start := position; var state := {}
	for step in range(steps): state = await _step(delta, _fixture_input(Vector2(0, 1), false, step == 0), float(scenario.cameraYawDegrees))
	return _with_position({"configuredDistance": profile.dodge.distance, "simulatedDistance": start.distance_to(position), "durationSeconds": profile.dodge.durationSeconds, "invulnerabilityStartSeconds": profile.dodge.invulnerabilityStartSeconds, "invulnerabilityEndSeconds": profile.dodge.invulnerabilityEndSeconds, "invulnerabilityDurationSeconds": float(profile.dodge.invulnerabilityEndSeconds) - float(profile.dodge.invulnerabilityStartSeconds), "staminaConsumed": profile.dodge.staminaCost, "physicsSteps": steps})

func _turn(scenario: Dictionary) -> Dictionary:
	var delta := float(scenario.fixedDeltaSeconds); var steps := 0; var previous := rotation.y; var maximum := 0.0
	while absf(rad_to_deg(rotation.y) + 90.0) > 0.0001 and steps < 10000:
		await _step(delta, _fixture_input(Vector2(0, 1)), -90.0); steps += 1; maximum = maxf(maximum, absf(rad_to_deg(angle_difference(previous, rotation.y))) / delta); previous = rotation.y
	return _with_position({"targetYawDegrees": 90.0, "finalYawDegrees": absf(rad_to_deg(rotation.y)), "maximumAngularSpeedDegreesPerSecond": maximum, "timeToTargetYawSeconds": steps * delta, "physicsSteps": steps})

func _with_position(metrics: Dictionary) -> Dictionary:
	metrics.finalPosition = {"x": position.x, "y": position.y, "z": position.z}; return metrics
