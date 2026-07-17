extends Node3D

const Loader = preload("res://addons/mam_engine/runtime/mam_runtime_bundle_loader.gd")
const MovementRuntime = preload("res://addons/mam_engine/runtime/mam_movement_runtime.gd")
const CameraLoader = preload("res://addons/mam_engine/runtime/mam_camera_bundle_loader.gd")
const CameraRuntime = preload("res://addons/mam_engine/runtime/mam_camera_runtime.gd")
const TargetingLoader = preload("res://addons/mam_engine/runtime/mam_targeting_bundle_loader.gd")
const TargetingRuntime = preload("res://addons/mam_engine/runtime/mam_targeting_runtime.gd")
const DELTA := 1.0 / 60.0

var body: CharacterBody3D

func _ready() -> void:
	var ground := StaticBody3D.new(); ground.name = "ConsumerGround"; add_child(ground)
	var ground_collision := CollisionShape3D.new(); var ground_shape := BoxShape3D.new(); ground_shape.size = Vector3(40, 1, 40); ground_collision.shape = ground_shape; ground_collision.position.y = -0.5; ground.add_child(ground_collision)
	body = CharacterBody3D.new(); body.name = "ConsumerBody"; body.position.y = 0.9; add_child(body)
	var shape := CollisionShape3D.new(); var capsule := CapsuleShape3D.new(); capsule.height = 1.8; capsule.radius = 0.4; shape.shape = capsule; body.add_child(shape)
	var loaded := Loader.load_bundle()
	if loaded.status != "passed": _write_and_exit(loaded); return
	var camera_loaded := CameraLoader.load_bundle()
	if camera_loaded.status != "passed": _write_and_exit(camera_loaded); return
	var targeting_loaded := TargetingLoader.load_bundle()
	if targeting_loaded.status != "passed": _write_and_exit(targeting_loaded); return
	var runtime := MovementRuntime.new(); var bind := runtime.bind(body, loaded.data.profile)
	var duplicate := MovementRuntime.new().bind(body, loaded.data.profile)
	var incomplete_bind := MovementRuntime.new().bind(body, {})
	var incomplete_step := runtime.physics_step(DELTA, {}, {})
	var forward := {"forward": Vector3.FORWARD, "right": Vector3.RIGHT}
	var state := {}; var acceleration_distance_start := body.position
	for _step in range(60): await get_tree().physics_frame; state = runtime.physics_step(DELTA, _consumer_input(Vector2(0, 1)), forward).data
	var accelerated_speed: float = state.horizontalSpeed; var acceleration_distance := acceleration_distance_start.distance_to(body.position)
	for _step in range(30): await get_tree().physics_frame; state = runtime.physics_step(DELTA, _consumer_input(Vector2.ZERO), forward).data
	var stopped_speed: float = state.horizontalSpeed
	body.position = Vector3(0, 0.9, 0); body.velocity = Vector3.ZERO
	var rotated := {"forward": Vector3.RIGHT, "right": Vector3.BACK}
	for _step in range(30): await get_tree().physics_frame; state = runtime.physics_step(DELTA, _consumer_input(Vector2(0, 1)), rotated).data
	var camera_basis_x := body.position.x
	var sprint_start: float = state.stamina
	for _step in range(60): await get_tree().physics_frame; state = runtime.physics_step(DELTA, _consumer_input(Vector2(0, 1), true), rotated).data
	var sprint_stamina: float = state.stamina; var sprint_speed: float = state.horizontalSpeed
	for _step in range(120): await get_tree().physics_frame; state = runtime.physics_step(DELTA, _consumer_input(Vector2.ZERO), rotated).data
	var regenerated_stamina: float = state.stamina
	runtime.unbind(); body.position = Vector3(0, 0.9, 0); body.velocity = Vector3.ZERO; runtime = MovementRuntime.new(); runtime.bind(body, loaded.data.profile)
	var dodge_start := body.position; var accepted_count := 0; var iframe_observed := false
	for step in range(33):
		await get_tree().physics_frame; state = runtime.physics_step(DELTA, _consumer_input(Vector2(0, 1), false, step < 3), forward).data
		if state.dodgeAccepted: accepted_count += 1
		if state.invulnerable: iframe_observed = true
	var dodge_distance := dodge_start.distance_to(body.position); var unbind := runtime.unbind()
	var camera_proof := await _camera_evidence(camera_loaded.data.profile)
	if camera_proof.status != "passed": _write_and_exit(camera_proof); return
	var targeting_proof := _targeting_evidence(targeting_loaded.data.profile)
	if targeting_proof.status != "passed": _write_and_exit(targeting_proof); return
	var missing := Loader.load_bundle("res://mam_generated/missing.json")
	var invalid_bundle_code := _invalid_bundle_code()
	var missing_camera := CameraLoader.load_bundle("res://mam_generated/missing-camera.json")
	var invalid_camera_bundle_code := _invalid_camera_bundle_code()
	var missing_targeting := TargetingLoader.load_bundle("res://mam_generated/missing-targeting.json")
	var invalid_targeting_bundle_code := _invalid_targeting_bundle_code()
	var data := {"bind": bind.status, "duplicateBind": duplicate.diagnostics[0].code, "incompleteBind": incomplete_bind.diagnostics[0].code, "incompleteStep": incomplete_step.diagnostics[0].code, "acceleratedSpeed": accelerated_speed, "accelerationDistance": acceleration_distance, "stoppedSpeed": stopped_speed, "cameraBasisX": camera_basis_x, "sprintStartStamina": sprint_start, "sprintStamina": sprint_stamina, "sprintSpeed": sprint_speed, "regeneratedStamina": regenerated_stamina, "dodgeDistance": dodge_distance, "dodgeAcceptedCount": accepted_count, "iframeObserved": iframe_observed, "missingBundleCode": missing.diagnostics[0].code, "invalidBundleCode": invalid_bundle_code, "cameraMissingBundleCode": missing_camera.diagnostics[0].code, "cameraInvalidBundleCode": invalid_camera_bundle_code, "targetingMissingBundleCode": missing_targeting.diagnostics[0].code, "targetingInvalidBundleCode": invalid_targeting_bundle_code, "unbind": unbind.status}
	data.merge(camera_proof.data)
	data.merge(targeting_proof.data)
	_write_and_exit({"status": "passed", "data": data, "diagnostics": []})

