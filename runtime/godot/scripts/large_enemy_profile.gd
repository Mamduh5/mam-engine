class_name LargeEnemyProfileRuntime
extends RefCounted

const ContactVolumeProfileRuntime = preload("res://scripts/contact_volume_profile.gd")
const FIELDS: Array[String] = ["schemaVersion", "kind", "id", "displayName", "healthFile", "reactionFile", "telegraphName", "idleDurationSeconds", "telegraphDurationSeconds", "attackDurationSeconds", "recoveryDurationSeconds", "bodyParts"]
const BODY_PART_FIELDS: Array[String] = ["id", "displayName", "hurtboxFile", "targetPoint", "targetable"]
const VECTOR_FIELDS: Array[String] = ["x", "y", "z"]

static func validate(value: Variant) -> Array[String]:
	var errors: Array[String] = []
	if typeof(value) != TYPE_DICTIONARY: return ["large-enemy profile must be an object"]
	var profile: Dictionary = value
	for key: Variant in profile:
		if not FIELDS.has(str(key)): errors.append("unsupported large-enemy field")
	for field: String in FIELDS:
		if not profile.has(field): errors.append("missing large-enemy field: " + field)
	if profile.get("schemaVersion") != 1 or profile.get("kind") != "large-enemy-profile": errors.append("unsupported large-enemy profile")
	for field: String in ["id", "displayName", "healthFile", "reactionFile", "telegraphName"]:
		if typeof(profile.get(field)) != TYPE_STRING or str(profile.get(field)).strip_edges().is_empty(): errors.append("invalid large-enemy " + field)
	var total_duration: float = 0.0
	for field: String in ["idleDurationSeconds", "telegraphDurationSeconds", "attackDurationSeconds", "recoveryDurationSeconds"]:
		if not _finite(profile.get(field)) or float(profile.get(field, -1.0)) < 0.0: errors.append("invalid large-enemy duration")
		else: total_duration += float(profile.get(field))
	if total_duration <= 0.0: errors.append("large-enemy cycle duration must be positive")
	if typeof(profile.get("bodyParts")) != TYPE_ARRAY: return errors + ["large-enemy body parts must be an array"]
	var ids: Dictionary = {}; var targetable_count: int = 0
	for part_value: Variant in profile.bodyParts:
		if typeof(part_value) != TYPE_DICTIONARY: errors.append("large-enemy body part must be an object"); continue
		var part: Dictionary = part_value
		for key: Variant in part:
			if not BODY_PART_FIELDS.has(str(key)): errors.append("unsupported large-enemy body-part field")
		for field: String in ["id", "displayName", "hurtboxFile"]:
			if typeof(part.get(field)) != TYPE_STRING or str(part.get(field)).strip_edges().is_empty(): errors.append("invalid large-enemy body-part " + field)
		var part_id: String = str(part.get("id", "")); if ids.has(part_id): errors.append("duplicate large-enemy body-part ID"); ids[part_id] = true
		if typeof(part.get("targetable")) != TYPE_BOOL: errors.append("invalid large-enemy body-part targetability")
		elif bool(part.targetable): targetable_count += 1
		var point: Variant = part.get("targetPoint")
		if typeof(point) != TYPE_DICTIONARY: errors.append("large-enemy target point must be an object")
		else:
			for key: Variant in point:
				if not VECTOR_FIELDS.has(str(key)): errors.append("unsupported large-enemy target-point field")
			for axis: String in VECTOR_FIELDS:
				if not _finite(point.get(axis)): errors.append("large-enemy target point must be finite")
	if targetable_count == 0: errors.append("large-enemy requires a targetable body part")
	return errors

static func validate_references(profile: Dictionary, paths_value: Variant, hurtboxes_value: Variant) -> Array[String]:
	var errors: Array[String] = []
	if typeof(paths_value) != TYPE_DICTIONARY: return ["large-enemy resolved paths must be an object"]
	var paths: Dictionary = paths_value
	if typeof(paths.get("healthFile")) != TYPE_STRING or str(paths.get("healthFile")).is_empty(): errors.append("invalid large-enemy resolved health path")
	if typeof(paths.get("reactionFile")) != TYPE_STRING or str(paths.get("reactionFile")).is_empty(): errors.append("invalid large-enemy resolved reaction path")
	if typeof(paths.get("bodyParts")) != TYPE_ARRAY or typeof(hurtboxes_value) != TYPE_ARRAY: return errors + ["large-enemy resolved body-part references must be arrays"]
	var resolved_parts: Array = paths.bodyParts; var hurtboxes: Array = hurtboxes_value; var body_parts: Array = profile.get("bodyParts", [])
	if resolved_parts.size() != body_parts.size() or hurtboxes.size() != body_parts.size(): errors.append("large-enemy body-part references must preserve declaration order"); return errors
	for index: int in range(body_parts.size()):
		var part: Dictionary = body_parts[index]; var resolved: Variant = resolved_parts[index]; var hurtbox: Variant = hurtboxes[index]
		if typeof(resolved) != TYPE_DICTIONARY or resolved.get("id") != part.get("id") or typeof(resolved.get("hurtboxFile")) != TYPE_STRING or str(resolved.get("hurtboxFile")).is_empty(): errors.append("invalid large-enemy resolved body-part path")
		var hurtbox_errors: Array[String] = ContactVolumeProfileRuntime.validate(hurtbox); errors.append_array(hurtbox_errors)
		if hurtbox_errors.is_empty() and hurtbox.get("role") != "hurtbox": errors.append("large-enemy body-part contact volume must be a hurtbox")
	return errors

static func _finite(value: Variant) -> bool: return (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value))
