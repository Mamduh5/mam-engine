extends Node3D

const EPSILON := 0.000000000001
const TIE_EPSILON := 0.000000001
var targeting: Dictionary
var camera_profile: Dictionary
var candidates: Dictionary = {}
var walls: Dictionary = {}
var markers: Dictionary = {}
@onready var camera: Camera3D = $Camera3D

func configure(targeting_value: Dictionary, camera_value: Dictionary) -> void:
	targeting = targeting_value; camera_profile = camera_value
	camera.fov = float(camera_profile.lens.fieldOfViewDegrees); camera.near = float(camera_profile.lens.nearClipDistance); camera.far = float(camera_profile.lens.farClipDistance)

func run_scenario(plan: Dictionary) -> Dictionary:
	_setup_candidates(plan.candidates)
	await get_tree().physics_frame
	var steps := maxi(1, ceili(float(plan.durationSeconds) / float(plan.fixedDeltaSeconds) - EPSILON)); var delta := float(plan.fixedDeltaSeconds)
	var state := {"target": plan.initialTargetId, "selected": plan.initialTargetId, "cooldown": float(plan.initialSwitchCooldownSeconds), "invalid_elapsed": 0.0, "grace_start": null, "grace_expiry": null, "release_step": null, "reacquired": null, "tie": null}
	var target_history: Array = [{"step": 0, "targetId": state.target}]; var switch_requests: Array = []
	var camera_yaw := float(camera_profile.orbit.initialYawDegrees); var camera_pitch := float(camera_profile.orbit.initialPitchDegrees); var camera_position := _boom(_vec(plan.origin), camera_yaw)
	var initial_yaw := camera_yaw; var initial_pitch := camera_pitch; var framing_steps := 0; var initial_error: Variant = null; var maximum_error := 0.0; var final_error: Variant = null; var framing_point: Variant = null; var selected_point: Variant = null; var framing_history: Array = []; var release_camera: Variant = null; var latest_evaluations: Array = []
	for step in range(1, steps + 1):
		var events: Array = []
		for event in plan.events:
			if int(event.step) == step: events.append(event)
		for event in events: _apply_event(event)
		_update_geometry()
		await get_tree().physics_frame
		state.cooldown = maxf(0.0, float(state.cooldown) - delta)
		latest_evaluations = _evaluate_all(plan, str(state.target) if state.target != null else "", false)
		if state.target != null:
			var current_eval: Variant = _evaluation_for(str(state.target), plan, true)
			if current_eval != null and bool(current_eval.eligible): state.invalid_elapsed = 0.0; state.grace_start = null
			else:
				if state.grace_start == null: state.grace_start = step
				state.invalid_elapsed = float(state.invalid_elapsed) + delta
				if float(targeting.retention.lostTargetGraceSeconds) == 0.0 or float(state.invalid_elapsed) + EPSILON >= float(targeting.retention.lostTargetGraceSeconds):
					state.grace_expiry = step; state.release_step = step; _set_target(state, null, step, target_history)
					if bool(targeting.retention.autoReacquire):
						var acquisition := _acquire(plan); state.tie = acquisition.tieBreakResult; state.reacquired = acquisition.selectedTargetId
						if state.reacquired != null: _set_target(state, state.reacquired, step, target_history)
					release_camera = {"position": camera_position, "yaw": camera_yaw, "pitch": camera_pitch}
		for event in events:
			if event.type == "request-acquire" and state.target == null:
				var acquisition := _acquire(plan); state.tie = acquisition.tieBreakResult; state.selected = acquisition.selectedTargetId
				if state.selected != null: _set_target(state, state.selected, step, target_history)
		for event in events:
			if event.type == "request-switch":
				var before := float(state.cooldown); var switched := _switch(plan, str(state.target) if state.target != null else "", str(event.direction), before)
				if bool(switched.switched): _set_target(state, switched.targetId, step, target_history); state.selected = switched.targetId; state.cooldown = float(targeting.switching.cooldownSeconds)
				switch_requests.append({"direction": event.direction, "requestStep": step, "requestTimeSeconds": step * delta, "switched": switched.switched, "reason": switched.reason, "cooldownBeforeSeconds": before, "cooldownAfterSeconds": state.cooldown, "successfulSwitchStep": step if switched.switched else null, "successfulSwitchTimeSeconds": step * delta if switched.switched else null})
		if state.target != null and candidates.has(str(state.target)):
			framing_steps += 1; framing_history.append({"step": step, "targetId": state.target})
			var target_point: Vector3 = _vec(candidates[str(state.target)].targetPoint); framing_point = (_vec(plan.origin) + Vector3(0.0, float(camera_profile.follow.lookAtHeight), 0.0) + target_point) * 0.5; selected_point = target_point
			var desired_yaw := _yaw(target_point - _vec(plan.origin)); var desired_position := _boom(_vec(plan.origin), desired_yaw); camera_position = _smooth_vector(camera_position, desired_position, delta, float(camera_profile.follow.positionHalfLifeSeconds))
			var desired_direction: Vector3 = framing_point - camera_position; var desired_orientation_yaw := _yaw(desired_direction); var desired_pitch := clampf(-rad_to_deg(atan2(desired_direction.y, Vector2(desired_direction.x, desired_direction.z).length())), float(camera_profile.orbit.minimumPitchDegrees), float(camera_profile.orbit.maximumPitchDegrees)); var error_before := _angular_error(camera_yaw, camera_pitch, desired_direction)
			if initial_error == null: initial_error = error_before
			maximum_error = maxf(maximum_error, error_before); camera_yaw = _smooth_yaw(camera_yaw, desired_orientation_yaw, delta, float(camera_profile.follow.rotationHalfLifeSeconds)); camera_pitch = _smooth_scalar(camera_pitch, desired_pitch, delta, float(camera_profile.follow.rotationHalfLifeSeconds)); final_error = _angular_error(camera_yaw, camera_pitch, desired_direction); camera.position = camera_position
	var final_evaluations := _evaluate_all(plan, str(state.target) if state.target != null else "", false); latest_evaluations = final_evaluations
	var post_translation := 0.0; var post_angular := 0.0
	if release_camera != null: post_translation = camera_position.distance_to(release_camera.position); post_angular = Vector2(_angle_difference(float(release_camera.yaw), camera_yaw), camera_pitch - float(release_camera.pitch)).length()
	return _deep_round({"initialTargetId": plan.initialTargetId, "selectedTargetId": state.selected, "finalTargetId": state.target, "targetIdHistory": target_history, "lockState": "unlocked" if state.target == null else "locked", "tieBreakResult": state.tie, "candidateEvaluations": latest_evaluations, "graceStartStep": state.grace_start, "graceStartTimeSeconds": null if state.grace_start == null else int(state.grace_start) * delta, "graceExpiryStep": state.grace_expiry, "graceExpiryTimeSeconds": null if state.grace_expiry == null else int(state.grace_expiry) * delta, "releaseStep": state.release_step, "releaseTimeSeconds": null if state.release_step == null else int(state.release_step) * delta, "reacquiredTargetId": state.reacquired, "autoReacquire": targeting.retention.autoReacquire, "switchRequests": switch_requests, "framingActive": state.target != null, "framingActivePhysicsSteps": framing_steps, "framingTargetIdHistory": framing_history, "initialCameraYawDegrees": initial_yaw, "finalCameraYawDegrees": camera_yaw, "initialCameraPitchDegrees": initial_pitch, "finalCameraPitchDegrees": camera_pitch, "initialFramingAngularErrorDegrees": initial_error, "maximumFramingAngularErrorDegrees": maximum_error, "finalFramingAngularErrorDegrees": final_error, "finalCameraPosition": _dict(camera_position), "finalFramingPoint": null if framing_point == null else _dict(framing_point), "finalSelectedTargetPoint": null if selected_point == null else _dict(selected_point), "cameraTranslationAfterRelease": post_translation, "cameraAngularMovementAfterReleaseDegrees": post_angular, "physicsSteps": steps, "fixedDeltaSeconds": delta, "lens": {"fieldOfViewDegrees": camera.fov, "nearClipDistance": camera.near, "farClipDistance": camera.far}})

