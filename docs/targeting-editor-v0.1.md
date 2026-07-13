# Targeting Editor v0.1 through Phase 2B.2

## Status

Phase 2B.1 domain foundation and Phase 2B.2 runtime targeting and target-driven camera framing are complete. Canonical Phases 0–10 are complete; this document remains scoped to the Phase 2 targeting contract.

## Canonical profile

`targeting-profile` schema version 1 contains acquisition distance/angle/line-of-sight rules, three authored scoring weights, expanded retention and fixed-step grace rules, and directional switching/cooldown rules. [examples/targeting/default.json](../examples/targeting/default.json) contains prototype defaults, not final game balance. Candidates, target IDs, positions, current lock state, enemies, camera state, and engine paths are scenario data and never persisted in the profile.

## Eligibility and scoring

A candidate must be targetable, have a non-zero direction from the origin, be within acquisition distance and unsigned three-dimensional view angle, and satisfy line of sight when required. Rejections return stable structured codes.

Eligible candidates use unrounded decision values:

```text
distanceScore = clamp(1 - distance / maximumDistance, 0, 1)
angleScore = clamp(1 - angle / maximumAngleDegrees, 0, 1)
totalScore = distanceScore * distanceWeight
           + angleScore * angleWeight
           + priority * priorityWeight
```

Scores equal within `1e-9` break ties by smaller unsigned angle, smaller distance, then ordinal target ID comparison using JavaScript code-unit ordering. Candidate input order, locale, randomness, object order, and wall-clock time cannot affect selection.

## Retention and loss

The current target is retained while targetable and within `maximumDistance * maximumDistanceMultiplier` and `maximumAngleDegrees + additionalAngleDegrees`, with authored line-of-sight policy. Invalidity accumulates in fixed steps. The first invalid step starts grace and contributes one fixed delta. Grace expires when accumulated invalid time reaches the authored duration; zero grace releases on the first invalid step. Valid recovery before expiry clears grace without lock loss. On release, automatic reacquisition selects the highest-ranked acquisition-eligible candidate when enabled.

## Directional switching

Switching measures signed horizontal displacement from the current target direction around world `+Y`, using the camera convention: 0° = negative Z, +90° = negative X, -90° = positive X, and 180° = positive Z. Positive is left and negative is right. Left selects the smallest permitted positive displacement; right selects the negative displacement closest to zero. Equal displacement breaks ties by higher acquisition score, smaller distance, then ordinal ID. Disabled switching, absent current targets, active cooldown, and missing directional candidates retain the current target with a structured reason. Cooldown uses fixed-step elapsed time.

## CLI and scenarios

```text
mam targeting inspect <file> [--json]
mam targeting validate <file> [--json]
mam targeting simulate <file> --scenario <acquire|eligibility|tie-break|retention|loss|reacquire|switch-left|switch-right|switch-cooldown> [--seconds <number>] [--fixed-delta <number>] [--json]
mam targeting runtime-test <file> --camera <camera-file> --scenario <scenario-id> [--seconds <number>] [--fixed-delta <number>] [--godot <path>] [--keep-session] [--json]
mam targeting set <file> <property-path> <json-value> [--dry-run] [--json]
```

Simulations use a default fixed delta of 1/60 second and return selected/initial/final IDs, eligibility and rejection evidence, distances and angles, component/total scores, lock/grace/release/reacquisition state, directional switching and cooldown state, exact steps, and fixed delta.

## Safety and verification boundary

Inspect, validate, simulate, and dry-run set are zero-write operations. Real set validates the complete candidate, locks the target, creates a kind-aware snapshot, writes atomically, verifies hash and targeting validity, audits changed files, and restores exact prior content after post-write failure. Targeting snapshots cannot cross movement/camera kind boundaries and rollback creates a pre-restore safety snapshot.

Node and real Godot tests cover the normalized dual-profile request, deterministic plans, real spatial LOS, acquisition/scoring/ties, retention/grace/loss/reacquisition, switching/cooldown, target-driven framing, lens readback, session lifecycle, and file safety. Candidate and event data remain ephemeral.

This controlled targeting fixture is not production gameplay and does not itself execute combat, enemies, weapons, damage, animation, audio, VFX, networking, multiplayer, or live runtime editing. Later canonical phases provide separate scoped fixtures without widening this targeting contract.
