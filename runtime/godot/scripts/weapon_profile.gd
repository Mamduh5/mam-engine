class_name WeaponProfileRuntime
extends RefCounted

const EPSILON := 0.000000000001

static func validate(value: Variant) -> Array[String]:
	var errors: Array[String] = []
	if typeof(value) != TYPE_DICTIONARY: return ["weapon profile must be an object"]
	var profile: Dictionary = value
	var allowed: Array[String] = ["schemaVersion", "kind", "id", "displayName", "offensiveActionFile", "actionTimelineFile", "hitboxFile", "hitboxEnableEventId", "hitboxDisableEventId"]
	for key: Variant in profile:
		if not allowed.has(str(key)): errors.append("unsupported weapon field")
	if profile.get("schemaVersion") != 1 or profile.get("kind") != "weapon-profile": errors.append("unsupported weapon profile")
	for field: String in ["id", "displayName", "offensiveActionFile", "actionTimelineFile", "hitboxFile", "hitboxEnableEventId", "hitboxDisableEventId"]:
		if typeof(profile.get(field)) != TYPE_STRING or str(profile.get(field)).strip_edges().is_empty(): errors.append("invalid weapon " + field)
	return errors

static func validate_timeline(value: Variant) -> Array[String]:
	var errors: Array[String] = []
	if typeof(value) != TYPE_DICTIONARY: return ["weapon action timeline must be an object"]
	var profile: Dictionary = value
	if profile.get("schemaVersion") != 1 or profile.get("kind") != "action-timeline-profile": errors.append("unsupported weapon action timeline profile")
	if not _finite(profile.get("durationSeconds")) or float(profile.get("durationSeconds", 0.0)) <= 0.0: errors.append("invalid weapon action timeline duration")
	if typeof(profile.get("animationName")) != TYPE_STRING or str(profile.get("animationName")).is_empty(): errors.append("invalid weapon animation name")
	if typeof(profile.get("events")) != TYPE_ARRAY: return errors + ["weapon action timeline events must be an array"]
	var ids: Dictionary = {}
	for event_value: Variant in profile.events:
		if typeof(event_value) != TYPE_DICTIONARY: errors.append("invalid weapon timeline event"); continue
		var event: Dictionary = event_value
		if typeof(event.get("id")) != TYPE_STRING or str(event.get("id")).is_empty() or ids.has(event.get("id")): errors.append("invalid weapon timeline event ID")
		else: ids[event.id] = true
		if typeof(event.get("name")) != TYPE_STRING or str(event.get("name")).is_empty(): errors.append("invalid weapon timeline event name")
		if not _finite(event.get("timeSeconds")) or float(event.get("timeSeconds", -1.0)) < 0.0 or float(event.get("timeSeconds", 0.0)) > float(profile.get("durationSeconds", 0.0)): errors.append("invalid weapon timeline event time")
	return errors

static func validate_references(weapon: Dictionary, action: Dictionary, timeline: Dictionary, hitbox: Dictionary, paths: Variant) -> Array[String]:
	var errors: Array[String] = []
	if typeof(paths) != TYPE_DICTIONARY: errors.append("weapon resolved definition paths must be an object")
	else:
		for field: String in ["offensiveActionFile", "actionTimelineFile", "hitboxFile"]:
			if typeof(paths.get(field)) != TYPE_STRING or str(paths.get(field)).is_empty(): errors.append("invalid weapon resolved path")
	if hitbox.get("role") != "hitbox": errors.append("weapon referenced contact volume must be a hitbox")
	if absf(float(action.get("durationSeconds", 0.0)) - float(timeline.get("durationSeconds", -1.0))) > EPSILON: errors.append("weapon action and timeline durations must match")
	if float(hitbox.get("activeStartSeconds", -1.0)) + EPSILON < float(action.get("activeStartSeconds", 0.0)) or float(hitbox.get("activeEndSeconds", 0.0)) > float(action.get("activeEndSeconds", -1.0)) + EPSILON: errors.append("weapon hitbox must remain within offensive active window")
	var enable_event: Dictionary = {}; var disable_event: Dictionary = {}
	for event_value: Variant in timeline.get("events", []):
		var event: Dictionary = event_value
		if event.get("id") == weapon.get("hitboxEnableEventId"): enable_event = event
		if event.get("id") == weapon.get("hitboxDisableEventId"): disable_event = event
	if enable_event.is_empty(): errors.append("weapon hitbox enable event is missing")
	elif absf(float(enable_event.timeSeconds) - float(hitbox.get("activeStartSeconds", -1.0))) > EPSILON: errors.append("weapon hitbox enable event time must match")
	if disable_event.is_empty(): errors.append("weapon hitbox disable event is missing")
	elif absf(float(disable_event.timeSeconds) - float(hitbox.get("activeEndSeconds", -1.0))) > EPSILON: errors.append("weapon hitbox disable event time must match")
	if not enable_event.is_empty() and not disable_event.is_empty() and float(enable_event.timeSeconds) > float(disable_event.timeSeconds) + EPSILON: errors.append("weapon hitbox enable event must not follow disable event")
	return errors

static func _finite(value: Variant) -> bool: return (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value))
