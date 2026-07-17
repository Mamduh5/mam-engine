class_name MamTargetingCore
extends RefCounted

const EPSILON := 0.000000000001
const TIE_EPSILON := 0.000000001

var _profile: Dictionary = {}
var _bound := false
var _target_id: Variant = null
var _target_position: Variant = null
var _target_aim_position: Variant = null
var _invalid_elapsed := 0.0
var _cooldown := 0.0

func bind(profile: Variant) -> Dictionary:
	if _bound: return _failure("MAM_TARGETING_BIND_DUPLICATE", "profile", "This targeting runtime is already bound")
	if typeof(profile) != TYPE_DICTIONARY or not _profile_complete(profile): return _failure("MAM_TARGETING_BIND_PROFILE_INVALID", "profile", "A complete loaded targeting profile is required")
	_profile = profile.duplicate(true); _bound = true; _reset_state()
	return _success(_state([], false, false, false, false, null, null))

func physics_step(delta: float, input: Variant) -> Dictionary:
	if not _bound: return _failure("MAM_TARGETING_STEP_NOT_BOUND", "profile", "Targeting runtime is not bound")
	if not is_finite(delta) or delta <= 0.0: return _failure("MAM_TARGETING_STEP_DELTA_INVALID", "delta", "Physics delta must be finite and positive")
	var validation := _validate_input(input)
	if not validation.is_empty(): return _failure("MAM_TARGETING_STEP_INPUT_INVALID", validation.path, validation.message)
	var candidates: Array = []
	for candidate in input.candidates: candidates.append(candidate.duplicate(true))
	var origin: Vector3 = input.origin; var forward: Vector3 = input.cameraForward
	_cooldown = maxf(0.0, _cooldown - delta)
	var acquired := false; var lost := false; var switched := false; var reacquired := false; var switch_reason: Variant = null; var tie: Variant = null
	if bool(input.unlockRequested):
		lost = _target_id != null; _clear_state(); return _success(_state(_evaluate_all(candidates, origin, forward, false), false, lost, false, false, null, null))
	if _target_id != null:
		var current := _candidate_for(candidates, str(_target_id)); var valid := false
		if current != null: valid = bool(_evaluate(current, origin, forward, true, null).eligible)
		if valid:
			_invalid_elapsed = 0.0
		else:
			_invalid_elapsed += delta
			if float(_profile.retention.lostTargetGraceSeconds) == 0.0 or _invalid_elapsed + EPSILON >= float(_profile.retention.lostTargetGraceSeconds):
				lost = true; _clear_target_only()
				if bool(_profile.retention.autoReacquire):
					var reacquisition := _acquire(candidates, origin, forward); tie = reacquisition.tieBreakResult
					if reacquisition.selectedTargetId != null:
						_set_target(str(reacquisition.selectedTargetId), candidates); acquired = true; reacquired = true
	if bool(input.lockRequested) and _target_id == null:
		var acquisition := _acquire(candidates, origin, forward); tie = acquisition.tieBreakResult
		if acquisition.selectedTargetId != null: _set_target(str(acquisition.selectedTargetId), candidates); acquired = true
	var switch_direction: Vector2 = input.switchDirection
	if absf(switch_direction.x) > EPSILON:
		var direction := "left" if switch_direction.x < 0.0 else "right"
		var switch_result := _switch_target(candidates, origin, forward, direction, _cooldown); switch_reason = switch_result.reason
		if bool(switch_result.switched): _set_target(str(switch_result.targetId), candidates); _cooldown = float(_profile.switching.cooldownSeconds); switched = true
	_refresh_target(candidates)
	return _success(_state(_evaluate_all(candidates, origin, forward, false), acquired, lost, switched, reacquired, switch_reason, tie))

func clear_target() -> Dictionary:
	if not _bound: return _failure("MAM_TARGETING_CLEAR_NOT_BOUND", "profile", "Targeting runtime is not bound")
	var lost := _target_id != null; _clear_state(); return _success(_state([], false, lost, false, false, null, null))

func unbind() -> Dictionary:
	if not _bound: return _failure("MAM_TARGETING_UNBIND_NOT_BOUND", "profile", "Targeting runtime is not bound")
	_profile = {}; _bound = false; _reset_state()
	return _success({"mode": "UNBOUND", "locked": false, "targetId": null, "accepted": true, "diagnostics": []})

