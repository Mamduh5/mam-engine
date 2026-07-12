class_name StaminaProfileRuntime
extends RefCounted

const FIELDS := ["schemaVersion", "kind", "id", "displayName", "maxStamina", "startingStamina"]

static func validate(profile: Variant) -> Array[String]:
	var errors: Array[String] = []
	if typeof(profile) != TYPE_DICTIONARY: return ["profile must be an object"]
	for key in profile:
		if not FIELDS.has(key): errors.append("unsupported stamina field")
	if profile.get("schemaVersion") != 1 or profile.get("kind") != "stamina-profile": errors.append("unsupported stamina profile")
	if typeof(profile.get("id")) != TYPE_STRING or profile.get("id").is_empty() or typeof(profile.get("displayName")) != TYPE_STRING or profile.get("displayName").is_empty(): errors.append("invalid stamina identity")
	for field in ["maxStamina", "startingStamina"]:
		if not _finite_number(profile.get(field)): errors.append("%s must be finite" % field)
	if errors.is_empty() and (float(profile.maxStamina) <= 0.0 or float(profile.startingStamina) < 0.0 or float(profile.startingStamina) > float(profile.maxStamina)): errors.append("invalid stamina values")
	return errors

static func _finite_number(value: Variant) -> bool: return (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value))