func _consumer_input(movement: Vector2, sprint := false, dodge := false) -> Dictionary:
	return {"movement": movement, "walk": false, "sprintHeld": sprint, "dodgePressed": dodge}

func _camera_evidence(profile: Dictionary) -> Dictionary:
	var follow_target := Node3D.new(); follow_target.name = "ConsumerCameraTarget"; follow_target.position = Vector3(0, 0.9, 0); add_child(follow_target)
	var rig_root := Node3D.new(); rig_root.name = "ConsumerCameraRig"; add_child(rig_root)
	var yaw_pivot := Node3D.new(); yaw_pivot.name = "ConsumerYawPivot"; rig_root.add_child(yaw_pivot)
	var pitch_pivot := Node3D.new(); pitch_pivot.name = "ConsumerPitchPivot"; yaw_pivot.add_child(pitch_pivot)
	var camera := Camera3D.new(); camera.name = "ConsumerCamera"; pitch_pivot.add_child(camera); camera.current = true
	var collision_probe := ShapeCast3D.new(); collision_probe.name = "ConsumerCameraProbe"; add_child(collision_probe)
	var bindings := {"followTarget": follow_target, "rigRoot": rig_root, "yawPivot": yaw_pivot, "pitchPivot": pitch_pivot, "camera": camera, "collisionProbe": collision_probe}
	var incomplete_bind := CameraRuntime.new().bind({}, profile)
	var camera_runtime := CameraRuntime.new(); var bind_result := camera_runtime.bind(bindings, profile)
	if bind_result.status != "passed": return bind_result
	var lens_applied := absf(camera.fov - float(profile.lens.fieldOfViewDegrees)) <= 0.001 and absf(camera.near - float(profile.lens.nearClipDistance)) <= 0.001 and absf(camera.far - float(profile.lens.farClipDistance)) <= 0.001
	var state: Dictionary = bind_result.data; var initial_yaw: float = state.yawDegrees
	for _step in range(30):
		await get_tree().physics_frame; state = camera_runtime.physics_step(DELTA, _camera_input(Vector2(1, 0))).data
	var orbit_yaw: float = state.yawDegrees
	for _step in range(90):
		await get_tree().physics_frame; state = camera_runtime.physics_step(DELTA, _camera_input(Vector2(0, 1))).data
	var pitch_clamped := absf(float(state.pitchDegrees) - float(profile.orbit.minimumPitchDegrees)) <= 0.001 or absf(float(state.pitchDegrees) - float(profile.orbit.maximumPitchDegrees)) <= 0.001
	var rig_before: Vector3 = rig_root.global_position; follow_target.global_position += Vector3(3, 0, 0)
	for _step in range(60):
		await get_tree().physics_frame; state = camera_runtime.physics_step(DELTA, _camera_input(Vector2.ZERO)).data
	var follow_rig_distance := rig_before.distance_to(rig_root.global_position)
	await get_tree().physics_frame; state = camera_runtime.physics_step(DELTA, _camera_input(Vector2(1, 0), Vector3.FORWARD, 1.0)).data
	var manual_orbit_active: bool = state.manualOrbitActive; var manual_yaw: float = state.yawDegrees; var recenter_delayed := true
	for _step in range(60):
		await get_tree().physics_frame; state = camera_runtime.physics_step(DELTA, _camera_input(Vector2.ZERO, Vector3.FORWARD, 1.0)).data
		if state.recentering: recenter_delayed = false
	var recenter_observed := false
	for _step in range(120):
		await get_tree().physics_frame; state = camera_runtime.physics_step(DELTA, _camera_input(Vector2.ZERO, Vector3.FORWARD, 1.0)).data
		if state.recentering: recenter_observed = true
	var camera_forward: Vector3 = state.cameraForward; var camera_right: Vector3 = state.cameraRight; var unbind_result := camera_runtime.unbind()
	return {"status": "passed", "data": {"cameraLoad": "passed", "cameraBind": bind_result.status, "cameraIncompleteBind": incomplete_bind.diagnostics[0].code, "cameraOrbitYawDelta": absf(_yaw_error(orbit_yaw - initial_yaw)), "cameraPitchClamped": pitch_clamped, "cameraFollowRigDistance": follow_rig_distance, "cameraManualOrbitActive": manual_orbit_active, "cameraRecenterDelayed": recenter_delayed, "cameraRecenterObserved": recenter_observed, "cameraRecenterErrorBefore": _yaw_error(manual_yaw), "cameraRecenterErrorAfter": _yaw_error(state.yawDegrees), "cameraLensApplied": lens_applied, "cameraForwardMagnitude": camera_forward.length(), "cameraRightMagnitude": camera_right.length(), "cameraBasisDot": camera_forward.dot(camera_right), "cameraUnbind": unbind_result.status}, "diagnostics": []}

