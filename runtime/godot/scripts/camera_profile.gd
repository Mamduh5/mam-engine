extends RefCounted

static func validate(profile: Variant) -> Array[String]:
	var errors: Array[String] = []
	if typeof(profile) != TYPE_DICTIONARY: return ["profile must be an object"]
	if profile.get("schemaVersion") != 1 or profile.get("kind") != "camera-profile": errors.append("unsupported camera profile")
	var groups := {"orbit": ["yawSpeedDegreesPerSecond", "pitchSpeedDegreesPerSecond", "minimumPitchDegrees", "maximumPitchDegrees", "initialYawDegrees", "initialPitchDegrees"], "follow": ["distance", "height", "shoulderOffset", "lookAtHeight", "positionHalfLifeSeconds", "rotationHalfLifeSeconds"], "recenter": ["delaySeconds", "yawSpeedDegreesPerSecond", "movementInputThreshold"], "collision": ["probeRadius", "minimumDistance", "returnHalfLifeSeconds"], "lens": ["fieldOfViewDegrees", "nearClipDistance", "farClipDistance"]}
	for group in groups:
		var value: Variant = profile.get(group)
		if typeof(value) != TYPE_DICTIONARY: errors.append("%s must be an object" % group)
		else:
			for field in groups[group]:
				if not _finite_number(value.get(field)): errors.append("%s.%s must be a finite number" % [group, field])
	for pair in [["orbit", "invertYaw"], ["orbit", "invertPitch"], ["recenter", "enabled"], ["collision", "enabled"]]:
		var object: Variant = profile.get(pair[0])
		if typeof(object) != TYPE_DICTIONARY or typeof(object.get(pair[1])) != TYPE_BOOL: errors.append("%s.%s must be boolean" % pair)
	if errors.is_empty():
		if float(profile.orbit.yawSpeedDegreesPerSecond) <= 0.0 or float(profile.orbit.pitchSpeedDegreesPerSecond) <= 0.0: errors.append("camera orbit speeds must be positive")
		if float(profile.orbit.minimumPitchDegrees) < -89.0 or float(profile.orbit.maximumPitchDegrees) > 89.0 or float(profile.orbit.minimumPitchDegrees) >= float(profile.orbit.maximumPitchDegrees): errors.append("invalid camera pitch range")
		if float(profile.orbit.initialPitchDegrees) < float(profile.orbit.minimumPitchDegrees) or float(profile.orbit.initialPitchDegrees) > float(profile.orbit.maximumPitchDegrees): errors.append("initial pitch is outside range")
		if float(profile.follow.distance) <= 0.0 or float(profile.follow.height) < 0.0 or float(profile.follow.positionHalfLifeSeconds) < 0.0 or float(profile.follow.rotationHalfLifeSeconds) < 0.0: errors.append("invalid camera follow values")
		if float(profile.recenter.delaySeconds) < 0.0 or float(profile.recenter.yawSpeedDegreesPerSecond) <= 0.0 or float(profile.recenter.movementInputThreshold) < 0.0 or float(profile.recenter.movementInputThreshold) > 1.0: errors.append("invalid camera recenter values")
		if float(profile.collision.probeRadius) <= 0.0 or float(profile.collision.minimumDistance) <= 0.0 or float(profile.collision.minimumDistance) > float(profile.follow.distance) or float(profile.collision.returnHalfLifeSeconds) < 0.0: errors.append("invalid camera collision values")
		if float(profile.lens.fieldOfViewDegrees) < 20.0 or float(profile.lens.fieldOfViewDegrees) > 120.0 or float(profile.lens.nearClipDistance) <= 0.0 or float(profile.lens.farClipDistance) <= float(profile.lens.nearClipDistance): errors.append("invalid camera lens values")
	return errors

static func _finite_number(value: Variant) -> bool: return (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value))
