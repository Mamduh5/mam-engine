# Movement Editor v0.1

## Status

Movement Editor **Phase 1B implementation is present**. It adds the controlled Godot adapter/fixture, five fixed-step runtime scenarios, structured measurements, and simulator comparison to the Phase 1A.1 safety foundation. Final v0.1 acceptance is not marked complete until the requested official Godot 4.7-stable binary exists and the pinned integration job passes.

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
mam movement simulate <file> --scenario <accelerate|stop|sprint|dodge|turn> [--seconds <number>] [--json]
mam runtime check [--godot <path>] [--json]
mam movement runtime-test <file> --scenario <accelerate|stop|sprint|dodge|turn> [--seconds <number>] [--camera-yaw-degrees <number>] [--godot <path>] [--keep-session] [--json]
mam movement set <file> <property-path> <json-value> [--dry-run] [--json]
mam snapshot create <file> [--json]
mam snapshot list [--json]
mam snapshot rollback <snapshot-id> [--json]
```

Inspection returns the normalized profile plus speed ordering, estimated run acceleration/stopping time, full-stamina sprint duration, dodge invulnerability duration, and dodge average travel speed. Validation combines JSON Schema and semantic rules.

Set resolves only an existing dotted property. It parses the proposed value as JSON, validates the complete candidate, supports a zero-write dry run, snapshots immediately before a real write, writes atomically with two-space formatting and a trailing newline, verifies persisted hash and validation, and audits exact changes. A post-write failure triggers one exact-content restoration and verification attempt; top-level status remains `failed` whether recovery is restored or failed.

## Deterministic simulation

Simulation uses a fixed `1/60` second timestep and never reads wall-clock time or randomness.

- `accelerate` starts at rest and reports duration, final/maximum speed, time to 95% of run speed, distance, timestep, and steps.
- `stop` starts at run speed and reports stopping time/distance, final speed, timestep, and steps.
- `sprint` starts with full stamina and reports distance, final speed, consumed/final stamina, first unavailable time when applicable, timestep, and steps.
- `dodge` reports configured/simulated distance, duration, invulnerability bounds/duration, stamina cost, timestep, and steps.
- `turn` rotates from 0 to 90 degrees by the configured shortest-angle rate and reports target/final yaw, maximum angular speed, target time, and steps.

Equivalent profile, scenario, and duration inputs produce equivalent domain simulation results.

## Phase 1B runtime proof

Godot discovery checks explicit `--godot`, then `MAM_GODOT_BIN`, then platform candidates on `PATH`. Only 4.7 stable standard builds and compatible stable patch releases are accepted; development, alpha, beta, release-candidate, other-minor, and Mono-specific workflows are not accepted.

Each test supplies the complete normalized profile, scenario, fixed delta, duration, and camera yaw to `movement/basic-ground`. Accelerate, stop, sprint, and dodge report distance/speed/timing/stamina plus final position and exact physics steps. Turn reports target/final yaw, maximum angular speed, target time, and steps. The fixture derives forward direction from camera yaw, accelerates or decelerates with fixed delta, rotates by the shortest angle, implements fixed-step sprint stamina/regeneration and deterministic input-directed dodge travel, calls `CharacterBody3D.move_and_slide()`, and adds no jumping or airborne model.

Named comparison tolerances are 0.02 m/s speed, 0.05 m distance, one fixed physics step plus numeric epsilon for time, 0.02 stamina units, 0.25 degrees for angles, and exact physics-step equality. A required metric outside tolerance fails with `RUNTIME_METRIC_TOLERANCE_EXCEEDED`.

Sessions live at `.mam-engine/runtime-sessions/<correlation-id>/` and may contain request, readiness, response, bounded standard-stream logs, and metadata. Writes are atomic. Successful sessions are removed by default, `--keep-session` preserves them, and failed/timed-out/comparison-failed sessions remain for diagnosis. These ignored files and `runtime/godot/.godot/**` are internal artifacts; any other runtime-created repository change fails.

## Phase 1A.1 safety contract

- Inspect, validate, simulate, snapshot list, and set dry-run allow no changed files.
- Real set allows only the target movement profile and its new `.mam-engine/snapshots/*.json` record. Failed post-write verification restores and validates the original snapshot content.
- Snapshot creation allows only its new snapshot record.
- Rollback requires a valid current target, creates a pre-rollback safety snapshot, and allows only that snapshot plus the recorded target file.
- Snapshot metadata includes version, ID, timestamp, operation, repository-relative target, SHA-256 content hash, and exact previous content.
- Rollback verifies the source record and hash, restores it atomically, re-validates and audits, and recovers the pre-rollback state on failed verification.
- Movement targets must be repository-contained JSON files and cannot resolve under `.git`, `.mam-engine`, `node_modules`, or `dist`.
- Same-target persistent operations serialize within one process and release locks in `finally`; read-only operations remain unlocked.

Rollback top-level `snapshotId` is the newly created pre-rollback safety snapshot. `data.sourceSnapshotId` identifies the selected historical snapshot and `data.preRollbackSnapshotId` explicitly repeats the safety snapshot. Selected snapshots are never mutated or deleted.

## Stable errors

Phase 1A.1 adds `MOVEMENT_WRITE_VERIFICATION_FAILED`, `MOVEMENT_WRITE_SCOPE_AUDIT_FAILED`, `MOVEMENT_WRITE_RECOVERY_FAILED`, `SNAPSHOT_PRE_ROLLBACK_FAILED`, `SNAPSHOT_ROLLBACK_VERIFICATION_FAILED`, `SNAPSHOT_ROLLBACK_SCOPE_AUDIT_FAILED`, and `SNAPSHOT_ROLLBACK_RECOVERY_FAILED` to the existing project-owned error surface.

Phase 1B adds `GODOT_BINARY_NOT_FOUND`, `GODOT_BINARY_NOT_EXECUTABLE`, `GODOT_VERSION_READ_FAILED`, `GODOT_VERSION_UNSUPPORTED`, `RUNTIME_PROJECT_NOT_FOUND`, `RUNTIME_REQUEST_INVALID`, `RUNTIME_START_FAILED`, `RUNTIME_NOT_READY`, `RUNTIME_TIMEOUT`, `RUNTIME_PROCESS_EXITED`, `RUNTIME_RESPONSE_MISSING`, `RUNTIME_RESPONSE_INVALID`, `RUNTIME_PROTOCOL_MISMATCH`, `RUNTIME_CORRELATION_MISMATCH`, `RUNTIME_FIXTURE_MISMATCH`, `RUNTIME_EXECUTION_FAILED`, `RUNTIME_UNEXPECTED_FILE_CHANGE`, `RUNTIME_METRIC_TOLERANCE_EXCEEDED`, `FIXTURE_UNKNOWN`, and `RUNTIME_SCENARIO_UNSUPPORTED`.

Errors include a dotted `path` when a field or file can be identified, a stable message, and optional `actual`, `expected`, or structured details. Raw Ajv diagnostics are not the public contract.

## Full v0.1 acceptance criteria

1. Codex can change a movement profile without editing engine-owned movement code. **Met through Phase 1A.1.**
2. Invalid values are rejected with stable error codes and field paths. **Met through Phase 1A.1.**
3. Movement simulation is deterministic. **Met through Phase 1A.1.**
4. A Godot fixture consumes the same validated profile. **Implemented; pinned 4.7-stable acceptance is externally pending.**
5. Runtime results are returned as structured JSON. **Implemented through readiness and final result files.**
6. Tests cover acceleration, maximum speed, stopping, turning, sprint stamina, and dodge timing. **Implemented in domain, comparison, process, and real-integration tiers.**
7. Unexpected file changes cause the operation to fail and attempt target recovery. **Met in Phase 1A.1 application audits.**
8. Snapshot, reversible rollback, and recovery behavior are testable. **Met in Phase 1A.1.**
9. No combat functionality is required. **Preserved.**

Phase 1B uses process-per-run clean exit rather than a persistent shutdown command. Persistent sessions, explicit interactive shutdown, live editing, camera editing, animation, combat, and a visual editor remain unimplemented.
