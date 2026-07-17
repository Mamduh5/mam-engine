class_name MamTargetingRuntime
extends RefCounted

const TargetingCore = preload("res://addons/mam_engine/runtime/mam_targeting_core.gd")
var _core := TargetingCore.new()

func bind(profile: Variant) -> Dictionary:
	return _core.bind(profile)

func physics_step(delta: float, input: Variant) -> Dictionary:
	return _core.physics_step(delta, input)

func clear_target() -> Dictionary:
	return _core.clear_target()

func unbind() -> Dictionary:
	return _core.unbind()
