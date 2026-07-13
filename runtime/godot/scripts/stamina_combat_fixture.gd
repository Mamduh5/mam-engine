class_name StaminaCombatFixture
extends Node

const StaminaFixtureRuntime = preload("res://scripts/stamina_fixture.gd")
const CombatFixtureRuntime = preload("res://scripts/combat_fixture.gd")
const OffensiveActionFixtureRuntime = preload("res://scripts/offensive_action_fixture.gd")
const HealthFixtureRuntime = preload("res://scripts/health_fixture.gd")

var stamina_profile: Dictionary
var health_profile: Dictionary
var action_profile: Dictionary

func configure(stamina: Dictionary, health: Dictionary, action: Dictionary) -> void:
	stamina_profile = stamina
	health_profile = health
	action_profile = action

func run_scenario(scenario: Dictionary) -> Dictionary:
	if not ["accepted", "insufficient-stamina"].has(scenario.id): return {}
	var stamina := StaminaFixtureRuntime.evaluate(stamina_profile, action_profile)
	if bool(stamina.actionAccepted):
		var combat := CombatFixtureRuntime.new()
		add_child(combat)
		combat.configure(health_profile, action_profile)
		var result: Dictionary = await combat.run_scenario({"id": "default", "fixedDeltaSeconds": scenario.fixedDeltaSeconds})
		return _combine(stamina, result)
	return _rejected_exchange(stamina, scenario)

func reject_before_stamina(scenario: Dictionary) -> Dictionary:
	var zero_cost_action := action_profile.duplicate(true)
	zero_cost_action.staminaCost = 0.0
	var stamina := StaminaFixtureRuntime.evaluate(stamina_profile, zero_cost_action)
	stamina.actionAccepted = false
	stamina.sufficientStamina = false
	stamina.requestedStaminaCost = action_profile.staminaCost
	return _rejected_exchange(stamina, scenario)

func _rejected_exchange(stamina: Dictionary, scenario: Dictionary) -> Dictionary:
	var action_steps := {
		"actionTotalSteps": OffensiveActionFixtureRuntime.lifecycle_steps(action_profile, float(scenario.fixedDeltaSeconds)),
		"activeStartStep": OffensiveActionFixtureRuntime.active_start_step(action_profile, float(scenario.fixedDeltaSeconds)),
		"activeEndStep": OffensiveActionFixtureRuntime.active_end_step(action_profile, float(scenario.fixedDeltaSeconds))
	}
	var target := HealthFixtureRuntime.resolve_damage_value(health_profile, 0.0)
	return _combine(stamina, {
		"actionTotalSteps": action_steps.actionTotalSteps,
		"activeStartStep": action_steps.activeStartStep,
		"activeEndStep": action_steps.activeEndStep,
		"hitStep": action_steps.activeStartStep,
		"hitAccepted": false,
		"startingHealth": target.startingHealth,
		"incomingDamage": target.incomingDamage,
		"appliedDamage": target.appliedDamage,
		"remainingHealth": target.remainingHealth,
		"overkillDamage": target.overkillDamage,
		"defeated": target.defeated,
		"finalActionState": "ready",
		"finalTargetState": target.finalTargetState,
		"physicsSteps": 0
	})

func _combine(stamina: Dictionary, combat: Dictionary) -> Dictionary:
	return {
		"actionAccepted": stamina.actionAccepted,
		"sufficientStamina": stamina.sufficientStamina,
		"startingStamina": stamina.startingStamina,
		"requestedStaminaCost": stamina.requestedStaminaCost,
		"consumedStamina": stamina.consumedStamina,
		"remainingStamina": stamina.remainingStamina,
		"finalStaminaState": stamina.finalStaminaState,
		"actionTotalSteps": combat.actionTotalSteps,
		"activeStartStep": combat.activeStartStep,
		"activeEndStep": combat.activeEndStep,
		"hitStep": combat.hitStep,
		"hitAccepted": combat.hitAccepted,
		"startingHealth": combat.startingHealth,
		"incomingDamage": combat.incomingDamage,
		"appliedDamage": combat.appliedDamage,
		"remainingHealth": combat.remainingHealth,
		"overkillDamage": combat.overkillDamage,
		"defeated": combat.defeated,
		"finalActionState": combat.finalActionState,
		"finalTargetState": combat.finalTargetState,
		"physicsSteps": combat.physicsSteps
	}
