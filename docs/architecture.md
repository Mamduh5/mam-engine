# Architecture

## Layer model

```text
Codex / CLI (future visual editor)
             |
             v
Engine and application services
             |
             v
Schemas, validated definitions, validation
             |
             v
Runtime protocol -> Godot runtime adapter -> fixtures
             |
             v
Machine-readable reports
```

Snapshots, rollback, and changed-file safety surround every persistent operation rather than belonging to presentation or Godot.

## Responsibilities

### CLI adapter

Parses `mam` commands, invokes application services, emits protocol-shaped JSON, and maps failures to exit codes. It contains no movement or persistence policy.

### Engine and application services

Coordinate inspect, validate, set, simulate, test, runtime launch, save, snapshot, rollback, and audit use cases. Services accept explicit inputs and return typed, structured results suitable for any client.

### Schemas and definitions

Define canonical authored data and its versioning, units, ranges, identifiers, and compatibility. Stored definitions are data, not executable source patches.

### Validation

Performs structural, semantic, cross-reference, and operation-scope checks. Validation errors have stable codes and precise field paths. Invalid definitions cannot be persisted or sent to the runtime.

### Runtime protocol

Provides versioned request and response envelopes between engine services and the Godot process. It covers readiness, execution, metrics, warnings, errors, timeout, and shutdown without terminal-text parsing.

### Godot runtime adapter

Translates validated definitions and fixture commands into Godot execution, then measures and reports outcomes. It may implement runtime integration details but may not define canonical authoring values in scenes or resources.

### Fixtures

Provide controlled worlds, initial state, inputs, clocks, and expected measurements for one vertical slice. A fixture cannot add a private authoring model.

### Reports

Record validation, simulation, runtime, test, and safety outcomes with schema version, correlation data, evidence, warnings, errors, and exact changed files. Reports distinguish complete success, rejection, partial failure, timeout, and environment failure.

### Snapshots and rollback

Capture the previous state of files before approved destructive or overwrite operations. Snapshot manifests record scope and integrity metadata. Rollback validates the target snapshot, previews its file plan, applies only allowed paths, audits results, and reports partial failures honestly.

### Automated tests

Verify each layer independently and verify protocol compatibility across layers. Godot-dependent checks remain a narrow integration tier; most contract and domain checks stay fast and runtime-independent.

## Dependency rules

- Clients depend on engine service interfaces; services never depend on a terminal or GUI.
- Services depend on domain types, schemas, validators, and ports for storage/runtime operations.
- Schema and domain code do not depend on Godot.
- The Godot adapter depends on published schemas and protocol contracts, not CLI presentation.
- Fixtures depend on the runtime adapter and validated definitions; engine logic does not depend on a particular fixture.
- Reports use shared protocol/domain types rather than scraping logs.
- Persistence and runtime launch require validation first.
- Persistent operations require an explicit allowed-file plan and a post-operation changed-file audit.

Engine-domain logic must not depend directly on terminal presentation, a future GUI, a particular fixture, or repository-specific source patching. No layer may use arbitrary source detection or regex rewriting as the normal authoring mechanism.

## Canonical data flow

An authoring client inspects the current canonical definition, proposes a structured change, validates the candidate, and may simulate it without persistence. An explicit save service snapshots affected existing files, writes only its declared targets, audits actual changes, and returns the result. Runtime execution receives the same validated definition plus a fixture request. Godot returns measurements; it does not write canonical definitions back implicitly.

Temporary live drafts, when introduced, will be separately identified, validated, disposable, and lower priority than an explicit persistent save decision. Clearing a draft must restore the last persisted/baseline behavior without rewriting unrelated files.
