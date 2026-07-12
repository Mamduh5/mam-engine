class_name HealthFixture
extends Node

var health_profile: Dictionary
var action_profile: Dictionary

func configure(health: Dictionary, action: Dictionary) -> void:
	health_profile = health
	action_profile = action

func run_scenario(scenario: Dictionary) -> Dictionary:
	if scenario.id != "confirmed-hit": return {}
	await get_tree().physics_frame
	var result := resolve_damage(health_profile, action_profile)
	result.physicsSteps = 1
	return result

static func resolve_damage(health: Dictionary, action: Dictionary) -> Dictionary:
	var starting_health := float(health.startingHealth)
	var incoming_damage := float(action.damage)
	var applied_damage: float = min(starting_health, incoming_damage)
	var remaining_health: float = max(0.0, starting_health - applied_damage)
	var overkill_damage := incoming_damage - applied_damage
	var defeated := remaining_health == 0.0
	return {
		"startingHealth": starting_health,
		"incomingDamage": incoming_damage,
		"appliedDamage": applied_damage,
		"remainingHealth": remaining_health,
		"overkillDamage": overkill_damage,
		"defeated": defeated,
		"finalTargetState": "defeated" if defeated else "alive"
	}
