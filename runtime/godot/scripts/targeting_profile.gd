class_name TargetingProfileRuntime
extends RefCounted

static func validate(value: Variant) -> Array[String]:
	var errors: Array[String] = []
	if typeof(value) != TYPE_DICTIONARY: return ["targeting profile must be an object"]
	if value.get("schemaVersion") != 1 or value.get("kind") != "targeting-profile": errors.append("unsupported targeting profile")
	for section in ["acquisition", "scoring", "retention", "switching"]:
		if typeof(value.get(section)) != TYPE_DICTIONARY: errors.append("missing targeting section: " + section)
	if not errors.is_empty(): return errors
	var acquisition: Dictionary = value.acquisition; var scoring: Dictionary = value.scoring; var retention: Dictionary = value.retention; var switching: Dictionary = value.switching
	for field in ["maximumDistance", "maximumAngleDegrees"]:
		if not _finite(acquisition.get(field)) or float(acquisition.get(field, 0)) <= 0.0: errors.append("invalid targeting acquisition " + field)
	if _finite(acquisition.get("maximumAngleDegrees")) and float(acquisition.maximumAngleDegrees) > 180.0: errors.append("targeting acquisition angle exceeds 180")
	if typeof(acquisition.get("requireLineOfSight")) != TYPE_BOOL: errors.append("invalid targeting line of sight")
	for field in ["distanceWeight", "angleWeight", "priorityWeight"]:
		if not _finite(scoring.get(field)) or float(scoring.get(field, -1)) < 0.0 or float(scoring.get(field, 2)) > 1.0: errors.append("invalid targeting scoring " + field)
	if _finite(scoring.get("distanceWeight")) and _finite(scoring.get("angleWeight")) and _finite(scoring.get("priorityWeight")) and absf(float(scoring.distanceWeight) + float(scoring.angleWeight) + float(scoring.priorityWeight) - 1.0) > 0.000000001: errors.append("targeting scoring weights must sum to one")
	for field in ["maximumDistanceMultiplier", "additionalAngleDegrees", "lostTargetGraceSeconds"]:
		if not _finite(retention.get(field)) or float(retention.get(field, -1)) < 0.0: errors.append("invalid targeting retention " + field)
	if _finite(retention.get("maximumDistanceMultiplier")) and float(retention.maximumDistanceMultiplier) < 1.0: errors.append("targeting retention distance multiplier below one")
	if _finite(acquisition.get("maximumAngleDegrees")) and _finite(retention.get("additionalAngleDegrees")) and float(acquisition.maximumAngleDegrees) + float(retention.additionalAngleDegrees) > 180.0: errors.append("targeting retention angle exceeds 180")
	if typeof(retention.get("autoReacquire")) != TYPE_BOOL: errors.append("invalid targeting auto reacquire")
	for field in ["cooldownSeconds", "maximumAngleDegrees", "minimumSeparationDegrees"]:
		if not _finite(switching.get(field)) or float(switching.get(field, -1)) < 0.0: errors.append("invalid targeting switching " + field)
	if _finite(switching.get("maximumAngleDegrees")) and (float(switching.maximumAngleDegrees) <= 0.0 or float(switching.maximumAngleDegrees) > 180.0): errors.append("invalid targeting switching angle")
	if _finite(switching.get("minimumSeparationDegrees")) and _finite(switching.get("maximumAngleDegrees")) and float(switching.minimumSeparationDegrees) >= float(switching.maximumAngleDegrees): errors.append("invalid targeting switching separation")
	if typeof(switching.get("enabled")) != TYPE_BOOL: errors.append("invalid targeting switching enabled")
	return errors

static func _finite(value: Variant) -> bool: return (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value))
