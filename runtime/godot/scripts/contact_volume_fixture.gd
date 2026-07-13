class_name ContactVolumeFixture
extends Node3D

const EPSILON := 0.000000000001

var hitbox_profile: Dictionary = {}
var hurtbox_profile: Dictionary = {}
var physics_frames_advanced: int = 0

func configure(hitbox_value: Dictionary, hurtbox_value: Dictionary) -> void:
	hitbox_profile = hitbox_value
	hurtbox_profile = hurtbox_value

func run_scenario(scenario: Dictionary) -> Dictionary:
	if not ["overlapping-active", "window-miss"].has(scenario.id): return {}
	var delta: float = float(scenario.fixedDeltaSeconds)
	var hitbox_start_step: int = authored_step(float(hitbox_profile.activeStartSeconds), delta)
	var hitbox_end_step: int = authored_step(float(hitbox_profile.activeEndSeconds), delta)
	var hurtbox_start_step: int = authored_step(float(hurtbox_profile.activeStartSeconds), delta)
	var hurtbox_end_step: int = authored_step(float(hurtbox_profile.activeEndSeconds), delta)
	var total_steps: int = maxi(hitbox_end_step, hurtbox_end_step)
	var hitbox_area: Area3D = _create_area("Hitbox", hitbox_profile, 1, 2)
	var hurtbox_area: Area3D = _create_area("Hurtbox", hurtbox_profile, 2, 1)
	add_child(hitbox_area)
	add_child(hurtbox_area)
	_set_active(hitbox_area, true)
	_set_active(hurtbox_area, true)
	await _settle_physics()
	var spatial_overlap: bool = hitbox_area.overlaps_area(hurtbox_area)
	_set_active(hitbox_area, false)
	_set_active(hurtbox_area, false)
	await _settle_physics()
	var contact_steps: Array[int] = []
	for step: int in range(1, total_steps + 1):
		var hitbox_active: bool = step >= hitbox_start_step and step <= hitbox_end_step
		var hurtbox_active: bool = step >= hurtbox_start_step and step <= hurtbox_end_step
		_set_active(hitbox_area, hitbox_active)
		_set_active(hurtbox_area, hurtbox_active)
		await _settle_physics()
		if hitbox_active and hurtbox_active and hitbox_area.overlaps_area(hurtbox_area): contact_steps.append(step)
	var contact_occurred: bool = not contact_steps.is_empty()
	return {
		"totalSteps": total_steps,
		"hitboxActiveStartStep": hitbox_start_step,
		"hitboxActiveEndStep": hitbox_end_step,
		"hurtboxActiveStartStep": hurtbox_start_step,
		"hurtboxActiveEndStep": hurtbox_end_step,
		"spatialOverlap": spatial_overlap,
		"contactOccurred": contact_occurred,
		"firstContactStep": contact_steps[0] if contact_occurred else null,
		"lastContactStep": contact_steps[-1] if contact_occurred else null,
		"contactStepCount": contact_steps.size(),
		"finalContactState": "contacted" if contact_occurred else "no-contact",
		"physicsSteps": physics_frames_advanced
	}

func _create_area(node_name: String, profile: Dictionary, layer: int, mask: int) -> Area3D:
	var area: Area3D = Area3D.new()
	area.name = node_name
	area.position = Vector3(float(profile.center.x), float(profile.center.y), float(profile.center.z))
	area.collision_layer = layer
	area.collision_mask = mask
	area.monitoring = true
	area.monitorable = true
	var shape_node: CollisionShape3D = CollisionShape3D.new()
	var sphere: SphereShape3D = SphereShape3D.new()
	sphere.radius = float(profile.radius)
	shape_node.shape = sphere
	area.add_child(shape_node)
	return area

func _set_active(area: Area3D, active: bool) -> void:
	area.monitoring = active

func _settle_physics() -> void:
	await get_tree().physics_frame
	physics_frames_advanced += 1
	await get_tree().physics_frame
	physics_frames_advanced += 1

static func authored_step(seconds: float, delta: float) -> int: return maxi(1, ceili(seconds / delta - EPSILON))
