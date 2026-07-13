# Godot runtime adapter

This self-contained Godot 4.7 host consumes one validated `mam.runtime/v1` request, atomically writes readiness and final response files, dispatches movement, camera, or the separate `targeting/basic-lock-on` fixture, and exits. Terminal output is bounded diagnostics, never protocol.

The camera scene contains a deterministic target, follow anchor, yaw and pitch pivots, `ShapeCast3D` sphere probe, `Camera3D`, controlled collision wall, ground, simple meshes, and light. It has no imported assets or plugins. Explicit preloads make cold-checkout execution independent of generated script-class caches. Headless fixed-step measurements are authoritative.

Camera behavior uses direct bounded orbit updates, position half-life on follow position, and bounded shortest-angle recenter speed after its delay. The authored rotation half-life remains part of deferred targeting-framing behavior rather than free orbit/recenter. Collision casts from the authored look-at origin toward the desired boom, accounts for probe radius and minimum distance, disables the wall at a deterministic step, then uses return half-life recovery. Authored FOV and near/far clips are applied to and read back from `Camera3D`.

Godot is not a definition store. It receives the complete already validated profile in the atomic request and never reads or writes canonical camera JSON. `.godot/` and runtime sessions are the only internal generated paths.

The adjacent `addons/mam_engine/` tree is the production movement and camera consumer source. It is scene-free and transport-free. The controlled movement and camera fixtures delegate behavior to their production cores; targeting remains fixture-only.

The targeting scene uses marker nodes and dedicated-mask controlled walls with real ray queries; markers have no gameplay semantics. Not implemented: persistent sessions, enemies, combat systems, screen shake, camera zones, cutscenes, photo mode, visual-editor controls, animation, audio, VFX, weapons, damage, multiplayer, or networking.
