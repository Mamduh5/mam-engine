# mam-engine

`mam-engine` is a Codex-native editor and engine for authoring, validating, simulating, inspecting, and testing third-person action games. Its primary user is Codex or another automated coding agent, so operations use explicit contracts and machine-readable results.

The long-term target is a Dauntless-style action hunting game. **Movement Editor v0.1, Camera Editor v0.1 through Phase 2A.2, and Targeting Editor v0.1 through Phase 2B.2 are complete.** Movement, camera, and targeting have controlled Godot 4.7-stable runtime proof. Phase 2 camera and targeting is complete; Phase 3 dodge and defensive actions is not started.

## Implemented through Phase 2A.2

- A Node.js/TypeScript `mam` CLI with versioned JSON results.
- JSON Schema and semantic validation for movement profile v1.
- Deterministic fixed-timestep simulations for acceleration, stopping, sprinting, and dodging.
- Read-only movement inspection with derived metrics.
- Existing-property dotted-path edits, including dry runs and full-candidate validation.
- Atomic two-space JSON persistence with a trailing newline.
- Transactional persistence that restores exact pre-operation content when post-write verification fails.
- Pre-write snapshots, snapshot listing, and reversible rollback with a pre-rollback safety snapshot.
- Repository-relative changed-file auditing and explicit write allowlists.
- Per-target in-process serialization for persistent operations; read-only operations remain unlocked.
- Node built-in tests for schema, validation, simulation, editing, failure recovery, locking, snapshots, rollback, and CLI behavior.
- GitHub Actions checks on Ubuntu with Node 20/22 and Windows with Node 22.
- Godot 4.7-stable discovery, structured readiness/results, a fixed-step basic-ground fixture, simulator/runtime comparisons, and a separate real-runtime CI job.
- Camera profile v1 schema and semantic validation for orbit, follow, recenter, collision, and lens settings.
- Deterministic camera orbit, pitch-clamp, recenter, follow, collision, and basis simulations; follow scenarios include a fixed-step settling interval after target motion.
- Read-only camera inspect, validate, and simulate operations; safe camera dotted-path edits with dry runs, snapshots, exact recovery, and kind-aware rollback isolation.
- A `camera/basic-third-person` Godot fixture consuming the complete validated camera profile for orbit, pitch clamp, move-then-settle follow, delayed recenter, real spatial collision compression/recovery, camera-relative basis, and lens application.
- A separate `targeting/basic-lock-on` fixture consuming normalized targeting and camera profiles plus ephemeral plans for real LOS, acquisition, retention, switching, and target-driven framing.
- Structured camera runtime metrics and named domain/runtime tolerances, including real cold-cache Godot integration tests.
- Targeting profile v1 validation and safe authoring, deterministic acquisition/scoring, stable ties, retention/grace/reacquisition, and directional switching/cooldown simulations.

## Why CLI first

The `mam` CLI gives automated agents stable commands, structured input and output, deterministic validation, exact changed-file reporting, and testable failure behavior before a human-facing interface exists. A later visual editor will call the same application services rather than replace them.

Godot 4 is the controlled runtime host. It consumes the supplied validated definition and is not the product or canonical authoring source.

## Requirements and setup

- Node.js 20 or newer
- npm

```text
npm install
npm run check
```

The package exposes the executable name `mam` through its `bin` entry. During repository development, use `npm run mam -- <arguments>`; an installed or linked package can use `mam <arguments>` directly.

## Commands

Every command accepts `--json`. JSON mode writes one versioned result envelope to standard output and returns a non-zero exit code on failure.

```text
mam movement inspect <file> [--json]
mam movement validate <file> [--json]
mam movement simulate <file> --scenario <accelerate|stop|sprint|dodge|turn> [--seconds <number>] [--json]
mam runtime check [--godot <path>] [--json]
mam movement runtime-test <file> --scenario <accelerate|stop|sprint|dodge|turn> [--seconds <number>] [--camera-yaw-degrees <number>] [--godot <path>] [--keep-session] [--json]
mam movement set <file> <property-path> <json-value> [--dry-run] [--json]

mam camera inspect <file> [--json]
mam camera validate <file> [--json]
mam camera simulate <file> --scenario <orbit|pitch-clamp|recenter|follow|collision|basis> [--seconds <number>] [--fixed-delta <number>] [--json]
mam camera runtime-test <file> --scenario <orbit|pitch-clamp|recenter|follow|collision|basis> [--seconds <number>] [--fixed-delta <number>] [--godot <path>] [--keep-session] [--json]
mam camera set <file> <property-path> <json-value> [--dry-run] [--json]

mam targeting inspect <file> [--json]
mam targeting validate <file> [--json]
mam targeting simulate <file> --scenario <acquire|eligibility|tie-break|retention|loss|reacquire|switch-left|switch-right|switch-cooldown> [--seconds <number>] [--fixed-delta <number>] [--json]
mam targeting runtime-test <file> --camera <camera-file> --scenario <acquire|eligibility|tie-break|retention|loss|reacquire|switch-left|switch-right|switch-cooldown|framing-acquire|framing-switch|framing-loss|framing-reacquire> [--seconds <number>] [--fixed-delta <number>] [--godot <path>] [--keep-session] [--json]
mam targeting set <file> <property-path> <json-value> [--dry-run] [--json]

mam snapshot create <file> [--json]
mam snapshot list [--json]
mam snapshot rollback <snapshot-id> [--json]
```

