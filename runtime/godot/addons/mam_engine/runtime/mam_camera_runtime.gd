class_name MamCameraRuntime
extends RefCounted

const CameraCore = preload("res://addons/mam_engine/runtime/mam_camera_core.gd")
var _core := CameraCore.new()

func bind(bindings: Variant, profile: Variant) -> Dictionary:
	return _core.bind(bindings, profile)

func physics_step(delta: float, input: Variant) -> Dictionary:
	return _core.physics_step(delta, input)

func unbind() -> Dictionary:
	return _core.unbind()
