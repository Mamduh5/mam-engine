class_name HealthProfileRuntime
extends RefCounted

const FIELDS := ["schemaVersion", "kind", "id", "displayName", "maxHealth", "startingHealth"]

static func validate(profile: Variant) -> Array[String]:
	var errors: Array[String] = []
	if typeof(profile) != TYPE_DICTIONARY: return ["profile must be an object"]
	for key in profile:
		if not FIELDS.has(key): errors.append("unsupported health field")
	if profile.get("schemaVersion") != 1 or profile.get("kind") != "health-profile": errors.append("unsupported health profile")
	if typeof(profile.get("id")) != TYPE_STRING or profile.get("id").is_empty() or typeof(profile.get("displayName")) != TYPE_STRING or profile.get("displayName").is_empty(): errors.append("invalid health identity")
	for field in ["maxHealth", "startingHealth"]:
		if not _finite_number(profile.get(field)): errors.append("%s must be finite" % field)
	if errors.is_empty() and (float(profile.maxHealth) <= 0.0 or float(profile.startingHealth) < 0.0 or float(profile.startingHealth) > float(profile.maxHealth)): errors.append("invalid health values")
	return errors

static func _finite_number(value: Variant) -> bool: return (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value))
