class_name LargeEnemyFixture
extends Node3D

const EPSILON: float = 0.000000000001

var enemy_profile: Dictionary = {}
var resolved_paths: Dictionary = {}
var hurtbox_profiles: Array = []
var body_nodes: Array[Node3D] = []
var physics_steps: int = 0

func configure(enemy: Dictionary, paths: Dictionary, hurtboxes: Array) -> void:
	enemy_profile = enemy
	resolved_paths = paths
	hurtbox_profiles = hurtboxes

func run_scenario(scenario: Dictionary) -> Dictionary:
	var delta: float = float(scenario.fixedDeltaSeconds)
	_create_body_parts()
	if str(scenario.id) == "primary-part-disabled": _disable_primary_targetable()
	var targetable_ids: Array[String] = []; var selected_id: String = ""
	for body: Node3D in body_nodes:
		if bool(body.get_meta("targetable", false)):
			var body_id: String = str(body.get_meta("body_part_id", "")); targetable_ids.append(body_id)
			if selected_id.is_empty(): selected_id = body_id
	if selected_id.is_empty(): return {}
	var idle_end_seconds: float = float(enemy_profile.idleDurationSeconds)
	var telegraph_end_seconds: float = idle_end_seconds + float(enemy_profile.telegraphDurationSeconds)
	var attack_end_seconds: float = telegraph_end_seconds + float(enemy_profile.attackDurationSeconds)
	var cycle_end_seconds: float = attack_end_seconds + float(enemy_profile.recoveryDurationSeconds)
	var idle_end_step: int = _boundary_step(idle_end_seconds, delta)
	var telegraph_end_step: int = _boundary_step(telegraph_end_seconds, delta)
	var attack_end_step: int = _boundary_step(attack_end_seconds, delta)
	var completion_step: int = _boundary_step(cycle_end_seconds, delta)
	var transitions: Array[Dictionary] = [{"state": "idle", "step": 1}]
	var pending: Array[Dictionary] = [{"state": "telegraph", "step": idle_end_step}, {"state": "attack", "step": telegraph_end_step}, {"state": "recovery", "step": attack_end_step}, {"state": "complete", "step": completion_step}]
	var pending_index: int = 0
	for step: int in range(1, completion_step + 1):
		while pending_index < pending.size() and int(pending[pending_index].step) <= step:
			transitions.append(pending[pending_index]); pending_index += 1
		await get_tree().physics_frame; physics_steps += 1
	var runtime_parts: Array[Dictionary] = []
	for body: Node3D in body_nodes:
		var marker: Marker3D = body.get_node("TargetPoint") as Marker3D; var area: Area3D = body.get_node("Hurtbox") as Area3D; var shape_node: CollisionShape3D = area.get_node("CollisionShape3D") as CollisionShape3D; var sphere: SphereShape3D = shape_node.shape as SphereShape3D
		runtime_parts.append({"id": str(body.get_meta("body_part_id")), "targetable": bool(body.get_meta("targetable")), "targetPoint": _vector_report(marker.position), "hurtboxCenter": _vector_report(area.position), "hurtboxRadius": sphere.radius})
	return {
		"enemyId": str(enemy_profile.id), "resolvedDefinitionPaths": resolved_paths, "totalCycleDurationSeconds": cycle_end_seconds, "totalSteps": completion_step,
		"idleStartStep": 1, "idleEndStep": idle_end_step, "telegraphName": str(enemy_profile.telegraphName), "telegraphStartStep": idle_end_step, "telegraphEndStep": telegraph_end_step,
		"attackStartStep": telegraph_end_step, "attackEndStep": attack_end_step, "recoveryStartStep": attack_end_step, "recoveryCompletionStep": completion_step,
		"bodyPartIds": enemy_profile.bodyParts.map(func(part: Dictionary) -> String: return str(part.id)), "targetableBodyPartIds": targetable_ids, "selectedBodyPartId": selected_id, "finalBehaviorState": "complete",
		"stateTransitions": transitions, "bodyPartNodeCount": body_nodes.size(), "targetPointMarkerCount": body_nodes.size(), "hurtboxAreaCount": body_nodes.size(), "runtimeBodyParts": runtime_parts, "physicsSteps": physics_steps
	}

func _create_body_parts() -> void:
	for index: int in range(enemy_profile.bodyParts.size()):
		var part: Dictionary = enemy_profile.bodyParts[index]; var hurtbox: Dictionary = hurtbox_profiles[index]
		var body: Node3D = Node3D.new(); body.name = "BodyPart_%d" % index; body.set_meta("body_part_id", str(part.id)); body.set_meta("targetable", bool(part.targetable))
		var marker: Marker3D = Marker3D.new(); marker.name = "TargetPoint"; marker.position = _vector(part.targetPoint); body.add_child(marker)
		var area: Area3D = Area3D.new(); area.name = "Hurtbox"; area.position = _vector(hurtbox.center); area.collision_layer = 2; area.collision_mask = 0; area.monitoring = true; area.monitorable = true
		var shape_node: CollisionShape3D = CollisionShape3D.new(); shape_node.name = "CollisionShape3D"; var sphere: SphereShape3D = SphereShape3D.new(); sphere.radius = float(hurtbox.radius); shape_node.shape = sphere; area.add_child(shape_node); body.add_child(area); add_child(body); body_nodes.append(body)

func _disable_primary_targetable() -> void:
	for body: Node3D in body_nodes:
		if bool(body.get_meta("targetable", false)): body.set_meta("targetable", false); return

func _boundary_step(seconds: float, delta: float) -> int: return maxi(1, ceili(seconds / delta - EPSILON))
func _vector(value: Dictionary) -> Vector3: return Vector3(float(value.x), float(value.y), float(value.z))
func _vector_report(value: Vector3) -> Dictionary: return {"x": value.x, "y": value.y, "z": value.z}
