class_name MovementProfileRuntime
extends RefCounted

static func validate(profile: Variant) -> Array[String]:
	var errors: Array[String] = []
	if typeof(profile) != TYPE_DICTIONARY:
		return ["profile must be an object"]
	if profile.get("schemaVersion") != 1:
		errors.append("unsupported movement schema version")
	var ground: Variant = profile.get("ground")
	var stamina: Variant = profile.get("stamina")
	var dodge: Variant = profile.get("dodge")
	if typeof(ground) != TYPE_DICTIONARY or ground.get("orientationMode") != "camera_relative":
		errors.append("unsupported orientation mode")
	else:
		_validate_numbers(errors, ground, ["walkSpeed", "runSpeed", "sprintSpeed", "acceleration", "deceleration", "rotationSpeedDegrees"], "ground")
	if typeof(stamina) != TYPE_DICTIONARY:
		errors.append("stamina must be an object")
	else:
		_validate_numbers(errors, stamina, ["maximum", "sprintCostPerSecond", "regenerationPerSecond", "regenerationDelaySeconds", "minimumToStartSprint"], "stamina")
	if typeof(dodge) != TYPE_DICTIONARY or dodge.get("directionMode") != "movement_input":
		errors.append("unsupported dodge direction mode")
	else:
		_validate_numbers(errors, dodge, ["distance", "durationSeconds", "staminaCost", "invulnerabilityStartSeconds", "invulnerabilityEndSeconds", "steeringMultiplier"], "dodge")
	return errors

static func _validate_numbers(errors: Array[String], object: Dictionary, fields: Array, prefix: String) -> void:
	for field in fields:
		var value: Variant = object.get(field)
		if not (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) or not is_finite(float(value)):
			errors.append("%s.%s must be a finite number" % [prefix, field])
