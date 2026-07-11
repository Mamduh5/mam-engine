class_name RuntimeProtocol
extends RefCounted

const SCHEMA_VERSION := "mam.runtime/v1"
const COMMAND_ID := "runtime.fixture.run"
const FIXTURE_ID := "movement/basic-ground"
const SCENARIOS := ["accelerate", "stop", "sprint", "dodge", "turn"]

static func validate_request(request: Variant) -> Array[String]:
	var errors: Array[String] = []
	if typeof(request) != TYPE_DICTIONARY:
		return ["request must be an object"]
	if request.get("schemaVersion") != SCHEMA_VERSION: errors.append("unsupported protocol version")
	if request.get("commandId") != COMMAND_ID: errors.append("unknown command ID")
	if request.get("fixtureId") != FIXTURE_ID: errors.append("unknown fixture ID")
	if typeof(request.get("correlationId")) != TYPE_STRING or request.get("correlationId").is_empty(): errors.append("missing correlation ID")
	if not _finite_number(request.get("timeoutMs")) or float(request.get("timeoutMs", 0)) <= 0.0 or float(request.get("timeoutMs", 0)) > 60000.0: errors.append("invalid timeout")
	var payload: Variant = request.get("payload")
	if typeof(payload) != TYPE_DICTIONARY:
		return errors + ["payload must be an object"]
	if payload.get("definitionSchemaVersion") != 1: errors.append("unsupported movement schema version")
	errors.append_array(MovementProfileRuntime.validate(payload.get("profile")))
	var scenario: Variant = payload.get("scenario")
	if typeof(scenario) != TYPE_DICTIONARY:
		return errors + ["scenario must be an object"]
	if not SCENARIOS.has(scenario.get("id")): errors.append("unsupported scenario")
	if not _finite_number(scenario.get("durationSeconds")) or float(scenario.get("durationSeconds", 0)) <= 0.0: errors.append("invalid scenario duration")
	if not _finite_number(scenario.get("fixedDeltaSeconds")) or abs(float(scenario.get("fixedDeltaSeconds", 0)) - (1.0 / 60.0)) > 0.000000001: errors.append("invalid fixed timestep")
	if not _finite_number(scenario.get("cameraYawDegrees")): errors.append("invalid camera yaw")
	return errors

static func response(request: Dictionary, command_id: String, status: String, metrics: Dictionary, validation_errors: Array = [], runtime_errors: Array = []) -> Dictionary:
	return {
		"schemaVersion": SCHEMA_VERSION, "commandId": command_id, "fixtureId": FIXTURE_ID,
		"correlationId": str(request.get("correlationId", "")), "status": status, "metrics": metrics,
		"warnings": [], "validationErrors": validation_errors, "runtimeErrors": runtime_errors, "changedFiles": [],
		"evidence": { "godotVersion": Engine.get_version_info().get("string", "unknown"), "physicsTicksPerSecond": Engine.physics_ticks_per_second }
	}

static func _finite_number(value: Variant) -> bool:
	return (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value))
