# Camera Editor v0.1

## Status and scope

Camera Editor v0.1 is complete through Phase 2A.2. Phase 2A.1 provides the canonical `camera-profile` v1 schema, semantic validation, inspection, deterministic simulations, transactional edits, and kind-aware snapshot/rollback safety. Phase 2A.2 proves that Godot 4.7-stable consumes the same normalized profile and matches those simulations within declared tolerances.

The checked-in default remains [examples/camera/default.json](../examples/camera/default.json). Runtime testing is read-only: Godot receives the complete profile through `mam.runtime/v1`, does not read the canonical file, creates no snapshot, and may generate only ignored runtime session and Godot cache artifacts.

## Commands

```text
mam camera inspect <file> [--json]
mam camera validate <file> [--json]
mam camera simulate <file> --scenario <orbit|pitch-clamp|recenter|follow|collision|basis> [--seconds <number>] [--fixed-delta <number>] [--json]
mam camera runtime-test <file> --scenario <orbit|pitch-clamp|recenter|follow|collision|basis> [--seconds <number>] [--fixed-delta <number>] [--godot <path>] [--keep-session] [--json]
mam camera set <file> <property-path> <json-value> [--dry-run] [--json]
```

## Runtime behavior

`camera/basic-third-person` applies authored orbit speeds/inversion/limits/initial angles, follow distance and offsets, position and rotation half-lives, optional delayed recenter, collision probe radius/minimum distance/return half-life, and lens values. Public yaw remains `[-180, 180)` with 0 degrees = negative Z, 90 = negative X, -90 = positive X, and 180 = positive Z.

Orbit input is updated directly at the authored bounded speed. Follow position uses `target + (current - target) * 2^(-delta/halfLife)` and snaps when half-life is zero. Orientation-follow uses `rotationHalfLifeSeconds`; recenter uses its own shortest-angle bounded angular speed and never borrows rotation smoothing. The follow scenario moves the target for the first fixed-step half, stops it for the second, and measures settling.

Collision uses a real sphere `ShapeCast3D` from the look-at origin toward the desired camera boom. A controlled wall compresses distance with probe-radius and minimum-distance accounting, is disabled at a deterministic step, and recovery uses the authored return half-life. When collision is disabled, the same obstruction does not compress the camera.

Every scenario reports structured metrics plus effective `Camera3D` FOV, near clip, and far clip. Comparison tolerances are: angle 0.25 degrees, distance and position component 0.05 units, time one fixed step plus `1e-9`, basis magnitude and orthogonality 0.001, steps and booleans exact, and lens 0.001.

## Verification boundary

Focused Node tests cover camera runtime request/response validation, metric shape, comparison failures, pre-spawn validation, and CLI envelopes. Real headless tests cover cold cache, orbit, pitch clamp, default/disabled/below-threshold/manual-input recenter behavior, follow motion/settling, enabled/disabled collision, basis, lens readback, clean exit, session cleanup, and zero canonical file changes.

This camera fixture remains scoped to camera behavior and does not itself execute combat, enemies, weapons, damage, animation, audio, VFX, networking, multiplayer, or live runtime editing. Targeting, later canonical gameplay slices, and the local visual editor are implemented through separate contracts and controlled proofs.
