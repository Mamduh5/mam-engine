class_name MamCameraCore
extends RefCounted

const EPSILON := 0.000000000001
const PITCH_BOUND_EPSILON := 0.000000001
static var _owners: Dictionary = {}

var _follow_target: Node3D
var _rig_root: Node3D
var _yaw_pivot: Node3D
var _pitch_pivot: Node3D
var _camera: Camera3D
var _collision_probe: ShapeCast3D
var _profile: Dictionary = {}
var _owner_keys: Array[int] = []
var _bound := false
var _yaw_degrees := 0.0
var _pitch_degrees := 0.0
var _actual_distance := 0.0
var _manual_idle_seconds := 0.0
var _rig_position := Vector3.ZERO
var _look_at_position := Vector3.ZERO
var _camera_position := Vector3.ZERO
var _collision_detected := false
var _manual_orbit_active := false
var _recentering := false
var _follow_exception_added := false

func bind(bindings: Variant, profile: Variant) -> Dictionary:
	if _bound:
		return _failure("MAM_CAMERA_BIND_DUPLICATE", "bindings", "This camera runtime is already bound")
	if typeof(bindings) != TYPE_DICTIONARY:
		return _failure("MAM_CAMERA_BIND_BINDINGS_INVALID", "bindings", "Camera bindings must be an object")
	if not bindings.get("followTarget") is Node3D:
		return _failure("MAM_CAMERA_BIND_FOLLOW_TARGET_INVALID", "bindings.followTarget", "A Node3D follow target is required")
	if not bindings.get("rigRoot") is Node3D:
		return _failure("MAM_CAMERA_BIND_RIG_ROOT_INVALID", "bindings.rigRoot", "A Node3D rig root is required")
	if not bindings.get("yawPivot") is Node3D:
		return _failure("MAM_CAMERA_BIND_YAW_PIVOT_INVALID", "bindings.yawPivot", "A Node3D yaw pivot is required")
	if not bindings.get("pitchPivot") is Node3D:
		return _failure("MAM_CAMERA_BIND_PITCH_PIVOT_INVALID", "bindings.pitchPivot", "A Node3D pitch pivot is required")
	if not bindings.get("camera") is Camera3D:
		return _failure("MAM_CAMERA_BIND_CAMERA_INVALID", "bindings.camera", "A Camera3D is required")
	var probe: Variant = bindings.get("collisionProbe")
	if probe != null and not probe is ShapeCast3D:
		return _failure("MAM_CAMERA_BIND_COLLISION_PROBE_INVALID", "bindings.collisionProbe", "Collision probe must be a ShapeCast3D or null")
	if typeof(profile) != TYPE_DICTIONARY or not _profile_complete(profile):
		return _failure("MAM_CAMERA_BIND_PROFILE_INVALID", "profile", "A complete loaded camera profile is required")
	if bool(profile.collision.enabled) and probe == null:
		return _failure("MAM_CAMERA_BIND_COLLISION_PROBE_REQUIRED", "bindings.collisionProbe", "Enabled camera collision requires a ShapeCast3D")

	var owned_nodes: Array[Node] = [bindings.rigRoot, bindings.yawPivot, bindings.pitchPivot, bindings.camera]
	if probe != null:
		owned_nodes.append(probe)
	for node in owned_nodes:
		var key: int = node.get_instance_id()
		if _owner_active(key):
			return _failure("MAM_CAMERA_BIND_RIG_OWNED", "bindings", "Camera rig is already bound to another runtime")

	_follow_target = bindings.followTarget
	_rig_root = bindings.rigRoot
	_yaw_pivot = bindings.yawPivot
	_pitch_pivot = bindings.pitchPivot
	_camera = bindings.camera
	_collision_probe = probe
	_profile = profile
	_bound = true
	for node in owned_nodes:
		var key: int = node.get_instance_id()
		_owner_keys.append(key)
		_owners[key] = weakref(self)

	_yaw_degrees = normalize_yaw(float(_profile.orbit.initialYawDegrees))
	_pitch_degrees = clampf(float(_profile.orbit.initialPitchDegrees), float(_profile.orbit.minimumPitchDegrees), float(_profile.orbit.maximumPitchDegrees))
	_actual_distance = float(_profile.follow.distance)
	_rig_position = _follow_target.global_position
	_manual_idle_seconds = 0.0
	_manual_orbit_active = false
	_recentering = false
	_collision_detected = false
	_camera.fov = float(_profile.lens.fieldOfViewDegrees)
	_camera.near = float(_profile.lens.nearClipDistance)
	_camera.far = float(_profile.lens.farClipDistance)
	_configure_collision_probe()
	_apply_nodes(0.0, false)
	return _success(_state())

