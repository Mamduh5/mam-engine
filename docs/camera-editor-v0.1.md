# Camera Editor Phase 2A.1

## Status and scope

Phase 2A.1 is complete. It provides an engine-independent, data-authored camera profile foundation that Codex can validate, inspect, simulate, and edit safely through the `mam` CLI. It does not add a Godot camera adapter, a runtime camera fixture, targeting, combat, or a visual editor.

The canonical format is `camera-profile` schema version 1. The checked-in default is [examples/camera/default.json](../examples/camera/default.json); it is a prototype configuration, not final game balance.

## Authored camera profile

The profile contains these validated groups:

- `orbit`: yaw/pitch speeds, inversion, pitch limits, and initial angles.
- `follow`: distance, height, shoulder and look-at offsets, plus position and rotation half-lives.
- `recenter`: enablement, delay, angular speed, and movement-input threshold.
- `collision`: enablement, probe radius, minimum distance, and return half-life.
- `lens`: field of view and near/far clip distances.

JSON Schema rejects missing and unknown fields. Semantic validation rejects non-finite values, invalid ranges, invalid half-lives, invalid collision geometry, and cross-field inconsistencies. Yaw is normalized into `[-180, 180)`.

## Commands

```text
mam camera inspect <file> [--json]
mam camera validate <file> [--json]
mam camera simulate <file> --scenario <orbit|pitch-clamp|recenter|follow|collision|basis> [--seconds <number>] [--fixed-delta <number>] [--json]
mam camera set <file> <property-path> <json-value> [--dry-run] [--json]
```

`inspect`, `validate`, and `simulate` are read-only and audit that they changed no repository files. `set` validates the full candidate, supports dry runs, writes atomically, creates a kind-aware snapshot, verifies the persisted result, and restricts changed files to the target and snapshot paths. Snapshot create, list, and rollback remain shared commands and preserve definition kind, so a movement snapshot cannot overwrite a camera profile or vice versa.

## Deterministic simulations

All camera simulations use a supplied fixed delta, defaulting to 1/60 second, and report deterministic rounded metrics. The scenarios cover orbit travel, pitch limits, delayed recentering, follow smoothing, collision compression/recovery, and horizontal camera basis.

The `follow` scenario starts the target and camera at their configured follow offset. The target moves at 1 unit per second for the first half of its fixed physics steps and stops for the second half. The camera continues to use the configured position half-life during both intervals. Its report retains these metrics: `durationSeconds`, `initialFollowError`, `maximumFollowError`, `finalFollowError`, `finalCameraPosition`, `finalTargetPosition`, `physicsSteps`, and `fixedDeltaSeconds`. The settling interval intentionally makes final follow error smaller than the maximum trailing error.

The half-life functions are frame-rate independent for a stationary target: applying equivalent elapsed time at different fixed deltas gives the same remaining-error decay. The follow scenario additionally verifies matching target travel, error growth during the motion interval, error decay during the settling interval, and exact repeatability.

## Verification boundary

The Node test suite covers profile/schema and semantic validation, camera math, deterministic simulations, read-only inspection, CLI output, safe edits, kind-aware snapshots, rollback isolation, and error behavior. It is not runtime proof. Camera runtime behavior, camera collision geometry in Godot, target acquisition/selection, and target-driven camera behavior remain later work.
