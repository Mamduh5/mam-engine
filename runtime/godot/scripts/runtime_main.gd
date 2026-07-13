extends Node3D

const RuntimeProtocol = preload("res://scripts/runtime_protocol.gd")
const AtomicJsonFile = preload("res://scripts/atomic_json_file.gd")

@onready var player: Variant = $Player
const CameraFixtureScene = preload("res://scenes/camera_fixture.tscn")
const TargetingFixtureScene = preload("res://scenes/targeting_fixture.tscn")
const DefensiveActionFixtureScene = preload("res://scenes/defensive_action_fixture.tscn")
const OffensiveActionFixtureScene = preload("res://scenes/offensive_action_fixture.tscn")
const HealthFixtureScene = preload("res://scenes/health_fixture.tscn")
const CombatFixtureScene = preload("res://scenes/combat_fixture.tscn")
const StaminaFixtureScene = preload("res://scenes/stamina_fixture.tscn")
const StaminaCombatFixtureScene = preload("res://scenes/stamina_combat_fixture.tscn")
const TargetedCombatFixtureScene = preload("res://scenes/targeted_combat_fixture.tscn")
const ActionTimelineFixtureScene = preload("res://scenes/action_timeline_fixture.tscn")

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
	var fixture: Variant = player
	var fixture_scene := "res://scenes/movement_fixture.tscn"
	if request.fixtureId == RuntimeProtocol.CAMERA_FIXTURE_ID:
		fixture = CameraFixtureScene.instantiate()
		add_child(fixture)
		fixture_scene = "res://scenes/camera_fixture.tscn"
	elif request.fixtureId == RuntimeProtocol.TARGETING_FIXTURE_ID:
		fixture = TargetingFixtureScene.instantiate()
		add_child(fixture)
		fixture_scene = "res://scenes/targeting_fixture.tscn"
	elif request.fixtureId == RuntimeProtocol.DEFENSIVE_ACTION_FIXTURE_ID:
		fixture = DefensiveActionFixtureScene.instantiate()
		add_child(fixture)
		fixture_scene = "res://scenes/defensive_action_fixture.tscn"
	elif request.fixtureId == RuntimeProtocol.OFFENSIVE_ACTION_FIXTURE_ID:
		fixture = OffensiveActionFixtureScene.instantiate()
		add_child(fixture)
		fixture_scene = "res://scenes/offensive_action_fixture.tscn"
	elif request.fixtureId == RuntimeProtocol.HEALTH_FIXTURE_ID:
		fixture = HealthFixtureScene.instantiate()
		add_child(fixture)
		fixture_scene = "res://scenes/health_fixture.tscn"
	elif request.fixtureId == RuntimeProtocol.COMBAT_FIXTURE_ID:
		fixture = CombatFixtureScene.instantiate()
		add_child(fixture)
		fixture_scene = "res://scenes/combat_fixture.tscn"
	elif request.fixtureId == RuntimeProtocol.STAMINA_FIXTURE_ID:
		fixture = StaminaFixtureScene.instantiate()
		add_child(fixture)
		fixture_scene = "res://scenes/stamina_fixture.tscn"
	elif request.fixtureId == RuntimeProtocol.STAMINA_COMBAT_FIXTURE_ID:
		fixture = StaminaCombatFixtureScene.instantiate()
		add_child(fixture)
		fixture_scene = "res://scenes/stamina_combat_fixture.tscn"
	elif request.fixtureId == RuntimeProtocol.TARGETED_COMBAT_FIXTURE_ID:
		fixture = TargetedCombatFixtureScene.instantiate()
		add_child(fixture)
		fixture_scene = "res://scenes/targeted_combat_fixture.tscn"
	elif request.fixtureId == RuntimeProtocol.ACTION_TIMELINE_FIXTURE_ID:
		fixture = ActionTimelineFixtureScene.instantiate()
		add_child(fixture)
		fixture_scene = "res://scenes/action_timeline_fixture.tscn"
	if request.fixtureId == RuntimeProtocol.TARGETING_FIXTURE_ID: fixture.configure(request.payload.profile, request.payload.cameraProfile)
	elif request.fixtureId == RuntimeProtocol.HEALTH_FIXTURE_ID: fixture.configure(request.payload.profile, request.payload.offensiveActionProfile)
	elif request.fixtureId == RuntimeProtocol.COMBAT_FIXTURE_ID: fixture.configure(request.payload.healthProfile, request.payload.offensiveActionProfile)
	elif request.fixtureId == RuntimeProtocol.STAMINA_FIXTURE_ID: fixture.configure(request.payload.staminaProfile, request.payload.actionProfile)
	elif request.fixtureId == RuntimeProtocol.STAMINA_COMBAT_FIXTURE_ID: fixture.configure(request.payload.staminaProfile, request.payload.healthProfile, request.payload.offensiveActionProfile)
	elif request.fixtureId == RuntimeProtocol.TARGETED_COMBAT_FIXTURE_ID: fixture.configure(request.payload.targetingProfile, request.payload.staminaProfile, request.payload.healthProfile, request.payload.offensiveActionProfile)
	else: fixture.configure(request.payload.profile)
	var metrics: Dictionary = await fixture.run_scenario(request.payload.scenario)
	var response := RuntimeProtocol.response(request, "runtime.fixture.run", "ok", metrics)
	response.evidence.physicsSteps = metrics.get("physicsSteps", 0)
	response.evidence.fixtureScene = fixture_scene
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