func _setup_candidates(values: Array) -> void:
	for value in values:
		candidates[str(value.id)] = value.duplicate(true)
		var marker := Node3D.new(); marker.name = "Target_" + str(value.id); marker.position = _vec(value.targetPoint); var mesh_instance := MeshInstance3D.new(); var mesh := SphereMesh.new(); mesh.radius = 0.3; mesh.height = 0.6; mesh_instance.mesh = mesh; marker.add_child(mesh_instance); add_child(marker); markers[str(value.id)] = marker
		var body := StaticBody3D.new(); body.name = "Wall_" + str(value.id); body.collision_layer = 2; body.collision_mask = 0; body.set_meta("target_id", str(value.id)); var shape_node := CollisionShape3D.new(); var shape := BoxShape3D.new(); shape.size = Vector3(0.8, 2.0, 0.1); shape_node.shape = shape; body.add_child(shape_node); add_child(body); walls[str(value.id)] = body
	_update_geometry()

func _apply_event(event: Dictionary) -> void:
	if event.type == "set-obstruction": candidates[str(event.targetId)].obstruction = event.obstruction
	elif event.type == "set-targetable": candidates[str(event.targetId)].targetable = event.targetable
	elif event.type == "move-target": candidates[str(event.targetId)].targetPoint = event.targetPoint

