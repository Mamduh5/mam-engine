# ADR 0008: Production Godot consumer boundary

## Status

Accepted for movement in `mam-engine` 0.2.0 and camera in 0.3.0.

## Decision

Distribute a scene-free, manifest-managed addon through the public CLI. Canonical TypeScript services validate authored movement and optional camera entries. Movement keeps `mam.godot-runtime-bundle/v1`; configured cameras use the separate `mam.godot-camera-runtime-bundle/v1`. Godot performs envelope, integrity, source-byte, binding, and explicit-input checks without duplicating canonical semantic validation or substituting defaults.

The movement algorithm lives in one Godot core. Controlled movement fixtures drive that core for comparison evidence, while the production wrapper exposes `bind`, `physics_step`, and `unbind`. The game supplies its own `CharacterBody3D`, input, and camera basis and owns scenes, lifecycle, input actions, cameras, and presentation.

The camera algorithm likewise lives in a production core shared with controlled camera evidence. The public runtime binds explicit game-owned target, rig, pivot, camera, and collision-probe nodes; accepts orbit and movement input instead of reading `Input`; owns rig/lens/collision state only while bound; and publishes a normalized horizontal movement basis. The addon creates no scene or gameplay node.

## Consequences

The installed runtime has no dependency on a source checkout, Node, npm, fixtures, or transport sessions; packed-consumer evidence runs after the npm installation is removed. Managed hashes make upgrades fail closed on drift, source hashes prevent stale authored data from silently starting, and movement-only projects remain compatible. This boundary supplies production camera infrastructure but does not imply production targeting, combat cameras, full-hunt game integration, or presentation capability.