func seed_state(target_id: Variant, cooldown_seconds: float = 0.0) -> Dictionary:
	if not _bound: return _failure("MAM_TARGETING_SEED_NOT_BOUND", "profile", "Targeting runtime is not bound")
	if target_id != null and (typeof(target_id) != TYPE_STRING or str(target_id).is_empty()): return _failure("MAM_TARGETING_SEED_INVALID", "targetId", "Seed target ID must be null or non-empty")
	if not is_finite(cooldown_seconds) or cooldown_seconds < 0.0: return _failure("MAM_TARGETING_SEED_INVALID", "cooldownSeconds", "Seed cooldown must be finite and non-negative")
	_reset_state(); _target_id = target_id; _cooldown = cooldown_seconds
	return _success(_state([], false, false, false, false, null, null))

func _acquire(candidates: Array, origin: Vector3, forward: Vector3) -> Dictionary:
	var evaluations := _evaluate_all(candidates, origin, forward, false); var eligible := evaluations.filter(func(value): return bool(value.eligible))
	eligible.sort_custom(func(left, right):
		if absf(float(left.totalScore) - float(right.totalScore)) > TIE_EPSILON: return float(left.totalScore) > float(right.totalScore)
		if absf(float(left.unsignedAngleDegrees) - float(right.unsignedAngleDegrees)) > TIE_EPSILON: return float(left.unsignedAngleDegrees) < float(right.unsignedAngleDegrees)
		if absf(float(left.distance) - float(right.distance)) > TIE_EPSILON: return float(left.distance) < float(right.distance)
		return str(left.id) < str(right.id))
	var tie: Variant = null
	if eligible.size() >= 2:
		var left: Dictionary = eligible[0]; var right: Dictionary = eligible[1]
		if absf(float(left.totalScore) - float(right.totalScore)) <= TIE_EPSILON: tie = "smaller_unsigned_angle" if absf(float(left.unsignedAngleDegrees) - float(right.unsignedAngleDegrees)) > TIE_EPSILON else "smaller_distance" if absf(float(left.distance) - float(right.distance)) > TIE_EPSILON else "ordinal_target_id"
	return {"selectedTargetId": null if eligible.is_empty() else eligible[0].id, "evaluations": evaluations, "tieBreakResult": tie}

func _switch_target(candidates: Array, origin: Vector3, forward: Vector3, direction: String, cooldown: float) -> Dictionary:
	if not bool(_profile.switching.enabled): return {"targetId": _target_id, "switched": false, "reason": "switching_disabled", "evaluations": []}
	if _target_id == null: return {"targetId": null, "switched": false, "reason": "no_current_target", "evaluations": []}
	if cooldown > EPSILON: return {"targetId": _target_id, "switched": false, "reason": "cooldown_active", "evaluations": []}
	var current := _candidate_for(candidates, str(_target_id))
	if current == null: return {"targetId": _target_id, "switched": false, "reason": "no_current_target", "evaluations": []}
	var current_direction: Vector3 = current.aimPosition - origin; var evaluations: Array = []
	for candidate in candidates:
		if candidate.id != _target_id: evaluations.append(_evaluate(candidate, origin, forward, false, current_direction))
	var valid := evaluations.filter(func(value):
		var angle: Variant = value.signedHorizontalAngleDegrees
		return bool(value.eligible) and angle != null and (float(angle) > 0.0 and float(angle) >= float(_profile.switching.minimumSeparationDegrees) and float(angle) <= float(_profile.switching.maximumAngleDegrees) if direction == "left" else float(angle) < 0.0 and float(angle) <= -float(_profile.switching.minimumSeparationDegrees) and absf(float(angle)) <= float(_profile.switching.maximumAngleDegrees)))
	valid.sort_custom(func(left, right):
		var directional := float(left.signedHorizontalAngleDegrees) - float(right.signedHorizontalAngleDegrees) if direction == "left" else float(right.signedHorizontalAngleDegrees) - float(left.signedHorizontalAngleDegrees)
		if absf(directional) > TIE_EPSILON: return directional < 0.0
		if absf(float(left.totalScore) - float(right.totalScore)) > TIE_EPSILON: return float(left.totalScore) > float(right.totalScore)
		if absf(float(left.distance) - float(right.distance)) > TIE_EPSILON: return float(left.distance) < float(right.distance)
		return str(left.id) < str(right.id))
	return {"targetId": _target_id, "switched": false, "reason": "no_directional_candidate", "evaluations": evaluations} if valid.is_empty() else {"targetId": valid[0].id, "switched": true, "reason": "switched", "evaluations": evaluations}

func _evaluate_all(candidates: Array, origin: Vector3, forward: Vector3, retention: bool) -> Array:
	var values: Array = []
	for candidate in candidates: values.append(_evaluate(candidate, origin, forward, retention, null))
	return values