func physics_step(delta: float, input: Variant) -> Dictionary:
	if not _bound or not _bindings_valid():
		return _failure("MAM_CAMERA_STEP_NOT_BOUND", "bindings", "Camera runtime is not bound")
	if not is_finite(delta) or delta <= 0.0:
		return _failure("MAM_CAMERA_STEP_DELTA_INVALID", "delta", "Physics delta must be finite and positive")
	if typeof(input) != TYPE_DICTIONARY or not input.has_all(["orbit", "movementWorldDirection", "movementMagnitude"]):
		return _failure("MAM_CAMERA_STEP_INPUT_INVALID", "input", "Explicit orbit, movementWorldDirection, and movementMagnitude values are required")
	if not input.orbit is Vector2 or not _finite_vector2(input.orbit):
		return _failure("MAM_CAMERA_STEP_INPUT_INVALID", "input.orbit", "Orbit must be a finite Vector2")
	if not input.movementWorldDirection is Vector3 or not _finite_vector3(input.movementWorldDirection):
		return _failure("MAM_CAMERA_STEP_INPUT_INVALID", "input.movementWorldDirection", "Movement world direction must be a finite Vector3")
	if not _finite_number(input.movementMagnitude):
		return _failure("MAM_CAMERA_STEP_INPUT_INVALID", "input.movementMagnitude", "Movement magnitude must be finite")

	var orbit: Vector2 = input.orbit
	_manual_orbit_active = absf(orbit.x) > EPSILON or absf(orbit.y) > EPSILON
	_recentering = false
	if _manual_orbit_active:
		var yaw_sign := -1.0 if bool(_profile.orbit.invertYaw) else 1.0
		var pitch_sign := -1.0 if bool(_profile.orbit.invertPitch) else 1.0
		_yaw_degrees = normalize_yaw(_yaw_degrees + orbit.x * float(_profile.orbit.yawSpeedDegreesPerSecond) * delta * yaw_sign)
		var minimum_pitch := float(_profile.orbit.minimumPitchDegrees)
		var maximum_pitch := float(_profile.orbit.maximumPitchDegrees)
		_pitch_degrees = clampf(_pitch_degrees + orbit.y * float(_profile.orbit.pitchSpeedDegreesPerSecond) * delta * pitch_sign, minimum_pitch, maximum_pitch)
		if maximum_pitch - _pitch_degrees <= PITCH_BOUND_EPSILON:
			_pitch_degrees = maximum_pitch
		if _pitch_degrees - minimum_pitch <= PITCH_BOUND_EPSILON:
			_pitch_degrees = minimum_pitch
		_manual_idle_seconds = 0.0
	else:
		_manual_idle_seconds += delta
		_apply_recenter(delta, input.movementWorldDirection, clampf(float(input.movementMagnitude), 0.0, 1.0))

	var desired_rig_position := _follow_target.global_position
	_rig_position = smooth_vector(_rig_position, desired_rig_position, delta, float(_profile.follow.positionHalfLifeSeconds))
	_apply_nodes(delta, true)
	return _success(_state())

func unbind() -> Dictionary:
	if not _bound:
		return _failure("MAM_CAMERA_UNBIND_NOT_BOUND", "bindings", "Camera runtime is not bound")
	if _follow_exception_added and is_instance_valid(_collision_probe) and is_instance_valid(_follow_target) and _follow_target is CollisionObject3D:
		_collision_probe.remove_exception(_follow_target as CollisionObject3D)
	for key in _owner_keys:
		_owners.erase(key)
	_owner_keys.clear()
	_follow_target = null
	_rig_root = null
	_yaw_pivot = null
	_pitch_pivot = null
	_camera = null
	_collision_probe = null
	_profile = {}
	_bound = false
	_follow_exception_added = false
	return _success({"accepted": true, "diagnostics": []})

