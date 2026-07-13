class_name MamMovementRuntime
extends RefCounted

const MovementCore = preload("res://addons/mam_engine/runtime/mam_movement_core.gd")
var _core := MovementCore.new()

func bind(body: Variant, profile: Variant) -> Dictionary:
	return _core.bind(body, profile)

func physics_step(delta: float, movement_input: Variant, camera_basis: Variant) -> Dictionary:
	return _core.physics_step(delta, movement_input, camera_basis)

func unbind() -> Dictionary:
	return _core.unbind()
