# mam-engine Godot consumer runtimes

This scene-free addon is installed by `mam godot consumer install` and reads deterministic movement, camera, and targeting bundles produced by `mam godot consumer sync`.

For movement, load `runtime/mam_runtime_bundle_loader.gd`, then bind `runtime/mam_movement_runtime.gd` to a game-owned `CharacterBody3D`. The game supplies movement input and a horizontal camera basis on every physics tick.

For camera control, load `runtime/mam_camera_bundle_loader.gd`, then bind `runtime/mam_camera_runtime.gd` with game-owned follow target, rig root, yaw pivot, pitch pivot, `Camera3D`, and `ShapeCast3D` nodes. The collision probe may be null only when profile collision is disabled. The game supplies explicit orbit and movement-direction input to `physics_step`; the returned horizontal `cameraForward` and `cameraRight` vectors can be passed directly to the movement runtime.

For targeting, load `runtime/mam_targeting_bundle_loader.gd`, then bind `runtime/mam_targeting_runtime.gd` to the profile. Each `physics_step` receives explicit origin/camera basis, candidate values, caller-computed visibility, lock/unlock requests, and `switchDirection` (`x < 0` left, `x > 0` right). The game owns target nodes and physics queries; the runtime never scans the scene tree or mutates candidates.

The runtimes do not register input actions, create scenes, move the followed actor, discover targets, or manage game lifecycle. Targeting adds `mam.godot-targeting-runtime-bundle/v1` and `mam.godot-targeting-adapter/v1` without changing movement or camera contracts.
