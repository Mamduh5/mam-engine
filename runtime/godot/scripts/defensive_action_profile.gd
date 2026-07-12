class_name DefensiveActionProfileRuntime
extends RefCounted

const FIELDS := ["schemaVersion", "kind", "id", "displayName", "durationSeconds", "staminaCost", "movementDistance", "invulnerabilityStartSeconds", "invulnerabilityEndSeconds", "cooldownSeconds"]

static func validate(profile: Variant) -> Array[String]:
	var errors: Array[String] = []
	if typeof(profile) != TYPE_DICTIONARY: return ["profile must be an object"]
	for key in profile:
		if not FIELDS.has(key): errors.append("unsupported defensive action field")
	if profile.get("schemaVersion") != 1 or profile.get("kind") != "defensive-action-profile": errors.append("unsupported defensive action profile")
	if typeof(profile.get("id")) != TYPE_STRING or profile.get("id").is_empty() or typeof(profile.get("displayName")) != TYPE_STRING or profile.get("displayName").is_empty(): errors.append("invalid defensive action identity")
	for field in ["durationSeconds", "staminaCost", "movementDistance", "invulnerabilityStartSeconds", "invulnerabilityEndSeconds", "cooldownSeconds"]:
		if not _finite_number(profile.get(field)): errors.append("%s must be finite" % field)
	if errors.is_empty():
		if float(profile.durationSeconds) <= 0.0: errors.append("durationSeconds must be positive")
		for field in ["staminaCost", "movementDistance", "invulnerabilityStartSeconds", "invulnerabilityEndSeconds", "cooldownSeconds"]:
			if float(profile[field]) < 0.0: errors.append("%s must be non-negative" % field)
		if float(profile.invulnerabilityStartSeconds) > float(profile.invulnerabilityEndSeconds) or float(profile.invulnerabilityEndSeconds) > float(profile.durationSeconds): errors.append("invalid invulnerability window")
	return errors

static func _finite_number(value: Variant) -> bool: return (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value))
