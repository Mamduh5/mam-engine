# mam-engine Godot consumer runtimes

This scene-free addon is installed by `mam godot consumer install` and reads deterministic movement and camera bundles produced by `mam godot consumer sync`.

For movement, load `runtime/mam_runtime_bundle_loader.gd`, then bind `runtime/mam_movement_runtime.gd` to a game-owned `CharacterBody3D`. The game supplies movement input and a horizontal camera basis on every physics tick.

For camera control, load `runtime/mam_camera_bundle_loader.gd`, then bind `runtime/mam_camera_runtime.gd` with game-owned follow target, rig root, yaw pivot, pitch pivot, `Camera3D`, and `ShapeCast3D` nodes. The collision probe may be null only when profile collision is disabled. The game supplies explicit orbit and movement-direction input to `physics_step`; the returned horizontal `cameraForward` and `cameraRight` vectors can be passed directly to the movement runtime.

The runtimes do not register input actions, create scenes, move the followed actor, or manage game lifecycle. The public contracts are `mam.godot-runtime-bundle/v1`, `mam.godot-movement-adapter/v1`, `mam.godot-camera-runtime-bundle/v1`, and `mam.godot-camera-adapter/v1`.
