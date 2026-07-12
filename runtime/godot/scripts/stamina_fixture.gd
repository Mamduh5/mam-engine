class_name StaminaFixture
extends Node

var stamina_profile: Dictionary
var action_profile: Dictionary

func configure(stamina: Dictionary, action: Dictionary) -> void:
	stamina_profile = stamina
	action_profile = action

func run_scenario(scenario: Dictionary) -> Dictionary:
	if scenario.id != "action-cost": return {}
	await get_tree().physics_frame
	var result := evaluate(stamina_profile, action_profile)
	result.physicsSteps = 1
	return result

static func evaluate(stamina: Dictionary, action: Dictionary) -> Dictionary:
	var starting_stamina := float(stamina.startingStamina)
	var requested_stamina_cost := float(action.staminaCost)
	var sufficient_stamina := starting_stamina >= requested_stamina_cost
	var consumed_stamina := requested_stamina_cost if sufficient_stamina else 0.0
	var remaining_stamina: float = max(0.0, starting_stamina - consumed_stamina)
	return {
		"actionKind": action.kind,
		"startingStamina": starting_stamina,
		"requestedStaminaCost": requested_stamina_cost,
		"consumedStamina": consumed_stamina,
		"remainingStamina": remaining_stamina,
		"sufficientStamina": sufficient_stamina,
		"actionAccepted": sufficient_stamina,
		"finalStaminaState": ("depleted" if remaining_stamina == 0.0 else "available") if sufficient_stamina else "insufficient"
	}
