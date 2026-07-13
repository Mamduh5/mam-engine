# mam-engine Godot movement adapter

This scene-free addon is installed by `mam godot consumer install` and reads the deterministic bundle produced by `mam godot consumer sync`.

Load `runtime/mam_runtime_bundle_loader.gd`, then bind `runtime/mam_movement_runtime.gd` to a game-owned `CharacterBody3D`. The game supplies movement input and horizontal camera basis on every physics tick. The adapter does not register input actions, create scenes, own a camera, or manage game lifecycle.

The public contracts are `mam.godot-runtime-bundle/v1` and `mam.godot-movement-adapter/v1`.
