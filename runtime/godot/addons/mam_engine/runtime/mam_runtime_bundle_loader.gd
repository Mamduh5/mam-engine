class_name MamRuntimeBundleLoader
extends RefCounted

const BUNDLE_SCHEMA := "mam.godot-runtime-bundle/v1"
const ADAPTER_CONTRACT := "mam.godot-movement-adapter/v1"

static func load_bundle(bundle_path: String = "res://mam_generated/mam_runtime_bundle.json") -> Dictionary:
	if not FileAccess.file_exists(bundle_path):
		return _failure("MAM_BUNDLE_MISSING", bundle_path, "Runtime bundle is missing")
	var file := FileAccess.open(bundle_path, FileAccess.READ)
	if file == null:
		return _failure("MAM_BUNDLE_READ_FAILED", bundle_path, "Runtime bundle could not be read")
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		return _failure("MAM_BUNDLE_MALFORMED", bundle_path, "Runtime bundle is not a JSON object")
	if parsed.get("schemaVersion") != BUNDLE_SCHEMA:
		return _failure("MAM_BUNDLE_VERSION_UNSUPPORTED", "schemaVersion", "Runtime bundle contract is unsupported")
	var integrity: Variant = parsed.get("integrity")
	var payload_json: Variant = parsed.get("payloadJson")
	if typeof(integrity) != TYPE_DICTIONARY or typeof(payload_json) != TYPE_STRING or integrity.get("algorithm") != "sha256" or typeof(integrity.get("payloadSha256")) != TYPE_STRING:
		return _failure("MAM_BUNDLE_FIELDS_INVALID", bundle_path, "Runtime bundle integrity fields are incomplete")
	if _sha256_text(payload_json) != integrity.payloadSha256:
		return _failure("MAM_BUNDLE_INTEGRITY_MISMATCH", "integrity.payloadSha256", "Runtime bundle payload integrity check failed")
	var payload: Variant = JSON.parse_string(payload_json)
	if typeof(payload) != TYPE_DICTIONARY or payload.get("adapterContractVersion") != ADAPTER_CONTRACT:
		return _failure("MAM_ADAPTER_CONTRACT_UNSUPPORTED", "adapterContractVersion", "Movement adapter contract is unsupported")
	var definition: Variant = payload.get("definition")
	if typeof(definition) != TYPE_DICTIONARY:
		return _failure("MAM_BUNDLE_FIELDS_INVALID", "definition", "Movement definition payload is missing")
	if definition.get("kind") != "movement-profile":
		return _failure("MAM_DEFINITION_KIND_UNSUPPORTED", "definition.kind", "Expected movement-profile")
	if definition.get("schemaVersion") != 1:
		return _failure("MAM_DEFINITION_SCHEMA_UNSUPPORTED", "definition.schemaVersion", "Expected movement schemaVersion 1")
	if typeof(definition.get("sourcePath")) != TYPE_STRING or typeof(definition.get("sourceSha256")) != TYPE_STRING or typeof(definition.get("profile")) != TYPE_DICTIONARY:
		return _failure("MAM_BUNDLE_FIELDS_INVALID", "definition", "Movement definition fields are incomplete")
	var source_path := "res://" + str(definition.sourcePath)
	if not FileAccess.file_exists(source_path):
		return _failure("MAM_SOURCE_MISSING", str(definition.sourcePath), "Canonical movement source is missing")
	var source_file := FileAccess.open(source_path, FileAccess.READ)
	if source_file == null:
		return _failure("MAM_SOURCE_READ_FAILED", str(definition.sourcePath), "Canonical movement source is inaccessible")
	source_file.close()
	if FileAccess.get_sha256(source_path) != definition.sourceSha256:
		return _failure("MAM_SOURCE_HASH_MISMATCH", str(definition.sourcePath), "Canonical movement source changed after sync")
	var required := _required_profile_error(definition.profile)
	if not required.is_empty():
		return _failure("MAM_PROFILE_FIELDS_INVALID", required, "Normalized movement profile is incomplete")
	return {"status": "passed", "data": {"packageVersion": payload.get("packageVersion"), "adapterContractVersion": ADAPTER_CONTRACT, "sourcePath": definition.sourcePath, "sourceSha256": definition.sourceSha256, "profile": definition.profile}, "diagnostics": []}

static func _required_profile_error(profile: Dictionary) -> String:
	for key in ["schemaVersion", "kind", "id", "displayName", "ground", "stamina", "dodge"]:
		if not profile.has(key): return "profile." + key
	if typeof(profile.ground) != TYPE_DICTIONARY or typeof(profile.stamina) != TYPE_DICTIONARY or typeof(profile.dodge) != TYPE_DICTIONARY: return "profile"
	for key in ["walkSpeed", "runSpeed", "sprintSpeed", "acceleration", "deceleration", "rotationSpeedDegrees", "orientationMode"]:
		if not profile.ground.has(key): return "profile.ground." + key
	for key in ["maximum", "sprintCostPerSecond", "regenerationPerSecond", "regenerationDelaySeconds", "minimumToStartSprint"]:
		if not profile.stamina.has(key): return "profile.stamina." + key
	for key in ["distance", "durationSeconds", "staminaCost", "invulnerabilityStartSeconds", "invulnerabilityEndSeconds", "directionMode", "steeringMultiplier"]:
		if not profile.dodge.has(key): return "profile.dodge." + key
	for key in ["walkSpeed", "runSpeed", "sprintSpeed", "acceleration", "deceleration", "rotationSpeedDegrees"]:
		if typeof(profile.ground[key]) not in [TYPE_INT, TYPE_FLOAT]: return "profile.ground." + key
	for key in ["maximum", "sprintCostPerSecond", "regenerationPerSecond", "regenerationDelaySeconds", "minimumToStartSprint"]:
		if typeof(profile.stamina[key]) not in [TYPE_INT, TYPE_FLOAT]: return "profile.stamina." + key
	for key in ["distance", "durationSeconds", "staminaCost", "invulnerabilityStartSeconds", "invulnerabilityEndSeconds", "steeringMultiplier"]:
		if typeof(profile.dodge[key]) not in [TYPE_INT, TYPE_FLOAT]: return "profile.dodge." + key
	if profile.ground.orientationMode != "camera_relative": return "profile.ground.orientationMode"
	if profile.dodge.directionMode != "movement_input": return "profile.dodge.directionMode"
	return ""

static func _sha256_text(value: String) -> String:
	var context := HashingContext.new()
	context.start(HashingContext.HASH_SHA256)
	context.update(value.to_utf8_buffer())
	return context.finish().hex_encode()

static func _failure(code: String, path: String, message: String) -> Dictionary:
	return {"status": "failed", "data": {}, "diagnostics": [{"code": code, "severity": "error", "path": path, "message": message}]}
