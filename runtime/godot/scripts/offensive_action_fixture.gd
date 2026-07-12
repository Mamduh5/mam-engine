class_name OffensiveActionFixture
extends Node

const EPSILON := 0.000000000001
var profile: Dictionary

func configure(value: Dictionary) -> void: profile = value

func run_scenario(scenario: Dictionary) -> Dictionary:
	if scenario.id != "default": return {}
	var delta := float(scenario.fixedDeltaSeconds)
	var lifecycle := float(profile.durationSeconds) + float(profile.cooldownSeconds)
	var total_steps: int = max(1, ceili(lifecycle / delta - EPSILON))
	var distance_travelled := 0.0
	var state := "active"
	for step in range(1, total_steps + 1):
		await get_tree().physics_frame
		var step_start := (step - 1) * delta
		var step_end := step * delta
		var movement_seconds: float = max(0.0, min(step_end, float(profile.durationSeconds)) - min(max(step_start, 0.0), float(profile.durationSeconds)))
		distance_travelled += float(profile.movementDistance) * movement_seconds / float(profile.durationSeconds)
		state = "active" if step_end + EPSILON < float(profile.durationSeconds) else ("cooldown" if step_end + EPSILON < lifecycle else "ready")
	return {
		"fixedDeltaSeconds": delta,
		"totalSteps": total_steps,
		"distanceTravelled": distance_travelled,
		"staminaConsumed": float(profile.staminaCost),
		"damageValue": float(profile.damage),
		"activeStartStep": floori(float(profile.activeStartSeconds) / delta + EPSILON) + 1,
		"activeEndStep": max(1, ceili(float(profile.activeEndSeconds) / delta - EPSILON)),
		"cooldownCompletionStep": total_steps,
		"finalActionState": state,
		"physicsSteps": total_steps
	}