Examples:

```text
npm run mam -- movement inspect examples/movement/default.json --json
npm run mam -- movement simulate examples/movement/default.json --scenario accelerate --seconds 2 --json
npm run mam -- movement set examples/movement/default.json ground.runSpeed 6.5 --dry-run --json
npm run mam -- movement set examples/movement/default.json ground.orientationMode '"camera_relative"' --json
npm run mam -- camera inspect examples/camera/default.json --json
npm run mam -- camera simulate examples/camera/default.json --scenario follow --json
npm run mam -- camera runtime-test examples/camera/default.json --scenario collision --json
npm run mam -- camera set examples/camera/default.json follow.distance 6.5 --dry-run --json
npm run mam -- targeting simulate examples/targeting/default.json --scenario acquire --json
```

Snapshots are stored under ignored `.mam-engine/snapshots/`. A real set validates first, snapshots immediately before writing, writes atomically, verifies hash and validation, then audits actual changes. If post-write verification fails, the operation restores and verifies the exact snapshot content while retaining the original failure and snapshot.

Rollback is reversible by default. Before restoring a selected historical snapshot, `mam` snapshots the current valid target using operation `snapshot.rollback.pre_restore`. For rollback results, top-level `snapshotId` is the new pre-rollback safety snapshot; `data.sourceSnapshotId` is the selected historical snapshot and `data.preRollbackSnapshotId` repeats the safety snapshot explicitly.

## Repository structure

- [`src/cli/`](src/cli/main.ts) - command parsing and output adapters.
- [`src/application/`](src/application/movement/inspectMovement.ts) - movement, snapshot, locking, and transactional persistence use cases.
- [`src/domain/movement/`](src/domain/movement/movementTypes.ts) - domain types, validation, metrics, and simulation.
- [`src/domain/camera/`](src/domain/camera/cameraTypes.ts) - camera profile types, validation, math, metrics, and simulation.
- [`src/infrastructure/`](src/infrastructure/files/changedFileAudit.ts) - JSON, schema, audit, and snapshot adapters.
- [`schemas/movement/`](schemas/movement/v1.schema.json) - canonical movement profile v1 schema.
- [`examples/movement/`](examples/movement/default.json) - prototype defaults, not final game balance.
- [`schemas/camera/`](schemas/camera/v1.schema.json) and [`examples/camera/`](examples/camera/default.json) - canonical Camera Editor v0.1 through Phase 2A.2 profile contract and prototype default.
- [`schemas/targeting/`](schemas/targeting/v1.schema.json) and [`examples/targeting/`](examples/targeting/default.json) - Phase 2B.1 targeting rules and prototype default.
- [`tests/`](tests/README.md) - engine-independent automated verification.
- [`runtime/godot/`](runtime/godot/README.md) and [`fixtures/movement/`](fixtures/movement/README.md) - controlled Phase 1B runtime and fixture.

## Current limitations

- No persistent live runtime session, live editing, visual camera editor, or explicit interactive shutdown command exists.
- No visual editor exists.
- There is no jumping, airborne movement, swimming, climbing, slopes, ledges, root motion, or animation state.
- Targeting runtime is controlled fixture proof, not a complete combat system. There is no enemy, weapon, damage, audio, VFX, progression, multiplayer, or open-world implementation.
- Phase 3 dodge and defensive actions, and later combat systems, remain separate roadmap work.

## Documentation

- [Product vision](docs/product-vision.md)
- [Architecture](docs/architecture.md)
- [Codex contract](docs/codex-contract.md)
- [Movement Editor v0.1](docs/movement-editor-v0.1.md)
- [Camera Editor v0.1 through Phase 2A.2](docs/camera-editor-v0.1.md)
- [Targeting Editor Phase 2B.1](docs/targeting-editor-v0.1.md)
- [Runtime and CLI protocols](docs/runtime-protocol.md)
- [Testing strategy](docs/testing-strategy.md)
- [Roadmap](docs/roadmap.md)
- Decisions: [CLI first](docs/decisions/0001-cli-first.md), [Godot runtime](docs/decisions/0002-godot-runtime.md), [authored vs. engine-owned files](docs/decisions/0003-codex-owned-vs-engine-owned.md), and [process-per-run transport](docs/decisions/0004-process-per-run-runtime-transport.md)