func _apply_recenter(delta: float, movement_world_direction: Vector3, movement_magnitude: float) -> void:
	if not bool(_profile.recenter.enabled) or movement_magnitude < float(_profile.recenter.movementInputThreshold) or _manual_idle_seconds + EPSILON < float(_profile.recenter.delaySeconds):
		return
	var horizontal := Vector3(movement_world_direction.x, 0.0, movement_world_direction.z)
	if horizontal.length_squared() <= EPSILON:
		return
	var target_yaw := yaw_from_direction(horizontal.normalized())
	var difference := shortest_angle_difference(_yaw_degrees, target_yaw)
	var change := signf(difference) * minf(absf(difference), float(_profile.recenter.yawSpeedDegreesPerSecond) * delta)
	if absf(change) <= EPSILON:
		return
	_yaw_degrees = normalize_yaw(_yaw_degrees + change)
	_recentering = true

func _configure_collision_probe() -> void:
	if not is_instance_valid(_collision_probe):
		return
	_collision_probe.enabled = bool(_profile.collision.enabled)
	if not bool(_profile.collision.enabled):
		return
	var sphere := SphereShape3D.new()
	sphere.radius = float(_profile.collision.probeRadius)
	_collision_probe.shape = sphere
	if _follow_target is CollisionObject3D:
		_collision_probe.add_exception(_follow_target as CollisionObject3D)
		_follow_exception_added = true

func _apply_nodes(delta: float, query_collision: bool) -> void:
	_rig_root.global_position = _rig_position
	_yaw_pivot.rotation.y = deg_to_rad(_yaw_degrees)
	_pitch_pivot.rotation.x = deg_to_rad(_pitch_degrees)
	_look_at_position = follow_look_at_position(_rig_position, _profile)
	var basis: Dictionary = horizontal_basis(_yaw_degrees)
	var desired_camera_position: Vector3 = camera_position_for(_rig_position, _yaw_degrees, _profile)
	var boom: Vector3 = desired_camera_position - _look_at_position
	var direction: Vector3 = boom.normalized() if boom.length_squared() > EPSILON else basis.forward
	_collision_detected = false
	if bool(_profile.collision.enabled) and is_instance_valid(_collision_probe):
		_collision_probe.global_position = _look_at_position
		_collision_probe.target_position = _collision_probe.to_local(_look_at_position + direction * float(_profile.follow.distance))
		if query_collision:
			_collision_probe.force_shapecast_update()
			if _collision_probe.is_colliding():
				_collision_detected = true
				var hit_distance := _collision_probe.target_position.length() * _collision_probe.get_closest_collision_safe_fraction()
				_actual_distance = clampf(hit_distance, float(_profile.collision.minimumDistance), float(_profile.follow.distance))
			else:
				_actual_distance = smooth_scalar(_actual_distance, float(_profile.follow.distance), delta, float(_profile.collision.returnHalfLifeSeconds))
	else:
		_actual_distance = float(_profile.follow.distance)
	if not _collision_detected and absf(_actual_distance - float(_profile.follow.distance)) <= EPSILON:
		_camera_position = desired_camera_position
	else:
		_camera_position = _look_at_position + direction * _actual_distance
	_camera.global_position = _camera_position

func _state() -> Dictionary:
	var basis := horizontal_basis(_yaw_degrees)
	return {
		"yawDegrees": _yaw_degrees,
		"pitchDegrees": _pitch_degrees,
		"desiredDistance": float(_profile.follow.distance),
		"actualDistance": _actual_distance,
		"collisionDetected": _collision_detected,
		"rigPosition": _rig_position,
		"lookAtPosition": _look_at_position,
		"cameraPosition": _camera_position,
		"cameraForward": basis.forward,
		"cameraRight": basis.right,
		"manualOrbitActive": _manual_orbit_active,
		"recentering": _recentering,
		"accepted": true,
		"diagnostics": []
	}

static func normalize_yaw(value: float) -> float:
	return fmod(fmod(value + 180.0, 360.0) + 360.0, 360.0) - 180.0

