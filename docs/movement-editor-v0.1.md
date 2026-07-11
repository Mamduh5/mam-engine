# Movement Editor v0.1

## Status and goal

This document specifies the next milestone; it does not describe implemented functionality. Movement Editor v0.1 will prove the complete editor/engine path for one third-person movement profile without adding combat.

## Definition scope

The first movement schema should cover:

- camera-relative ground movement
- walk, run, and sprint speed
- acceleration and deceleration
- character rotation behavior
- sprint stamina cost and stamina regeneration
- dodge distance and duration
- dodge invulnerability window
- movement restrictions during dodge

Every numeric value must define units, finite bounds, and inclusive/exclusive range semantics. Timing fields must use one documented time unit. Cross-field validation must ensure, for example, ordered speed tiers, an invulnerability window contained within dodge duration, and non-negative stamina values.

## Planned capabilities

- Machine-readable inspection of the stored profile and its source path.
- Structural and semantic validation with stable error codes.
- A path-based edit that creates a candidate, validates it, and persists only on explicit success.
- Deterministic fixed-timestep simulation with declared initial conditions and input sequence.
- Godot fixture execution using the identical validated profile.
- Runtime measurement reports that can be compared to simulation expectations within explicit tolerances.
- Changed-file auditing, snapshots, and rollback around persistence.

## Planned commands

These commands are not implemented yet:

```text
mam movement inspect
mam movement validate
mam movement set <path> <value>
mam movement simulate
mam movement test
mam runtime launch movement
```

`inspect`, `validate`, and `simulate` are read-only. `set` must show a candidate result, reject invalid values, snapshot the current profile before persistence, and report exact changed files. `test` runs deterministic and applicable runtime checks. `runtime launch movement` starts only the named movement fixture and follows the runtime lifecycle contract.

## Determinism contract

Simulation inputs include schema version, profile content, initial transform and stamina, camera basis, fixed timestep, step count, and a time-indexed input sequence. The simulation must not read wall-clock time, rendering state, unseeded randomness, or fixture-private defaults. Equivalent inputs produce equivalent ordered samples and summary metrics.

## Acceptance criteria

1. Codex can change a movement profile without editing engine-owned movement code.
2. Invalid values are rejected with stable error codes and field paths.
3. Movement simulation is deterministic.
4. A Godot fixture consumes the same validated profile.
5. Runtime results are returned as structured JSON.
6. Tests cover acceleration, maximum speed, stopping, turning, sprint stamina, and dodge timing.
7. Unexpected file changes cause the operation to fail.
8. Snapshot and rollback behavior is testable.
9. No combat functionality is required.

The milestone is not complete until all nine criteria have automated evidence or an explicitly documented environment-only limitation for a Godot-dependent check.
