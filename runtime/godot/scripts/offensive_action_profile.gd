class_name OffensiveActionProfileRuntime
extends RefCounted

const FIELDS := ["schemaVersion", "kind", "id", "displayName", "durationSeconds", "staminaCost", "movementDistance", "damage", "activeStartSeconds", "activeEndSeconds", "cooldownSeconds"]

static func validate(profile: Variant) -> Array[String]:
	var errors: Array[String] = []
	if typeof(profile) != TYPE_DICTIONARY: return ["profile must be an object"]
	for key in profile:
		if not FIELDS.has(key): errors.append("unsupported offensive action field")
	if profile.get("schemaVersion") != 1 or profile.get("kind") != "offensive-action-profile": errors.append("unsupported offensive action profile")
	if typeof(profile.get("id")) != TYPE_STRING or profile.get("id").is_empty() or typeof(profile.get("displayName")) != TYPE_STRING or profile.get("displayName").is_empty(): errors.append("invalid offensive action identity")
	for field in ["durationSeconds", "staminaCost", "movementDistance", "damage", "activeStartSeconds", "activeEndSeconds", "cooldownSeconds"]:
		if not _finite_number(profile.get(field)): errors.append("%s must be finite" % field)
	if errors.is_empty():
		if float(profile.durationSeconds) <= 0.0 or float(profile.damage) <= 0.0: errors.append("durationSeconds and damage must be positive")
		for field in ["staminaCost", "movementDistance", "activeStartSeconds", "activeEndSeconds", "cooldownSeconds"]:
			if float(profile[field]) < 0.0: errors.append("%s must be non-negative" % field)
		if float(profile.activeStartSeconds) > float(profile.activeEndSeconds) or float(profile.activeEndSeconds) > float(profile.durationSeconds): errors.append("invalid active window")
	return errors

static func _finite_number(value: Variant) -> bool: return (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value))
