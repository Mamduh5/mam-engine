# ADR 0008: Production Godot consumer boundary

## Status

Accepted for `mam-engine` 0.2.0.

## Decision

Distribute a scene-free, manifest-managed addon through the public CLI. Canonical TypeScript services validate authored movement and generate a deterministic `mam.godot-runtime-bundle/v1`; Godot performs runtime envelope, integrity, source-byte, binding, and explicit-input checks without duplicating canonical semantic validation.

The movement algorithm lives in one Godot core. Controlled movement fixtures drive that core for comparison evidence, while the production wrapper exposes `bind`, `physics_step`, and `unbind`. The game supplies its own `CharacterBody3D`, input, and camera basis and owns scenes, lifecycle, input actions, cameras, and presentation.

## Consequences

Packed consumers do not require a source checkout, Node, fixtures, or transport sessions at Godot runtime. Managed hashes make upgrades fail closed on drift, and source hashes prevent stale authored data from silently starting. This slice does not imply production camera, targeting, combat, full-hunt, or presentation capability.
