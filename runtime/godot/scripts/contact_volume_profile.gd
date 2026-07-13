class_name ContactVolumeProfileRuntime
extends RefCounted

const FIELDS := ["schemaVersion", "kind", "id", "displayName", "role", "center", "radius", "activeStartSeconds", "activeEndSeconds"]
const CENTER_FIELDS := ["x", "y", "z"]

static func validate(profile: Variant) -> Array[String]:
	var errors: Array[String] = []
	if typeof(profile) != TYPE_DICTIONARY: return ["contact volume profile must be an object"]
	for key: Variant in profile:
		if not FIELDS.has(key): errors.append("unsupported contact volume field")
	for field: String in FIELDS:
		if not profile.has(field): errors.append("missing contact volume field: " + field)
	if profile.get("schemaVersion") != 1 or profile.get("kind") != "contact-volume-profile": errors.append("unsupported contact volume profile")
	if typeof(profile.get("id")) != TYPE_STRING or profile.get("id").is_empty() or typeof(profile.get("displayName")) != TYPE_STRING or profile.get("displayName").is_empty(): errors.append("invalid contact volume identity")
	if not ["hitbox", "hurtbox"].has(profile.get("role")): errors.append("invalid contact volume role")
	var center: Variant = profile.get("center")
	if typeof(center) != TYPE_DICTIONARY:
		errors.append("contact volume center must be an object")
	else:
		for key: Variant in center:
			if not CENTER_FIELDS.has(key): errors.append("unsupported contact volume center field")
		for axis: String in CENTER_FIELDS:
			if not _finite_number(center.get(axis)): errors.append("contact volume center must be finite")
	if not _finite_number(profile.get("radius")) or float(profile.get("radius", 0.0)) <= 0.0: errors.append("contact volume radius must be greater than zero")
	if not _finite_number(profile.get("activeStartSeconds")) or float(profile.get("activeStartSeconds", -1.0)) < 0.0: errors.append("contact volume active start must be non-negative")
	if not _finite_number(profile.get("activeEndSeconds")) or float(profile.get("activeEndSeconds", -1.0)) < 0.0: errors.append("contact volume active end must be non-negative")
	if _finite_number(profile.get("activeStartSeconds")) and _finite_number(profile.get("activeEndSeconds")) and float(profile.activeEndSeconds) < float(profile.activeStartSeconds): errors.append("contact volume active end must not precede start")
	return errors

static func _finite_number(value: Variant) -> bool: return (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value))
