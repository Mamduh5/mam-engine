class_name RuntimeProtocol
extends RefCounted

const MovementProfileRuntime = preload("res://scripts/movement_profile.gd")
const CameraProfileRuntime = preload("res://scripts/camera_profile.gd")
const TargetingProfileRuntime = preload("res://scripts/targeting_profile.gd")
const SCHEMA_VERSION := "mam.runtime/v1"
const COMMAND_ID := "runtime.fixture.run"
const MOVEMENT_FIXTURE_ID := "movement/basic-ground"
const CAMERA_FIXTURE_ID := "camera/basic-third-person"
const TARGETING_FIXTURE_ID := "targeting/basic-lock-on"
const MOVEMENT_SCENARIOS := ["accelerate", "stop", "sprint", "dodge", "turn"]
const CAMERA_SCENARIOS := ["orbit", "pitch-clamp", "recenter", "follow", "collision", "basis"]
const TARGETING_SCENARIOS := ["acquire", "eligibility", "tie-break", "retention", "loss", "reacquire", "switch-left", "switch-right", "switch-cooldown", "framing-acquire", "framing-switch", "framing-loss", "framing-reacquire"]

static func validate_request(request: Variant) -> Array[String]:
	var errors: Array[String] = []
	if typeof(request) != TYPE_DICTIONARY: return ["request must be an object"]
	if request.get("schemaVersion") != SCHEMA_VERSION: errors.append("unsupported protocol version")
	if request.get("commandId") != COMMAND_ID: errors.append("unknown command ID")
	var fixture_id: Variant = request.get("fixtureId")
	if not [MOVEMENT_FIXTURE_ID, CAMERA_FIXTURE_ID, TARGETING_FIXTURE_ID].has(fixture_id): errors.append("unknown fixture ID")
	if typeof(request.get("correlationId")) != TYPE_STRING or request.get("correlationId").is_empty(): errors.append("missing correlation ID")
	if not _finite_number(request.get("timeoutMs")) or float(request.get("timeoutMs", 0)) <= 0.0 or float(request.get("timeoutMs", 0)) > 60000.0: errors.append("invalid timeout")
	var payload: Variant = request.get("payload")
	if typeof(payload) != TYPE_DICTIONARY: return errors + ["payload must be an object"]
	var scenario: Variant = payload.get("scenario")
	if typeof(scenario) != TYPE_DICTIONARY: return errors + ["scenario must be an object"]
	if fixture_id == MOVEMENT_FIXTURE_ID:
		if payload.has("definitionKind") and payload.get("definitionKind") != "movement-profile": errors.append("unsupported definition kind")
		if payload.get("definitionSchemaVersion") != 1: errors.append("unsupported movement schema version")
		errors.append_array(MovementProfileRuntime.validate(payload.get("profile")))
		if not MOVEMENT_SCENARIOS.has(scenario.get("id")): errors.append("unsupported scenario")
		if not _finite_number(scenario.get("cameraYawDegrees")): errors.append("invalid camera yaw")
	elif fixture_id == CAMERA_FIXTURE_ID:
		if payload.get("definitionKind") != "camera-profile": errors.append("unsupported definition kind")
		if payload.get("definitionSchemaVersion") != 1: errors.append("unsupported camera schema version")
		errors.append_array(CameraProfileRuntime.validate(payload.get("profile")))
		if not CAMERA_SCENARIOS.has(scenario.get("id")): errors.append("unsupported camera scenario")
	else:
		if payload.get("definitionKind") != "targeting-profile" or payload.get("definitionSchemaVersion") != 1: errors.append("unsupported targeting definition")
		if payload.get("cameraDefinitionKind") != "camera-profile" or payload.get("cameraDefinitionSchemaVersion") != 1: errors.append("unsupported targeting camera definition")
		errors.append_array(TargetingProfileRuntime.validate(payload.get("profile"))); errors.append_array(CameraProfileRuntime.validate(payload.get("cameraProfile")))
		if not TARGETING_SCENARIOS.has(scenario.get("id")): errors.append("unsupported targeting scenario")
		errors.append_array(_validate_targeting_plan(scenario))
	if not _finite_number(scenario.get("durationSeconds")) or float(scenario.get("durationSeconds", 0)) < 0.0: errors.append("invalid scenario duration")
	if not _finite_number(scenario.get("fixedDeltaSeconds")) or float(scenario.get("fixedDeltaSeconds", 0)) <= 0.0 or float(scenario.get("fixedDeltaSeconds", 0)) > 1.0: errors.append("invalid fixed timestep")
	if fixture_id == MOVEMENT_FIXTURE_ID and abs(float(scenario.get("fixedDeltaSeconds", 0)) - (1.0 / 60.0)) > 0.000000001: errors.append("invalid fixed timestep")
	return errors

