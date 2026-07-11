# Movement Editor v0.1

## Status

Movement Editor **Phase 1A is implemented**. It proves the movement-domain contract independently of a runtime host. The complete Movement Editor v0.1 milestone is **not finished**: Godot adapter and fixture proof are deferred to Phase 1B.

## Implemented definition scope

Movement profile schema version 1 covers:

- camera-relative walk, run, and sprint speed
- acceleration, deceleration, and character rotation speed
- maximum stamina, sprint cost, regeneration rate and delay, and sprint-start threshold
- dodge distance, duration, stamina cost, invulnerability window, movement-input direction, and steering multiplier

The only supported orientation is `camera_relative`; the only supported dodge direction mode is `movement_input`. Unknown properties are rejected. The schema deliberately excludes jumping, airborne movement, swimming, climbing, root motion, slopes, ledges, animation state, combat state, and networking.

## Implemented commands

```text
mam movement inspect <file> [--json]
mam movement validate <file> [--json]
mam movement simulate <file> --scenario <accelerate|stop|sprint|dodge> [--seconds <number>] [--json]
mam movement set <file> <property-path> <json-value> [--dry-run] [--json]
mam snapshot create <file> [--json]
mam snapshot list [--json]
mam snapshot rollback <snapshot-id> [--json]
```

Inspection returns the normalized profile plus speed ordering, estimated run acceleration/stopping time, full-stamina sprint duration, dodge invulnerability duration, and dodge average travel speed. Validation combines JSON Schema and semantic rules.

Set resolves only an existing dotted property. It parses the proposed value as JSON, validates the complete candidate, supports a zero-write dry run, snapshots immediately before a real write, writes atomically with two-space formatting and a trailing newline, re-reads and validates, and audits exact changes.

## Deterministic simulation

Simulation uses a fixed `1/60` second timestep and never reads wall-clock time or randomness.

- `accelerate` starts at rest and reports duration, final/maximum speed, time to 95% of run speed, distance, timestep, and steps.
- `stop` starts at run speed and reports stopping time/distance, final speed, timestep, and steps.
- `sprint` starts with full stamina and reports distance, final speed, consumed/final stamina, first unavailable time when applicable, timestep, and steps.
- `dodge` reports configured/simulated distance, duration, invulnerability bounds/duration, stamina cost, timestep, and steps.

Equivalent profile, scenario, and duration inputs produce equivalent domain simulation results.

## Phase 1A safety contract

- Inspect, validate, simulate, snapshot list, and set dry-run allow no changed files.
- Real set allows only the target movement profile and its new `.mam-engine/snapshots/*.json` record.
- Snapshot creation allows only its new snapshot record.
- Rollback allows only the recorded target file.
- Snapshot metadata includes version, ID, timestamp, operation, repository-relative target, SHA-256 content hash, and exact previous content.
- Rollback verifies the record and hash, validates the saved content, restores it atomically, re-validates, and audits changes.
- Movement targets must be repository-contained JSON files and cannot resolve under `.git`, `.mam-engine`, `node_modules`, or `dist`.

## Stable errors

Phase 1A exposes project-owned codes: `MOVEMENT_FILE_NOT_FOUND`, `MOVEMENT_FILE_READ_FAILED`, `MOVEMENT_JSON_INVALID`, `MOVEMENT_SCHEMA_INVALID`, `MOVEMENT_SCHEMA_VERSION_UNSUPPORTED`, `MOVEMENT_SPEED_ORDER_INVALID`, `MOVEMENT_ACCELERATION_INVALID`, `MOVEMENT_DECELERATION_INVALID`, `MOVEMENT_ROTATION_INVALID`, `MOVEMENT_STAMINA_INVALID`, `MOVEMENT_DODGE_INVALID`, `MOVEMENT_DODGE_IFRAME_WINDOW_INVALID`, `MOVEMENT_PROPERTY_NOT_FOUND`, `MOVEMENT_PROPERTY_VALUE_INVALID`, `MOVEMENT_WRITE_BLOCKED`, `SNAPSHOT_NOT_FOUND`, `SNAPSHOT_ROLLBACK_FAILED`, `CLI_ARGUMENT_INVALID`, and `INTERNAL_ERROR`.

Errors include a dotted `path` when a field or file can be identified, a stable message, and optional `actual`, `expected`, or structured details. Raw Ajv diagnostics are not the public contract.

## Full v0.1 acceptance criteria

1. Codex can change a movement profile without editing engine-owned movement code. **Met in Phase 1A.**
2. Invalid values are rejected with stable error codes and field paths. **Met in Phase 1A.**
3. Movement simulation is deterministic. **Met in Phase 1A.**
4. A Godot fixture consumes the same validated profile. **Pending Phase 1B.**
5. Runtime results are returned as structured JSON. **CLI results are implemented; Godot runtime results are pending Phase 1B.**
6. Tests cover acceleration, maximum speed, stopping, turning, sprint stamina, and dodge timing. **Phase 1A covers all listed areas except runtime turning behavior, which is pending fixture integration.**
7. Unexpected file changes cause the operation to fail. **Met in Phase 1A application audits.**
8. Snapshot and rollback behavior is testable. **Met in Phase 1A.**
9. No combat functionality is required. **Preserved.**

Phase 1B must add the Godot adapter, a controlled movement fixture, readiness/shutdown handling, runtime measurement reports, simulation-to-runtime tolerances, and headless integration tests without changing the canonical movement definition source.
