class_name ActionTimelineFixture
extends Node

const EPSILON := 0.000000000001

@onready var animation_player: AnimationPlayer = $AnimationPlayer
var profile: Dictionary = {}
var current_step: int = 0
var emitted_events: Array[Dictionary] = []

func configure(value: Dictionary) -> void:
	profile = value

func run_scenario(scenario: Dictionary) -> Dictionary:
	if scenario.id != "default": return {}
	var delta: float = float(scenario.fixedDeltaSeconds)
	var total_steps: int = max(1, ceili(float(profile.durationSeconds) / delta - EPSILON))
	_build_animation()
	animation_player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	animation_player.callback_mode_method = AnimationMixer.ANIMATION_CALLBACK_MODE_METHOD_IMMEDIATE
	current_step = 1
	animation_player.play(StringName(profile.animationName))
	animation_player.advance(0.0)
	for step: int in range(1, total_steps + 1):
		current_step = step
		animation_player.advance(delta)
	return {
		"fixedDeltaSeconds": delta,
		"durationSeconds": float(profile.durationSeconds),
		"animationName": str(profile.animationName),
		"totalSteps": total_steps,
		"authoredEventCount": profile.events.size(),
		"emittedEventCount": emitted_events.size(),
		"emittedEvents": emitted_events,
		"completionStep": total_steps,
		"finalActionState": "complete",
		"physicsSteps": total_steps
	}

func _build_animation() -> void:
	var animation: Animation = Animation.new()
	animation.length = float(profile.durationSeconds)
	animation.loop_mode = Animation.LOOP_NONE
	for event: Dictionary in profile.events:
		var track_index: int = animation.add_track(Animation.TYPE_METHOD)
		animation.track_set_path(track_index, NodePath("."))
		var method_key: Dictionary = {"method": &"_record_timeline_event", "args": [str(event.id), str(event.name), float(event.timeSeconds)]}
		animation.track_insert_key(track_index, float(event.timeSeconds), method_key)
	var library: AnimationLibrary = AnimationLibrary.new()
	library.add_animation(StringName(profile.animationName), animation)
	animation_player.add_animation_library(&"", library)

func _record_timeline_event(event_id: String, event_name: String, authored_time_seconds: float) -> void:
	emitted_events.append({"id": event_id, "name": event_name, "authoredTimeSeconds": authored_time_seconds, "emittedStep": current_step})