static func shortest_angle_difference(current: float, target: float) -> float:
	return normalize_yaw(target - current)

static func remaining_fraction(delta: float, half_life: float) -> float:
	return 0.0 if half_life == 0.0 else pow(2.0, -delta / half_life)

static func smooth_scalar(current: float, target: float, delta: float, half_life: float) -> float:
	return target + (current - target) * remaining_fraction(delta, half_life)

static func smooth_vector(current: Vector3, target: Vector3, delta: float, half_life: float) -> Vector3:
	return target + (current - target) * remaining_fraction(delta, half_life)

static func horizontal_basis(yaw_degrees: float) -> Dictionary:
	var radians := deg_to_rad(yaw_degrees)
	return {
		"forward": Vector3(-sin(radians), 0.0, -cos(radians)),
		"right": Vector3(cos(radians), 0.0, -sin(radians))
	}

static func yaw_from_direction(direction: Vector3) -> float:
	return normalize_yaw(rad_to_deg(atan2(-direction.x, -direction.z)))

static func follow_look_at_position(rig_position: Vector3, profile: Dictionary) -> Vector3:
	return rig_position + Vector3.UP * float(profile.follow.lookAtHeight)

static func camera_position_for(rig_position: Vector3, yaw_degrees: float, profile: Dictionary) -> Vector3:
	var basis := horizontal_basis(yaw_degrees)
	return rig_position + basis.forward * float(profile.follow.distance) + basis.right * float(profile.follow.shoulderOffset) + Vector3.UP * float(profile.follow.height)

static func _owner_active(key: int) -> bool:
	if not _owners.has(key):
		return false
	var owner: Variant = _owners[key]
	if owner is WeakRef and owner.get_ref() != null:
		return true
	_owners.erase(key)
	return false

func _bindings_valid() -> bool:
	return is_instance_valid(_follow_target) and is_instance_valid(_rig_root) and is_instance_valid(_yaw_pivot) and is_instance_valid(_pitch_pivot) and is_instance_valid(_camera) and (not bool(_profile.collision.enabled) or is_instance_valid(_collision_probe))

func _profile_complete(value: Dictionary) -> bool:
	if value.get("schemaVersion") != 1 or value.get("kind") != "camera-profile":
		return false
	for key in ["id", "displayName"]:
		if typeof(value.get(key)) != TYPE_STRING or str(value.get(key)).is_empty():
			return false
	var groups := {
		"orbit": ["yawSpeedDegreesPerSecond", "pitchSpeedDegreesPerSecond", "minimumPitchDegrees", "maximumPitchDegrees", "initialYawDegrees", "initialPitchDegrees"],
		"follow": ["distance", "height", "shoulderOffset", "lookAtHeight", "positionHalfLifeSeconds", "rotationHalfLifeSeconds"],
		"recenter": ["delaySeconds", "yawSpeedDegreesPerSecond", "movementInputThreshold"],
		"collision": ["probeRadius", "minimumDistance", "returnHalfLifeSeconds"],
		"lens": ["fieldOfViewDegrees", "nearClipDistance", "farClipDistance"]
	}
	for group in groups:
		var item: Variant = value.get(group)
		if typeof(item) != TYPE_DICTIONARY:
			return false
		for field in groups[group]:
			if not _finite_number(item.get(field)):
				return false
	for pair in [["orbit", "invertYaw"], ["orbit", "invertPitch"], ["recenter", "enabled"], ["collision", "enabled"]]:
		if typeof(value[pair[0]].get(pair[1])) != TYPE_BOOL:
			return false
	return true

static func _finite_number(value: Variant) -> bool:
	return (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value))

static func _finite_vector2(value: Variant) -> bool:
	return is_finite(value.x) and is_finite(value.y)

static func _finite_vector3(value: Variant) -> bool:
	return is_finite(value.x) and is_finite(value.y) and is_finite(value.z)

static func _success(data: Dictionary) -> Dictionary:
	return {"status": "passed", "data": data, "diagnostics": []}

static func _failure(code: String, path: String, message: String) -> Dictionary:
	return {"status": "failed", "data": {}, "diagnostics": [{"code": code, "severity": "error", "path": path, "message": message}]}
