# Architecture

## Layer model

```text
Codex / mam CLI (implemented) / future visual editor
                        |
                        v
Movement and snapshot application services (implemented)
                        |
                        v
Movement domain, JSON Schema, semantic validation (implemented)
                        |
                        v
Runtime protocol -> Godot adapter -> fixtures (Phase 1B)
                        |
                        v
Machine-readable reports
```

Snapshots, rollback, and changed-file safety surround every persistent operation rather than belonging to presentation or Godot.

## Responsibilities

### CLI adapter - implemented in Phase 1A

Parses `mam` movement and snapshot commands, invokes application services, emits a versioned operation-result envelope, and maps failures to exit codes. It contains no movement or persistence policy and uses no CLI framework.

### Engine and application services - Phase 1A movement foundation implemented

Coordinate movement inspect, validate, set, and simulate plus snapshot create, list, rollback, and changed-file audits. Runtime launch and fixture orchestration remain Phase 1B. Services accept explicit inputs and return typed, structured results suitable for any client.

### Schemas and definitions - movement v1 implemented

The movement v1 JSON Schema defines canonical authored data, identifiers, supported modes, required fields, and unknown-field rejection. Semantic validation supplies cross-field and numeric rules. Stored definitions are data, not executable source patches.

### Validation - implemented for movement v1

Ajv performs structural checks and project-owned domain code performs semantic checks. Errors have stable codes and precise dotted paths. Invalid definitions cannot be simulated, snapshotted, or persisted.

### Runtime protocol - specified, not implemented

Provides versioned request and response envelopes between engine services and the Godot process. It covers readiness, execution, metrics, warnings, errors, timeout, and shutdown without terminal-text parsing.

### Godot runtime adapter - Phase 1B

Translates validated definitions and fixture commands into Godot execution, then measures and reports outcomes. It may implement runtime integration details but may not define canonical authoring values in scenes or resources.

### Fixtures - Phase 1B

Provide controlled worlds, initial state, inputs, clocks, and expected measurements for one vertical slice. A fixture cannot add a private authoring model.

### Reports - CLI operation envelope implemented

Phase 1A operations return protocol version, command, narrow status, correlation ID, normalized input, data, warnings, errors, exact changed files, and snapshot ID. The separate Godot runtime report contract remains specified for Phase 1B.

### Snapshots and rollback - implemented for movement files

Real set operations capture exact previous content immediately before writing. Repository-local ignored snapshot records contain metadata version, ID, timestamp, operation, target path, content hash, and restorable content. Rollback verifies metadata and hash, validates the saved profile, restores atomically, re-validates, and audits changed files. Snapshots are retained.

### Automated tests - engine-independent layers implemented

Node built-in tests verify Phase 1A schema, semantic validation, simulation, application services, safety behavior, and CLI output. Godot-dependent checks remain a future narrow integration tier.

## Dependency rules

- Clients depend on engine service interfaces; services never depend on a terminal or GUI.
- Services depend on domain types, schemas, validators, and ports for storage/runtime operations.
- Schema and domain code do not depend on Godot.
- The future Godot adapter will depend on published schemas and protocol contracts, not CLI presentation.
- Fixtures depend on the runtime adapter and validated definitions; engine logic does not depend on a particular fixture.
- Reports use shared protocol/domain types rather than scraping logs.
- Persistence requires validation first; runtime launch will follow the same rule in Phase 1B.
- Persistent operations require an explicit allowed-file plan and a post-operation changed-file audit.

Engine-domain logic must not depend directly on terminal presentation, a future GUI, a particular fixture, or repository-specific source patching. No layer may use arbitrary source detection or regex rewriting as the normal authoring mechanism.

## Canonical data flow

An authoring client inspects the current canonical definition, proposes a structured dotted-path change, validates the complete candidate, and may dry-run or simulate without persistence. A real set snapshots the existing file, writes formatted JSON atomically, re-reads and validates it, audits actual changes against the target and snapshot allowlist, and returns the result. In Phase 1B, runtime execution will receive the same validated definition plus a fixture request; Godot will not write canonical definitions back implicitly.

Temporary live drafts, when introduced, will be separately identified, validated, disposable, and lower priority than an explicit persistent save decision. Clearing a draft must restore the last persisted/baseline behavior without rewriting unrelated files.
