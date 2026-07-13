class_name TargetedCombatFixture
extends Node

const TargetingFixtureScene = preload("res://scenes/targeting_fixture.tscn")
const StaminaCombatFixtureScene = preload("res://scenes/stamina_combat_fixture.tscn")

var targeting_profile: Dictionary
var stamina_profile: Dictionary
var health_profile: Dictionary
var action_profile: Dictionary

func configure(targeting: Dictionary, stamina: Dictionary, health: Dictionary, action: Dictionary) -> void:
	targeting_profile = targeting
	stamina_profile = stamina
	health_profile = health
	action_profile = action

func run_scenario(scenario: Dictionary) -> Dictionary:
	if not ["target-available", "no-valid-target"].has(scenario.id): return {}
	var targeting_fixture := TargetingFixtureScene.instantiate()
	add_child(targeting_fixture)
	targeting_fixture.configure_targeting_only(targeting_profile)
	var target_point := {"x": 0.0, "y": 0.0, "z": -float(targeting_profile.acquisition.maximumDistance) / 2.0}
	var targeting: Dictionary = await targeting_fixture.run_acquisition({
		"origin": {"x": 0.0, "y": 0.0, "z": 0.0},
		"viewForward": {"x": 0.0, "y": 0.0, "z": -1.0},
		"candidates": [{"id": "target-1", "targetPoint": target_point, "targetable": scenario.id == "target-available", "priority": 1.0, "obstruction": "none"}]
	})
	var stamina_combat := StaminaCombatFixtureScene.instantiate()
	add_child(stamina_combat)
	stamina_combat.configure(stamina_profile, health_profile, action_profile)
	var combat: Dictionary
	if targeting.selectedTargetId == null:
		combat = stamina_combat.reject_before_stamina(scenario)
	else:
		combat = await stamina_combat.run_scenario({"id": "accepted", "fixedDeltaSeconds": scenario.fixedDeltaSeconds})
	var result := {
		"scenario": scenario.id,
		"targetAcquired": targeting.selectedTargetId != null,
		"selectedTargetId": targeting.selectedTargetId,
		"targetingFinalState": targeting.lockState
	}
	for key in combat:
		if key != "physicsSteps": result[key] = combat[key]
	result.physicsSteps = int(targeting.physicsSteps) + int(combat.physicsSteps)
	return result