func _evaluate(candidate: Dictionary, origin: Vector3, forward: Vector3, retention: bool, relative: Variant) -> Dictionary:
	var difference: Vector3 = candidate.aimPosition - origin; var distance := difference.length(); var rejection: Array = []
	var maximum_distance := float(_profile.acquisition.maximumDistance) * (float(_profile.retention.maximumDistanceMultiplier) if retention else 1.0)
	var maximum_angle := float(_profile.acquisition.maximumAngleDegrees) + (float(_profile.retention.additionalAngleDegrees) if retention else 0.0)
	if not bool(candidate.targetable): rejection.append("TARGET_NOT_TARGETABLE")
	if distance > maximum_distance: rejection.append("TARGET_OUT_OF_DISTANCE")
	var unsigned_angle: Variant = null
	if distance <= EPSILON: rejection.append("TARGET_DIRECTION_UNDEFINED")
	else: unsigned_angle = rad_to_deg(forward.angle_to(difference)); if float(unsigned_angle) > maximum_angle: rejection.append("TARGET_OUT_OF_ANGLE")
	if bool(_profile.acquisition.requireLineOfSight) and not bool(candidate.visible): rejection.append("TARGET_LINE_OF_SIGHT_BLOCKED")
	var eligible := rejection.is_empty(); var distance_score: Variant = clampf(1.0 - distance / float(_profile.acquisition.maximumDistance), 0.0, 1.0) if eligible else null; var angle_score: Variant = clampf(1.0 - float(unsigned_angle) / float(_profile.acquisition.maximumAngleDegrees), 0.0, 1.0) if eligible and unsigned_angle != null else null
	var total: Variant = float(distance_score) * float(_profile.scoring.distanceWeight) + float(angle_score) * float(_profile.scoring.angleWeight) + float(candidate.priority) * float(_profile.scoring.priorityWeight) if distance_score != null and angle_score != null else null
	var base_direction: Vector3 = forward if relative == null else relative
	return {"id": candidate.id, "targetPoint": _vector_dictionary(candidate.aimPosition), "targetable": candidate.targetable, "lineOfSight": candidate.visible, "eligible": eligible, "rejectionCodes": rejection, "distance": distance, "unsignedAngleDegrees": unsigned_angle, "signedHorizontalAngleDegrees": _signed_angle(base_direction, difference), "distanceScore": distance_score, "angleScore": angle_score, "priorityScore": candidate.priority, "totalScore": total}

func _state(evaluations: Array, acquired: bool, lost: bool, switched: bool, reacquired: bool, switch_reason: Variant, tie: Variant) -> Dictionary:
	var current_eval: Variant = null
	for evaluation in evaluations:
		if evaluation.id == _target_id: current_eval = evaluation; break
	var within_grace := _target_id != null and _invalid_elapsed > EPSILON
	return {"mode": "GRACE" if within_grace else ("LOCKED" if _target_id != null else "UNLOCKED"), "locked": _target_id != null, "targetId": _target_id, "targetPosition": _target_position, "targetAimPosition": _target_aim_position, "targetDistance": null if current_eval == null else current_eval.distance, "targetScore": null if current_eval == null else current_eval.totalScore, "withinGracePeriod": within_grace, "graceRemainingSeconds": maxf(0.0, float(_profile.retention.lostTargetGraceSeconds) - _invalid_elapsed) if within_grace else 0.0, "switchCooldownRemainingSeconds": _cooldown, "acquiredThisStep": acquired, "lostThisStep": lost, "switchedThisStep": switched, "reacquiredThisStep": reacquired, "switchReason": switch_reason, "tieBreakResult": tie, "candidateEvaluations": evaluations, "accepted": true, "diagnostics": []}

