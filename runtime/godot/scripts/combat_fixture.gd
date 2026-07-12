class_name CombatFixture
extends Node

const OffensiveActionFixtureRuntime = preload("res://scripts/offensive_action_fixture.gd")
const HealthFixtureRuntime = preload("res://scripts/health_fixture.gd")

var health_profile: Dictionary
var action_profile: Dictionary

func configure(health: Dictionary, action: Dictionary) -> void:
	health_profile = health
	action_profile = action

func run_scenario(scenario: Dictionary) -> Dictionary:
	if scenario.id != "default": return {}
	var delta := float(scenario.fixedDeltaSeconds)
	var total_steps := OffensiveActionFixtureRuntime.lifecycle_steps(action_profile, delta)
	var active_start_step := OffensiveActionFixtureRuntime.active_start_step(action_profile, delta)
	var active_end_step := OffensiveActionFixtureRuntime.active_end_step(action_profile, delta)
	if active_start_step > active_end_step or active_start_step > total_steps: return {}
	var hit_step := active_start_step
	var hit_accepted := false
	var damage := {}
	var final_action_state := "active"
	for step in range(1, total_steps + 1):
		await get_tree().physics_frame
		final_action_state = OffensiveActionFixtureRuntime.state_at_step_end(action_profile, step * delta)
		if not hit_accepted and step == hit_step and step <= active_end_step:
			hit_accepted = true
			damage = HealthFixtureRuntime.resolve_damage(health_profile, action_profile)
	if not hit_accepted: return {}
	return {
		"actionTotalSteps": total_steps,
		"activeStartStep": active_start_step,
		"activeEndStep": active_end_step,
		"hitStep": hit_step,
		"hitAccepted": hit_accepted,
		"startingHealth": damage.startingHealth,
		"incomingDamage": damage.incomingDamage,
		"appliedDamage": damage.appliedDamage,
		"remainingHealth": damage.remainingHealth,
		"overkillDamage": damage.overkillDamage,
		"defeated": damage.defeated,
		"finalActionState": final_action_state,
		"finalTargetState": damage.finalTargetState,
		"physicsSteps": total_steps
	}