func _update_geometry() -> void:
	for id in candidates:
		var item: Dictionary = candidates[id]; var body: StaticBody3D = walls[id]; var point := _vec(item.targetPoint); var enabled: bool = item.obstruction == "controlled-wall" and point.length() > EPSILON
		markers[id].position = point
		body.process_mode = Node.PROCESS_MODE_INHERIT if enabled else Node.PROCESS_MODE_DISABLED; body.get_child(0).disabled = not enabled
		if enabled: var direction := point.normalized(); body.global_transform = Transform3D(Basis.looking_at(direction, Vector3.UP), point * 0.5)

func _line_of_sight(item: Dictionary, origin: Vector3) -> bool:
	var point := _vec(item.targetPoint); if point.distance_to(origin) <= EPSILON: return true
	var query := PhysicsRayQueryParameters3D.create(origin, point, 2); query.collide_with_bodies = true; query.collide_with_areas = false
	return get_world_3d().direct_space_state.intersect_ray(query).is_empty()

func _evaluation_for(id: String, plan: Dictionary, retention: bool) -> Variant:
	if not candidates.has(id): return null
	return _evaluate(candidates[id], plan, retention, null)

func _evaluate_all(plan: Dictionary, _current: String, retention: bool) -> Array:
	var values: Array = []
	for item in candidates.values(): values.append(_evaluate(item, plan, retention, null))
	return values

