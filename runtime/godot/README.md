# Godot runtime adapter

This is the self-contained Godot 4.7 GDScript host for Movement Editor Phase 1B. It consumes one validated `mam.runtime/v1` request, atomically writes `ready.json`, runs one `movement/basic-ground` scenario, atomically writes `response.json`, and exits.

The scene contains a flat static ground, one `CharacterBody3D`, collision shapes, placeholder meshes, a fixed camera, and one light. Headless metrics are authoritative; the view is diagnostic only. Open it manually with `godot --path runtime/godot`.

Godot is the runtime host, not the canonical definition store. The TypeScript owner supplies the complete validated profile and owns deadlines and termination. `.godot/` is ignored and no executable, archive, plugin, external asset, test framework, animation, audio, VFX, enemy, weapon, or combat system is included.

Implemented: process-per-run request transport, atomic readiness/final files, correlation and fixture identity, fixed-step accelerate/stop/sprint/dodge/turn scenarios, camera-relative displacement, structured measurements, and a minimal windowed view.

Not implemented: persistent live sessions, explicit interactive shutdown, live editing, a camera editor, animation, combat, visual-editor controls, menus, browsers, or asset pipelines.
