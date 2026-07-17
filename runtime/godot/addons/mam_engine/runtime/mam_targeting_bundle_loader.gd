class_name MamTargetingBundleLoader
extends RefCounted

const BUNDLE_SCHEMA := "mam.godot-targeting-runtime-bundle/v1"
const ADAPTER_CONTRACT := "mam.godot-targeting-adapter/v1"

static func load_bundle(bundle_path: String = "res://mam_generated/mam_targeting_runtime_bundle.json") -> Dictionary:
	if not FileAccess.file_exists(bundle_path):
		return _failure("MAM_BUNDLE_MISSING", bundle_path, "Targeting runtime bundle is missing")
	var file := FileAccess.open(bundle_path, FileAccess.READ)
	if file == null:
		return _failure("MAM_BUNDLE_READ_FAILED", bundle_path, "Targeting runtime bundle could not be read")
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		return _failure("MAM_BUNDLE_MALFORMED", bundle_path, "Targeting runtime bundle is not a JSON object")
	if parsed.get("schemaVersion") != BUNDLE_SCHEMA:
		return _failure("MAM_BUNDLE_VERSION_UNSUPPORTED", "schemaVersion", "Targeting runtime bundle contract is unsupported")
	var integrity: Variant = parsed.get("integrity")
	var payload_json: Variant = parsed.get("payloadJson")
	if typeof(integrity) != TYPE_DICTIONARY or typeof(payload_json) != TYPE_STRING or integrity.get("algorithm") != "sha256" or typeof(integrity.get("payloadSha256")) != TYPE_STRING:
		return _failure("MAM_BUNDLE_FIELDS_INVALID", bundle_path, "Targeting runtime bundle integrity fields are incomplete")
	if _sha256_text(payload_json) != integrity.payloadSha256:
		return _failure("MAM_BUNDLE_INTEGRITY_MISMATCH", "integrity.payloadSha256", "Targeting runtime bundle payload integrity check failed")
	var payload: Variant = JSON.parse_string(payload_json)
	if typeof(payload) != TYPE_DICTIONARY or payload.get("adapterContractVersion") != ADAPTER_CONTRACT:
		return _failure("MAM_ADAPTER_CONTRACT_UNSUPPORTED", "adapterContractVersion", "Targeting adapter contract is unsupported")
	if typeof(payload.get("packageVersion")) != TYPE_STRING:
		return _failure("MAM_BUNDLE_FIELDS_INVALID", "packageVersion", "Targeting runtime package version is missing")
	var definition: Variant = payload.get("definition")
	if typeof(definition) != TYPE_DICTIONARY:
		return _failure("MAM_BUNDLE_FIELDS_INVALID", "definition", "Targeting definition payload is missing")
	if definition.get("kind") != "targeting-profile":
		return _failure("MAM_DEFINITION_KIND_UNSUPPORTED", "definition.kind", "Expected targeting-profile")
	if definition.get("schemaVersion") != 1:
		return _failure("MAM_DEFINITION_SCHEMA_UNSUPPORTED", "definition.schemaVersion", "Expected targeting schemaVersion 1")
	if typeof(definition.get("sourcePath")) != TYPE_STRING or typeof(definition.get("sourceSha256")) != TYPE_STRING or typeof(definition.get("profile")) != TYPE_DICTIONARY:
		return _failure("MAM_BUNDLE_FIELDS_INVALID", "definition", "Targeting definition fields are incomplete")
	if not _safe_source_path(str(definition.sourcePath)):
		return _failure("MAM_BUNDLE_FIELDS_INVALID", "definition.sourcePath", "Targeting source path must be project-relative")
	var source_path := "res://" + str(definition.sourcePath)
	if not FileAccess.file_exists(source_path):
		return _failure("MAM_SOURCE_MISSING", str(definition.sourcePath), "Canonical targeting source is missing")
	var source_file := FileAccess.open(source_path, FileAccess.READ)
	if source_file == null:
		return _failure("MAM_SOURCE_READ_FAILED", str(definition.sourcePath), "Canonical targeting source is inaccessible")
	source_file.close()
	if FileAccess.get_sha256(source_path) != definition.sourceSha256:
		return _failure("MAM_SOURCE_HASH_MISMATCH", str(definition.sourcePath), "Canonical targeting source changed after sync")
	var required := _required_profile_error(definition.profile)
	if not required.is_empty():
		return _failure("MAM_PROFILE_FIELDS_INVALID", required, "Normalized targeting profile is incomplete")
	return {"status": "passed", "data": {"packageVersion": payload.packageVersion, "adapterContractVersion": ADAPTER_CONTRACT, "sourcePath": definition.sourcePath, "sourceSha256": definition.sourceSha256, "profile": definition.profile}, "diagnostics": []}

static func _required_profile_error(profile: Dictionary) -> String:
	for key in ["schemaVersion", "kind", "id", "displayName", "acquisition", "scoring", "retention", "switching"]:
		if not profile.has(key): return "profile." + key
	if profile.schemaVersion != 1 or profile.kind != "targeting-profile": return "profile.kind"
	for key in ["id", "displayName"]:
		if typeof(profile[key]) != TYPE_STRING or str(profile[key]).is_empty(): return "profile." + key
	var groups := {"acquisition": ["maximumDistance", "maximumAngleDegrees"], "scoring": ["distanceWeight", "angleWeight", "priorityWeight"], "retention": ["maximumDistanceMultiplier", "additionalAngleDegrees", "lostTargetGraceSeconds"], "switching": ["cooldownSeconds", "maximumAngleDegrees", "minimumSeparationDegrees"]}
	for group in groups:
		if typeof(profile[group]) != TYPE_DICTIONARY: return "profile." + group
		for field in groups[group]:
			if not profile[group].has(field) or not _finite_number(profile[group][field]): return "profile.%s.%s" % [group, field]
	for pair in [["acquisition", "requireLineOfSight"], ["retention", "autoReacquire"], ["switching", "enabled"]]:
		if not profile[pair[0]].has(pair[1]) or typeof(profile[pair[0]][pair[1]]) != TYPE_BOOL: return "profile.%s.%s" % pair
	return ""

static func _safe_source_path(value: String) -> bool:
	if value.is_empty() or value.begins_with("/") or value.contains("\\") or value.contains(":"): return false
	for segment in value.split("/"):
		if segment.is_empty() or segment == "." or segment == "..": return false
	return true

static func _finite_number(value: Variant) -> bool:
	return (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value))

static func _sha256_text(value: String) -> String:
	var context := HashingContext.new(); context.start(HashingContext.HASH_SHA256); context.update(value.to_utf8_buffer()); return context.finish().hex_encode()

static func _failure(code: String, path: String, message: String) -> Dictionary:
	return {"status": "failed", "data": {}, "diagnostics": [{"code": code, "severity": "error", "path": path, "message": message}]}