func _evaluate(item: Dictionary, plan: Dictionary, retention: bool, relative: Variant) -> Dictionary:
	var origin := _vec(plan.origin); var point := _vec(item.targetPoint); var difference := point - origin; var distance := difference.length(); var rejection: Array = []; var maximum_distance := float(targeting.acquisition.maximumDistance) * (float(targeting.retention.maximumDistanceMultiplier) if retention else 1.0); var maximum_angle := float(targeting.acquisition.maximumAngleDegrees) + (float(targeting.retention.additionalAngleDegrees) if retention else 0.0)
	if not bool(item.targetable): rejection.append("TARGET_NOT_TARGETABLE")
	if distance > maximum_distance: rejection.append("TARGET_OUT_OF_DISTANCE")
	var unsigned_angle: Variant = null
	if distance <= EPSILON: rejection.append("TARGET_DIRECTION_UNDEFINED")
	else: unsigned_angle = rad_to_deg(_vec(plan.viewForward).angle_to(difference)); if float(unsigned_angle) > maximum_angle: rejection.append("TARGET_OUT_OF_ANGLE")
	if bool(targeting.acquisition.requireLineOfSight) and not _line_of_sight(item, origin): rejection.append("TARGET_LINE_OF_SIGHT_BLOCKED")
	var eligible := rejection.is_empty(); var distance_score: Variant = clampf(1.0 - distance / float(targeting.acquisition.maximumDistance), 0.0, 1.0) if eligible else null; var angle_score: Variant = clampf(1.0 - float(unsigned_angle) / float(targeting.acquisition.maximumAngleDegrees), 0.0, 1.0) if eligible and unsigned_angle != null else null; var total: Variant = float(distance_score) * float(targeting.scoring.distanceWeight) + float(angle_score) * float(targeting.scoring.angleWeight) + float(item.priority) * float(targeting.scoring.priorityWeight) if distance_score != null and angle_score != null else null
	var base_direction: Vector3 = _vec(plan.viewForward) if relative == null else relative
	return {"id": item.id, "targetPoint": item.targetPoint, "targetable": item.targetable, "lineOfSight": _line_of_sight(item, origin), "eligible": eligible, "rejectionCodes": rejection, "distance": distance, "unsignedAngleDegrees": unsigned_angle, "signedHorizontalAngleDegrees": _signed_angle(base_direction, difference), "distanceScore": distance_score, "angleScore": angle_score, "priorityScore": item.priority, "totalScore": total}

func _acquire(plan: Dictionary) -> Dictionary:
	var evaluations := _evaluate_all(plan, "", false); var eligible := evaluations.filter(func(value): return bool(value.eligible))
	eligible.sort_custom(func(left, right):
		if absf(float(left.totalScore) - float(right.totalScore)) > TIE_EPSILON: return float(left.totalScore) > float(right.totalScore)
		if absf(float(left.unsignedAngleDegrees) - float(right.unsignedAngleDegrees)) > TIE_EPSILON: return float(left.unsignedAngleDegrees) < float(right.unsignedAngleDegrees)
		if absf(float(left.distance) - float(right.distance)) > TIE_EPSILON: return float(left.distance) < float(right.distance)
		return str(left.id) < str(right.id))
	var tie: Variant = null
	if eligible.size() >= 2:
		var left: Dictionary = eligible[0]; var right: Dictionary = eligible[1]
		if absf(float(left.totalScore) - float(right.totalScore)) <= TIE_EPSILON:
			tie = "smaller_unsigned_angle" if absf(float(left.unsignedAngleDegrees) - float(right.unsignedAngleDegrees)) > TIE_EPSILON else "smaller_distance" if absf(float(left.distance) - float(right.distance)) > TIE_EPSILON else "ordinal_target_id"
	return {"selectedTargetId": null if eligible.is_empty() else eligible[0].id, "evaluations": evaluations, "tieBreakResult": tie}

func _switch(plan: Dictionary, current_id: String, direction: String, cooldown: float) -> Dictionary:
	if not bool(targeting.switching.enabled): return {"targetId": current_id if not current_id.is_empty() else null, "switched": false, "reason": "switching_disabled", "evaluations": []}
	if current_id.is_empty() or not candidates.has(current_id): return {"targetId": null if current_id.is_empty() else current_id, "switched": false, "reason": "no_current_target", "evaluations": []}
	if cooldown > EPSILON: return {"targetId": current_id, "switched": false, "reason": "cooldown_active", "evaluations": []}
	var current_direction := _vec(candidates[current_id].targetPoint) - _vec(plan.origin); var evaluations: Array = []
	for id in candidates:
		if id != current_id: evaluations.append(_evaluate(candidates[id], plan, false, current_direction))
	var valid := evaluations.filter(func(value): var angle: Variant = value.signedHorizontalAngleDegrees; return bool(value.eligible) and angle != null and (float(angle) > 0.0 and float(angle) >= float(targeting.switching.minimumSeparationDegrees) and float(angle) <= float(targeting.switching.maximumAngleDegrees) if direction == "left" else float(angle) < 0.0 and float(angle) <= -float(targeting.switching.minimumSeparationDegrees) and absf(float(angle)) <= float(targeting.switching.maximumAngleDegrees)))
	valid.sort_custom(func(left, right):
		var directional := float(left.signedHorizontalAngleDegrees) - float(right.signedHorizontalAngleDegrees) if direction == "left" else float(right.signedHorizontalAngleDegrees) - float(left.signedHorizontalAngleDegrees)
		if absf(directional) > TIE_EPSILON: return directional < 0.0
		if absf(float(left.totalScore) - float(right.totalScore)) > TIE_EPSILON: return float(left.totalScore) > float(right.totalScore)
		if absf(float(left.distance) - float(right.distance)) > TIE_EPSILON: return float(left.distance) < float(right.distance)
		return str(left.id) < str(right.id))
	return {"targetId": current_id, "switched": false, "reason": "no_directional_candidate", "evaluations": evaluations} if valid.is_empty() else {"targetId": valid[0].id, "switched": true, "reason": "switched", "evaluations": evaluations}

