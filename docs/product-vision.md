# Product vision

## Definition

`mam-engine` is a Codex-native game editor and engine. It gives automated coding agents a constrained way to author game data, inspect current state, validate intent, run deterministic checks, execute controlled runtime fixtures, and report evidence. The product is the contracts, engine services, CLI, diagnostics, safety controls, and testing workflow—not a particular demo game or Godot scene.

Codex-native authoring means common changes use structured, versioned definitions instead of uncontrolled source rewrites. Inspection is machine-readable, validation is deterministic, and runtime tests run against named fixtures. Draft changes and persistent changes are distinct operations. Persistent or destructive operations declare allowed files, audit the actual changed files, preserve a baseline, create snapshots when required, and support rollback.

A future visual editor is a client of the same services and protocols. It must not introduce a second definition format or move domain behavior into GUI code.

## Product principles

1. Inspect before mutation.
2. Validate before persistence, simulation, or runtime execution.
3. Prefer explicit authored definitions over source-code patching.
4. Keep temporary live drafts separate from explicit saves.
5. Return structured success, warnings, metrics, errors, and changed files.
6. Preserve recoverable baselines and make rollback testable.
7. Treat fixtures as consumers of canonical definitions, never as hidden truth.
8. Complete measurable vertical slices before widening the domain.

The architectural ideas of read-only inspection, temporary drafts, explicit saves, state reporting, validation, file auditing, baselines, and rollback were informed conceptually by Game Polish Lab. `mam-engine` does not reuse that product's Phaser adapters, arbitrary-project detection, regex source patching, bridge installers, VS Code coupling, webviews, or retrofit architecture.

## Long-term action-game capability

The intended game domain eventually includes third-person movement; camera and targeting; animation-driven attacks; weapon-specific mechanics; hitboxes and hurtboxes; dodging and defensive actions; interrupts; stagger; body-part damage; large-enemy behavior; telegraphs; VFX; audio events; and encounter authoring.

That list is direction, not current scope. The project must grow through completed, testable vertical slices. Each slice needs schemas, validation, inspection, deterministic logic where applicable, runtime-fixture proof, structured reports, safety auditing, and regression coverage before the next slice begins.
