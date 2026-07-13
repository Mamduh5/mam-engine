class_name DamageReactionProfileRuntime
extends RefCounted

const FIELDS := ["schemaVersion", "kind", "id", "displayName", "staggerThreshold", "hitReactionDurationSeconds", "staggerDurationSeconds"]

static func validate(profile: Variant) -> Array[String]:
	var errors: Array[String] = []
	if typeof(profile) != TYPE_DICTIONARY: return ["damage reaction profile must be an object"]
	for key: Variant in profile:
		if not FIELDS.has(key): errors.append("unsupported damage reaction field")
	for field: String in FIELDS:
		if not profile.has(field): errors.append("missing damage reaction field: " + field)
	if profile.get("schemaVersion") != 1 or profile.get("kind") != "damage-reaction-profile": errors.append("unsupported damage reaction profile")
	if typeof(profile.get("id")) != TYPE_STRING or profile.get("id").is_empty() or typeof(profile.get("displayName")) != TYPE_STRING or profile.get("displayName").is_empty(): errors.append("invalid damage reaction identity")
	for field: String in ["staggerThreshold", "hitReactionDurationSeconds", "staggerDurationSeconds"]:
		if not _finite_number(profile.get(field)) or float(profile.get(field, 0.0)) <= 0.0: errors.append(field + " must be finite and greater than zero")
	return errors

static func _finite_number(value: Variant) -> bool: return (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value))