func _camera_input(orbit: Vector2, movement_direction := Vector3.ZERO, movement_magnitude := 0.0) -> Dictionary:
	return {"orbit": orbit, "movementWorldDirection": movement_direction, "movementMagnitude": movement_magnitude}

func _yaw_error(value: float) -> float:
	return absf(fposmod(value + 180.0, 360.0) - 180.0)

func _targeting_evidence(profile: Dictionary) -> Dictionary:
	var incomplete_bind := TargetingRuntime.new().bind({})
	var runtime := TargetingRuntime.new(); var bind_result := runtime.bind(profile)
	if bind_result.status != "passed": return bind_result
	var alpha := _target_candidate("alpha", Vector3(0, 0, -10), true, true, 0.5)
	var zeta := _target_candidate("zeta", Vector3(0, 0, -10), true, true, 0.5)
	var left := _target_candidate("left", Vector3(-3.420201, 0, -9.396926), true, true, 0.5)
	var original := [zeta.duplicate(true), alpha.duplicate(true), left.duplicate(true)]
	var candidates := original.duplicate(true)
	var acquired: Dictionary = runtime.physics_step(DELTA, _targeting_input(candidates, true)).data
	runtime.clear_target()
	var reordered: Dictionary = runtime.physics_step(DELTA, _targeting_input([left.duplicate(true), alpha.duplicate(true), zeta.duplicate(true)], true)).data
	var retained_candidates := [alpha.duplicate(true), zeta.duplicate(true), left.duplicate(true)]
	retained_candidates[0].position = Vector3(-29.908157, 0, -13.946405); retained_candidates[0].aimPosition = retained_candidates[0].position
	var retained: Dictionary = runtime.physics_step(DELTA, _targeting_input(retained_candidates)).data
	retained_candidates[0].visible = false
	var grace: Dictionary = runtime.physics_step(DELTA, _targeting_input(retained_candidates)).data
	retained_candidates[0].visible = true
	var grace_cleared: Dictionary = runtime.physics_step(DELTA, _targeting_input(retained_candidates)).data
	var switch_candidates := [alpha.duplicate(true), zeta.duplicate(true), left.duplicate(true)]; switch_candidates[1].targetable = false
	var switched: Dictionary = runtime.physics_step(DELTA, _targeting_input(switch_candidates, false, false, Vector2(-1, 0))).data
	var cooldown: Dictionary = runtime.physics_step(DELTA, _targeting_input(switch_candidates, false, false, Vector2(1, 0))).data
	var unlocked: Dictionary = runtime.physics_step(DELTA, _targeting_input(switch_candidates, false, true)).data
	var malformed: Dictionary = runtime.physics_step(DELTA, _targeting_input([alpha, alpha], false))
	var candidates_unchanged := original == candidates
	var unbind_result := runtime.unbind()
	return {"status": "passed", "data": {"targetingLoad": "passed", "targetingBind": bind_result.status, "targetingIncompleteBind": incomplete_bind.diagnostics[0].code, "targetingAcquiredId": acquired.targetId, "targetingReorderedTieId": reordered.targetId, "targetingRetained": retained.targetId == "alpha", "targetingGraceObserved": grace.withinGracePeriod, "targetingGraceCleared": not grace_cleared.withinGracePeriod and grace_cleared.targetId == "alpha", "targetingSwitchedId": switched.targetId, "targetingCooldownRejected": not cooldown.switchedThisStep and cooldown.switchReason == "cooldown_active", "targetingUnlock": not unlocked.locked and unlocked.lostThisStep, "targetingMalformedInputCode": malformed.diagnostics[0].code, "targetingCandidatesUnchanged": candidates_unchanged, "targetingUnbind": unbind_result.status}, "diagnostics": []}

