extends Node3D

@onready var player: MovementFixtureBody = $Player

func _ready() -> void:
	var paths := _parse_paths(OS.get_cmdline_user_args())
	if paths.is_empty():
		return # Windowed diagnostic view.
	await _execute(paths)

func _execute(paths: Dictionary) -> void:
	var request: Variant = _read_json(paths.request)
	var errors := RuntimeProtocol.validate_request(request)
	if not errors.is_empty():
		var findings := errors.map(func(message: String): return {"code": "RUNTIME_REQUEST_INVALID", "message": message})
		AtomicJsonFile.write(paths.response, RuntimeProtocol.response(request if typeof(request) == TYPE_DICTIONARY else {}, "runtime.fixture.run", "rejected", {}, findings, []))
		get_tree().quit(2)
		return
	var ready := RuntimeProtocol.response(request, "runtime.fixture.ready", "ready", {})
	if not AtomicJsonFile.write(paths.ready, ready):
		get_tree().quit(3)
		return
	player.configure(request.payload.profile)
	var metrics: Dictionary = await player.run_scenario(request.payload.scenario)
	var response := RuntimeProtocol.response(request, "runtime.fixture.run", "ok", metrics)
	response.evidence.physicsSteps = metrics.get("physicsSteps", 0)
	response.evidence.fixtureScene = "res://scenes/movement_fixture.tscn"
	response.evidence.scenarioId = request.payload.scenario.id
	if not AtomicJsonFile.write(paths.response, response):
		get_tree().quit(4)
		return
	get_tree().quit(0)

func _parse_paths(arguments: PackedStringArray) -> Dictionary:
	var result := {}
	var index := 0
	while index < arguments.size():
		var key := arguments[index]
		if ["--request", "--ready", "--response"].has(key) and index + 1 < arguments.size():
			result[key.trim_prefix("--")] = arguments[index + 1]
			index += 2
		else: index += 1
	return result if result.has_all(["request", "ready", "response"]) else {}

func _read_json(path: String) -> Variant:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null: return {}
	return JSON.parse_string(file.get_as_text())