func _set_target(state: Dictionary, value: Variant, step: int, history: Array) -> void:
	if state.target == value: return
	state.target = value; history.append({"step": step, "targetId": value})

func _boom(origin: Vector3, yaw: float) -> Vector3:
	var radians := deg_to_rad(yaw); var forward := Vector3(-sin(radians), 0.0, -cos(radians)); var right := Vector3(cos(radians), 0.0, -sin(radians)); return origin - forward * float(camera_profile.follow.distance) + right * float(camera_profile.follow.shoulderOffset) + Vector3(0.0, float(camera_profile.follow.height), 0.0)
func _yaw(value: Vector3) -> float: return _normalize_yaw(rad_to_deg(atan2(-value.x, -value.z)))
func _remaining(delta: float, half_life: float) -> float: return 0.0 if half_life == 0.0 else pow(2.0, -delta / half_life)
func _smooth_vector(current: Vector3, target_value: Vector3, delta: float, half_life: float) -> Vector3: return target_value + (current - target_value) * _remaining(delta, half_life)
func _smooth_scalar(current: float, target_value: float, delta: float, half_life: float) -> float: return target_value + (current - target_value) * _remaining(delta, half_life)
func _smooth_yaw(current: float, target_value: float, delta: float, half_life: float) -> float: return _normalize_yaw(target_value - _angle_difference(current, target_value) * _remaining(delta, half_life))
func _angular_error(yaw: float, pitch: float, desired: Vector3) -> float: var yr := deg_to_rad(yaw); var pr := deg_to_rad(pitch); var forward := Vector3(-sin(yr) * cos(pr), -sin(pr), -cos(yr) * cos(pr)); return rad_to_deg(forward.angle_to(desired))
func _signed_angle(from: Vector3, to: Vector3) -> Variant: var from_flat := Vector2(from.x, from.z); var to_flat := Vector2(to.x, to.z); return null if from_flat.length() <= EPSILON or to_flat.length() <= EPSILON else _normalize_yaw(rad_to_deg(atan2(-to.x, -to.z)) - rad_to_deg(atan2(-from.x, -from.z)))
func _normalize_yaw(value: float) -> float: return fmod(fmod(value + 180.0, 360.0) + 360.0, 360.0) - 180.0
func _angle_difference(current: float, target_value: float) -> float: return _normalize_yaw(target_value - current)
func _vec(value: Dictionary) -> Vector3: return Vector3(float(value.x), float(value.y), float(value.z))
func _dict(value: Vector3) -> Dictionary: return {"x": value.x, "y": value.y, "z": value.z}
func _deep_round(value: Variant) -> Variant:
	if typeof(value) == TYPE_FLOAT: return snappedf(value, 0.000000001)
	if typeof(value) == TYPE_ARRAY: return value.map(func(item): return _deep_round(item))
	if typeof(value) == TYPE_DICTIONARY:
		var result := {}
		for key in value: result[key] = _deep_round(value[key])
		return result
	return value
