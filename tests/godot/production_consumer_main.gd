extends Node3D

const Loader = preload("res://addons/mam_engine/runtime/mam_runtime_bundle_loader.gd")
const MovementRuntime = preload("res://addons/mam_engine/runtime/mam_movement_runtime.gd")
const DELTA := 1.0 / 60.0

var body: CharacterBody3D

func _ready() -> void:
	var ground := StaticBody3D.new(); ground.name = "ConsumerGround"; add_child(ground)
	var ground_collision := CollisionShape3D.new(); var ground_shape := BoxShape3D.new(); ground_shape.size = Vector3(40, 1, 40); ground_collision.shape = ground_shape; ground_collision.position.y = -0.5; ground.add_child(ground_collision)
	body = CharacterBody3D.new(); body.name = "ConsumerBody"; body.position.y = 0.9; add_child(body)
	var shape := CollisionShape3D.new(); var capsule := CapsuleShape3D.new(); capsule.height = 1.8; capsule.radius = 0.4; shape.shape = capsule; body.add_child(shape)
	var loaded := Loader.load_bundle()
	if loaded.status != "passed": _write_and_exit(loaded); return
	var runtime := MovementRuntime.new(); var bind := runtime.bind(body, loaded.data.profile)
	var duplicate := MovementRuntime.new().bind(body, loaded.data.profile)
	var incomplete_bind := MovementRuntime.new().bind(body, {})
	var incomplete_step := runtime.physics_step(DELTA, {}, {})
	var forward := {"forward": Vector3.FORWARD, "right": Vector3.RIGHT}
	var state := {}; var acceleration_distance_start := body.position
	for _step in range(60): await get_tree().physics_frame; state = runtime.physics_step(DELTA, _consumer_input(Vector2(0, 1)), forward).data
	var accelerated_speed: float = state.horizontalSpeed; var acceleration_distance := acceleration_distance_start.distance_to(body.position)
	for _step in range(30): await get_tree().physics_frame; state = runtime.physics_step(DELTA, _consumer_input(Vector2.ZERO), forward).data
	var stopped_speed: float = state.horizontalSpeed
	body.position = Vector3(0, 0.9, 0); body.velocity = Vector3.ZERO
	var rotated := {"forward": Vector3.RIGHT, "right": Vector3.BACK}
	for _step in range(30): await get_tree().physics_frame; state = runtime.physics_step(DELTA, _consumer_input(Vector2(0, 1)), rotated).data
	var camera_basis_x := body.position.x
	var sprint_start: float = state.stamina
	for _step in range(60): await get_tree().physics_frame; state = runtime.physics_step(DELTA, _consumer_input(Vector2(0, 1), true), rotated).data
	var sprint_stamina: float = state.stamina; var sprint_speed: float = state.horizontalSpeed
	for _step in range(120): await get_tree().physics_frame; state = runtime.physics_step(DELTA, _consumer_input(Vector2.ZERO), rotated).data
	var regenerated_stamina: float = state.stamina
	runtime.unbind(); body.position = Vector3(0, 0.9, 0); body.velocity = Vector3.ZERO; runtime = MovementRuntime.new(); runtime.bind(body, loaded.data.profile)
	var dodge_start := body.position; var accepted_count := 0; var iframe_observed := false
	for step in range(33):
		await get_tree().physics_frame; state = runtime.physics_step(DELTA, _consumer_input(Vector2(0, 1), false, step < 3), forward).data
		if state.dodgeAccepted: accepted_count += 1
		if state.invulnerable: iframe_observed = true
	var dodge_distance := dodge_start.distance_to(body.position); var unbind := runtime.unbind()
	var missing := Loader.load_bundle("res://mam_generated/missing.json")
	var invalid_bundle_code := _invalid_bundle_code()
	_write_and_exit({"status": "passed", "data": {"bind": bind.status, "duplicateBind": duplicate.diagnostics[0].code, "incompleteBind": incomplete_bind.diagnostics[0].code, "incompleteStep": incomplete_step.diagnostics[0].code, "acceleratedSpeed": accelerated_speed, "accelerationDistance": acceleration_distance, "stoppedSpeed": stopped_speed, "cameraBasisX": camera_basis_x, "sprintStartStamina": sprint_start, "sprintStamina": sprint_stamina, "sprintSpeed": sprint_speed, "regeneratedStamina": regenerated_stamina, "dodgeDistance": dodge_distance, "dodgeAcceptedCount": accepted_count, "iframeObserved": iframe_observed, "missingBundleCode": missing.diagnostics[0].code, "invalidBundleCode": invalid_bundle_code, "unbind": unbind.status}, "diagnostics": []})

func _consumer_input(movement: Vector2, sprint := false, dodge := false) -> Dictionary:
	return {"movement": movement, "walk": false, "sprintHeld": sprint, "dodgePressed": dodge}

func _invalid_bundle_code() -> String:
	var source := FileAccess.open("res://mam_generated/mam_runtime_bundle.json", FileAccess.READ)
	var value: Dictionary = JSON.parse_string(source.get_as_text()); source.close()
	value.payloadJson += " "
	var tampered := FileAccess.open("res://mam_generated/tampered.json", FileAccess.WRITE); tampered.store_string(JSON.stringify(value)); tampered.close()
	var result := Loader.load_bundle("res://mam_generated/tampered.json")
	DirAccess.remove_absolute(ProjectSettings.globalize_path("res://mam_generated/tampered.json"))
	return result.diagnostics[0].code

func _write_and_exit(result: Dictionary) -> void:
	var output := ""
	var arguments := OS.get_cmdline_user_args()
	for index in range(arguments.size() - 1):
		if arguments[index] == "--result": output = arguments[index + 1]
	var file := FileAccess.open(output, FileAccess.WRITE)
	if file != null: file.store_string(JSON.stringify(result) + "\n")
	get_tree().quit(0 if file != null else 2)