func _target_candidate(id: String, aim_position: Vector3, targetable: bool, visible: bool, priority: float) -> Dictionary:
	return {"id": id, "position": aim_position, "aimPosition": aim_position, "targetable": targetable, "visible": visible, "priority": priority}

func _targeting_input(candidates: Array, lock_requested := false, unlock_requested := false, switch_direction := Vector2.ZERO) -> Dictionary:
	return {"origin": Vector3.ZERO, "cameraForward": Vector3.FORWARD, "cameraRight": Vector3.RIGHT, "cameraUp": Vector3.UP, "candidates": candidates, "lockRequested": lock_requested, "unlockRequested": unlock_requested, "switchDirection": switch_direction}

func _invalid_bundle_code() -> String:
	var source := FileAccess.open("res://mam_generated/mam_runtime_bundle.json", FileAccess.READ)
	var value: Dictionary = JSON.parse_string(source.get_as_text()); source.close()
	value.payloadJson += " "
	var tampered := FileAccess.open("res://mam_generated/tampered.json", FileAccess.WRITE); tampered.store_string(JSON.stringify(value)); tampered.close()
	var result := Loader.load_bundle("res://mam_generated/tampered.json")
	DirAccess.remove_absolute(ProjectSettings.globalize_path("res://mam_generated/tampered.json"))
	return result.diagnostics[0].code

func _invalid_camera_bundle_code() -> String:
	var source := FileAccess.open("res://mam_generated/mam_camera_runtime_bundle.json", FileAccess.READ)
	var value: Dictionary = JSON.parse_string(source.get_as_text()); source.close()
	value.payloadJson += " "
	var tampered := FileAccess.open("res://mam_generated/tampered-camera.json", FileAccess.WRITE); tampered.store_string(JSON.stringify(value)); tampered.close()
	var result := CameraLoader.load_bundle("res://mam_generated/tampered-camera.json")
	DirAccess.remove_absolute(ProjectSettings.globalize_path("res://mam_generated/tampered-camera.json"))
	return result.diagnostics[0].code

func _invalid_targeting_bundle_code() -> String:
	var source := FileAccess.open("res://mam_generated/mam_targeting_runtime_bundle.json", FileAccess.READ)
	var value: Dictionary = JSON.parse_string(source.get_as_text()); source.close()
	value.payloadJson += " "
	var tampered := FileAccess.open("res://mam_generated/tampered-targeting.json", FileAccess.WRITE); tampered.store_string(JSON.stringify(value)); tampered.close()
	var result := TargetingLoader.load_bundle("res://mam_generated/tampered-targeting.json")
	DirAccess.remove_absolute(ProjectSettings.globalize_path("res://mam_generated/tampered-targeting.json"))
	return result.diagnostics[0].code

func _write_and_exit(result: Dictionary) -> void:
	var output := ""
	var arguments := OS.get_cmdline_user_args()
	for index in range(arguments.size() - 1):
		if arguments[index] == "--result": output = arguments[index + 1]
	var file := FileAccess.open(output, FileAccess.WRITE)
	if file != null: file.store_string(JSON.stringify(result) + "\n")
	get_tree().quit(0 if file != null else 2)