static func _validate_targeting_plan(plan: Dictionary) -> Array[String]:
	var errors: Array[String] = []
	var allowed_plan := ["id", "durationSeconds", "fixedDeltaSeconds", "origin", "viewForward", "initialTargetId", "initialSwitchCooldownSeconds", "candidates", "events"]
	for key in plan:
		if not allowed_plan.has(key): errors.append("unsupported targeting plan field")
	for field in ["origin", "viewForward"]:
		var vector: Variant = plan.get(field)
		if not _valid_vector(vector): errors.append("invalid targeting " + field)
	if _valid_vector(plan.get("viewForward")) and Vector3(float(plan.viewForward.x), float(plan.viewForward.y), float(plan.viewForward.z)).length() <= 0.000000000001: errors.append("zero targeting view forward")
	if not _finite_number(plan.get("initialSwitchCooldownSeconds")) or float(plan.get("initialSwitchCooldownSeconds", -1)) < 0.0: errors.append("invalid targeting cooldown")
	if typeof(plan.get("candidates")) != TYPE_ARRAY or typeof(plan.get("events")) != TYPE_ARRAY: return errors + ["invalid targeting plan collections"]
	var ids := {}
	for candidate in plan.candidates:
		if typeof(candidate) != TYPE_DICTIONARY or typeof(candidate.get("id")) != TYPE_STRING or candidate.get("id").is_empty() or ids.has(candidate.get("id")): errors.append("invalid targeting candidate ID"); continue
		ids[candidate.id] = true
		for key in candidate:
			if not ["id", "targetPoint", "targetable", "priority", "obstruction"].has(key): errors.append("unsupported targeting candidate field")
		if not _valid_vector(candidate.get("targetPoint")) or typeof(candidate.get("targetable")) != TYPE_BOOL or not _finite_number(candidate.get("priority")) or float(candidate.get("priority", -1)) < 0.0 or float(candidate.get("priority", 2)) > 1.0 or not ["none", "controlled-wall"].has(candidate.get("obstruction")): errors.append("invalid targeting candidate")
		if _same_point(candidate.get("targetPoint"), plan.get("origin")) and not (plan.get("id") == "eligibility" and candidate.get("id") == "overlap"): errors.append("invalid targeting candidate direction")
	if plan.get("initialTargetId") != null and not ids.has(plan.get("initialTargetId")): errors.append("invalid initial target")
	var steps := ceili(float(plan.get("durationSeconds", 0)) / float(plan.get("fixedDeltaSeconds", 1)) - 0.000000000001) if _finite_number(plan.get("durationSeconds")) and _finite_number(plan.get("fixedDeltaSeconds")) and float(plan.get("fixedDeltaSeconds")) > 0.0 else 0
	var event_keys := {}
	for event in plan.events:
		if typeof(event) != TYPE_DICTIONARY or not _finite_number(event.get("step")) or int(event.get("step", 0)) < 1 or int(event.get("step", 0)) > steps or absf(float(event.get("step", 0)) - int(event.get("step", 0))) > 0.0 or not ["request-acquire", "set-obstruction", "set-targetable", "move-target", "request-switch"].has(event.get("type")): errors.append("invalid targeting event"); continue
		if ["set-obstruction", "set-targetable", "move-target"].has(event.type) and not ids.has(event.get("targetId")): errors.append("invalid targeting event target")
		var event_type := str(event.get("type", ""))
		var allowed: Array = ["step", "type"]

		if event.type == "set-obstruction":
			allowed += ["targetId", "obstruction"]
			if not ["none", "controlled-wall"].has(event.get("obstruction")):
				errors.append("invalid obstruction event")

		elif event.type == "set-targetable":
			allowed += ["targetId", "targetable"]
			if typeof(event.get("targetable")) != TYPE_BOOL:
				errors.append("invalid targetable event")

		elif event.type == "move-target":
			allowed += ["targetId", "targetPoint"]
			if not _valid_vector(event.get("targetPoint")) or _same_point(event.get("targetPoint"), plan.get("origin")):
				errors.append("invalid move event")

		elif event.type == "request-switch":
			allowed += ["direction"]
			if not ["left", "right"].has(event.get("direction")):
				errors.append("invalid switch event")

		for key in event:
			if not allowed.has(key):
				errors.append("unsupported targeting event field: " + str(key))
		var event_key := "%s:%s:%s" % [event.step, event.type, event.get("targetId", "")]
		if event_keys.has(event_key): errors.append("duplicate targeting event")
		event_keys[event_key] = true
	return errors

static func _valid_vector(value: Variant) -> bool: return typeof(value) == TYPE_DICTIONARY and _finite_number(value.get("x")) and _finite_number(value.get("y")) and _finite_number(value.get("z"))
static func _same_point(left: Variant, right: Variant) -> bool: return _valid_vector(left) and _valid_vector(right) and float(left.x) == float(right.x) and float(left.y) == float(right.y) and float(left.z) == float(right.z)

static func response(request: Dictionary, command_id: String, status: String, metrics: Dictionary, validation_errors: Array = [], runtime_errors: Array = []) -> Dictionary:
	return { "schemaVersion": SCHEMA_VERSION, "commandId": command_id, "fixtureId": str(request.get("fixtureId", "")), "correlationId": str(request.get("correlationId", "")), "status": status, "metrics": metrics, "warnings": [], "validationErrors": validation_errors, "runtimeErrors": runtime_errors, "changedFiles": [], "evidence": { "godotVersion": Engine.get_version_info().get("string", "unknown"), "physicsTicksPerSecond": Engine.physics_ticks_per_second } }

static func _finite_number(value: Variant) -> bool: return (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value))
