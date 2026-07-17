# ADR 0008: Production Godot consumer boundary

## Status

Accepted for movement in `mam-engine` 0.2.0, camera in 0.3.0, and targeting in 0.4.0.

## Decision

Distribute a scene-free, manifest-managed addon through the public CLI. Canonical TypeScript services validate authored movement plus optional camera and targeting entries. Movement and camera contracts remain unchanged; targeting uses `mam.godot-targeting-runtime-bundle/v1`. Godot performs envelope, integrity, source-byte, binding, and explicit-input checks without substituting defaults.

The movement algorithm lives in one Godot core. Controlled movement fixtures drive that core for comparison evidence, while the production wrapper exposes `bind`, `physics_step`, and `unbind`. The game supplies its own `CharacterBody3D`, input, and camera basis and owns scenes, lifecycle, input actions, cameras, and presentation.

The camera algorithm likewise lives in a production core shared with controlled camera evidence. The public runtime binds explicit game-owned target, rig, pivot, camera, and collision-probe nodes; accepts orbit and movement input instead of reading `Input`; owns rig/lens/collision state only while bound; and publishes a normalized horizontal movement basis. The addon creates no scene or gameplay node.

The targeting algorithm lives in one production core shared with controlled targeting evidence. The public runtime binds a profile rather than nodes and accepts explicit game-owned candidate values, camera basis, visibility, and lock/switch requests. The engine owns selection state, scoring, ordinal tie-breaking, retention, grace, reacquisition, switching, cooldown, and structured output; the game owns nodes, discovery, lifecycle, physics queries, input mapping, camera, HUD, movement, and combat.

## Consequences

The installed runtime has no dependency on a source checkout, Node, npm, fixtures, or transport sessions; packed-consumer evidence runs after the npm installation is removed. Managed hashes make upgrades fail closed on drift, source hashes prevent stale authored data from silently starting, and legacy projects remain compatible. This boundary supplies production targeting infrastructure but does not imply enemy AI, combat, lock-on camera framing, full-hunt game integration, or presentation capability.
