class_name DamageReactionFixture
extends Node

const HealthFixtureRuntime = preload("res://scripts/health_fixture.gd")
const EPSILON := 0.000000000001

var reaction_profile: Dictionary = {}
var health_profile: Dictionary = {}
var action_profile: Dictionary = {}

func configure(reaction: Dictionary, health: Dictionary, action: Dictionary) -> void:
	reaction_profile = reaction
	health_profile = health
	action_profile = action

func run_scenario(scenario: Dictionary) -> Dictionary:
	if not ["hit-continues", "stagger-interrupts", "defeat-interrupts"].has(scenario.id): return {}
	var fixed_delta: float = float(scenario.fixedDeltaSeconds)
	var target_action_was_active: bool = bool(scenario.targetActionWasActive)
	await get_tree().physics_frame
	var physics_steps: int = 1
	var hit: Dictionary = HealthFixtureRuntime.resolve_damage(health_profile, action_profile)
	var applied_damage: float = float(hit.appliedDamage)
	var defeated: bool = bool(hit.defeated)
	var reaction_type: String = "none"
	if applied_damage > 0.0:
		reaction_type = "defeat" if defeated else "stagger" if applied_damage >= float(reaction_profile.staggerThreshold) else "hit"
	var reaction_duration: float = float(reaction_profile.hitReactionDurationSeconds) if reaction_type == "hit" else float(reaction_profile.staggerDurationSeconds) if reaction_type == "stagger" else 0.0
	var reaction_total_steps: int = 0 if reaction_duration == 0.0 else maxi(1, ceili(reaction_duration / fixed_delta - EPSILON))
	for _step: int in range(reaction_total_steps):
		await get_tree().physics_frame
		physics_steps += 1
	var target_action_interrupted: bool = target_action_was_active and ["stagger", "defeat"].has(reaction_type)
	return {
		"startingHealth": float(hit.startingHealth),
		"incomingDamage": float(hit.incomingDamage),
		"appliedDamage": applied_damage,
		"remainingHealth": float(hit.remainingHealth),
		"defeated": defeated,
		"staggerThreshold": float(reaction_profile.staggerThreshold),
		"staggered": reaction_type == "stagger",
		"reactionType": reaction_type,
		"reactionDurationSeconds": reaction_duration,
		"reactionTotalSteps": reaction_total_steps,
		"targetActionWasActive": target_action_was_active,
		"targetActionInterrupted": target_action_interrupted,
		"finalTargetActionState": "interrupted" if target_action_interrupted else "continuing" if target_action_was_active else "inactive",
		"finalTargetState": str(hit.finalTargetState),
		"physicsSteps": physics_steps
	}