func _validate_input(input: Variant) -> Dictionary:
	if typeof(input) != TYPE_DICTIONARY or not input.has_all(["origin", "cameraForward", "cameraRight", "cameraUp", "candidates", "lockRequested", "unlockRequested", "switchDirection"]): return {"path": "input", "message": "Explicit origin, camera basis, candidates, lock state, and switch direction are required"}
	for key in ["origin", "cameraForward", "cameraRight", "cameraUp"]:
		if not input[key] is Vector3 or not _finite_vector3(input[key]): return {"path": "input." + key, "message": key + " must be a finite Vector3"}
	if input.cameraForward.length_squared() <= EPSILON: return {"path": "input.cameraForward", "message": "cameraForward must be non-zero"}
	if not input.switchDirection is Vector2 or not is_finite(input.switchDirection.x) or not is_finite(input.switchDirection.y): return {"path": "input.switchDirection", "message": "switchDirection must be a finite Vector2"}
	if typeof(input.lockRequested) != TYPE_BOOL or typeof(input.unlockRequested) != TYPE_BOOL: return {"path": "input", "message": "Lock and unlock requests must be booleans"}
	if typeof(input.candidates) != TYPE_ARRAY: return {"path": "input.candidates", "message": "Candidates must be an array"}
	var ids: Dictionary = {}
	for index in range(input.candidates.size()):
		var candidate: Variant = input.candidates[index]; var prefix := "input.candidates.%d" % index
		if typeof(candidate) != TYPE_DICTIONARY or not candidate.has_all(["id", "position", "aimPosition", "targetable", "visible", "priority"]): return {"path": prefix, "message": "Candidate fields are incomplete"}
		if candidate.size() != 6: return {"path": prefix, "message": "Candidate contains unsupported fields"}
		if typeof(candidate.id) != TYPE_STRING or str(candidate.id).is_empty(): return {"path": prefix + ".id", "message": "Candidate ID must be non-empty"}
		if ids.has(candidate.id): return {"path": prefix + ".id", "message": "Candidate IDs must be unique"}
		ids[candidate.id] = true
		for key in ["position", "aimPosition"]:
			if not candidate[key] is Vector3 or not _finite_vector3(candidate[key]): return {"path": prefix + "." + key, "message": "Candidate position must be a finite Vector3"}
		if typeof(candidate.targetable) != TYPE_BOOL or typeof(candidate.visible) != TYPE_BOOL: return {"path": prefix, "message": "Candidate targetable and visible values must be booleans"}
		if not _finite_number(candidate.priority) or float(candidate.priority) < 0.0 or float(candidate.priority) > 1.0: return {"path": prefix + ".priority", "message": "Candidate priority must be within [0, 1]"}
	return {}

func _profile_complete(value: Dictionary) -> bool:
	if value.get("schemaVersion") != 1 or value.get("kind") != "targeting-profile": return false
	for key in ["id", "displayName"]:
		if typeof(value.get(key)) != TYPE_STRING or str(value.get(key)).is_empty(): return false
	var groups := {"acquisition": ["maximumDistance", "maximumAngleDegrees"], "scoring": ["distanceWeight", "angleWeight", "priorityWeight"], "retention": ["maximumDistanceMultiplier", "additionalAngleDegrees", "lostTargetGraceSeconds"], "switching": ["cooldownSeconds", "maximumAngleDegrees", "minimumSeparationDegrees"]}
	for group in groups:
		if typeof(value.get(group)) != TYPE_DICTIONARY: return false
		for field in groups[group]:
			if not _finite_number(value[group].get(field)): return false
	for pair in [["acquisition", "requireLineOfSight"], ["retention", "autoReacquire"], ["switching", "enabled"]]:
		if typeof(value[pair[0]].get(pair[1])) != TYPE_BOOL: return false
	return true

func _set_target(id: String, candidates: Array) -> void:
	_target_id = id; _invalid_elapsed = 0.0; _refresh_target(candidates)

func _refresh_target(candidates: Array) -> void:
	if _target_id == null: return
	var candidate := _candidate_for(candidates, str(_target_id))
	if candidate != null: _target_position = candidate.position; _target_aim_position = candidate.aimPosition

func _candidate_for(candidates: Array, id: String) -> Variant:
	for candidate in candidates:
		if candidate.id == id: return candidate
	return null

func _clear_target_only() -> void:
	_target_id = null; _target_position = null; _target_aim_position = null; _invalid_elapsed = 0.0

func _clear_state() -> void:
	_clear_target_only(); _cooldown = 0.0

func _reset_state() -> void:
	_target_id = null; _target_position = null; _target_aim_position = null; _invalid_elapsed = 0.0; _cooldown = 0.0

static func _signed_angle(from: Vector3, to: Vector3) -> Variant:
	var from_flat := Vector2(from.x, from.z); var to_flat := Vector2(to.x, to.z)
	return null if from_flat.length() <= EPSILON or to_flat.length() <= EPSILON else _normalize_yaw(rad_to_deg(atan2(-to.x, -to.z)) - rad_to_deg(atan2(-from.x, -from.z)))

static func _normalize_yaw(value: float) -> float:
	return fmod(fmod(value + 180.0, 360.0) + 360.0, 360.0) - 180.0

static func _vector_dictionary(value: Vector3) -> Dictionary:
	return {"x": value.x, "y": value.y, "z": value.z}

static func _finite_number(value: Variant) -> bool:
	return (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value))

static func _finite_vector3(value: Vector3) -> bool:
	return is_finite(value.x) and is_finite(value.y) and is_finite(value.z)

static func _success(data: Dictionary) -> Dictionary:
	return {"status": "passed", "data": data, "diagnostics": []}

static func _failure(code: String, path: String, message: String) -> Dictionary:
	return {"status": "failed", "data": {}, "diagnostics": [{"code": code, "severity": "error", "path": path, "message": message}]}
