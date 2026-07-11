# mam-engine

`mam-engine` is a Codex-native editor and engine for authoring, validating, simulating, inspecting, and testing third-person action games. Its primary user is Codex or another automated coding agent, so operations use explicit contracts and machine-readable results.

The long-term target is a Dauntless-style action hunting game. The current milestone is **Movement Editor Phase 1A**, the engine-independent movement-domain foundation. It does not include Godot integration or combat.

## Implemented in Phase 1A

- A Node.js/TypeScript `mam` CLI with versioned JSON results.
- JSON Schema and semantic validation for movement profile v1.
- Deterministic fixed-timestep simulations for acceleration, stopping, sprinting, and dodging.
- Read-only movement inspection with derived metrics.
- Existing-property dotted-path edits, including dry runs and full-candidate validation.
- Atomic two-space JSON persistence with a trailing newline.
- Pre-write snapshots, snapshot listing, and exact-content rollback.
- Repository-relative changed-file auditing and explicit write allowlists.
- Node built-in tests for schema, validation, simulation, editing, snapshots, rollback, and CLI behavior.

## Why CLI first

The `mam` CLI gives automated agents stable commands, structured input and output, deterministic validation, exact changed-file reporting, and testable failure behavior before a human-facing interface exists. A later visual editor will call the same application services rather than replace them.

Godot 4 remains the planned runtime host because it provides rendering, physics, skeletal animation, input, audio, navigation, and headless execution. Godot is not the product or canonical authoring source. No Godot adapter or fixture is implemented in Phase 1A.

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
mam movement simulate <file> --scenario <accelerate|stop|sprint|dodge> [--seconds <number>] [--json]
mam movement set <file> <property-path> <json-value> [--dry-run] [--json]

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
```

Snapshots are stored under ignored `.mam-engine/snapshots/`. A real set validates first, snapshots immediately before writing, writes atomically, re-reads and validates, then audits the actual changed files.

## Repository structure

- [`src/cli/`](src/cli/main.ts) - command parsing and output adapters.
- [`src/application/`](src/application/movement/inspectMovement.ts) - movement and snapshot use cases.
- [`src/domain/movement/`](src/domain/movement/movementTypes.ts) - domain types, validation, metrics, and simulation.
- [`src/infrastructure/`](src/infrastructure/files/changedFileAudit.ts) - JSON, schema, audit, and snapshot adapters.
- [`schemas/movement/`](schemas/movement/v1.schema.json) - canonical movement profile v1 schema.
- [`examples/movement/`](examples/movement/default.json) - prototype defaults, not final game balance.
- [`tests/`](tests/README.md) - engine-independent automated verification.
- [`runtime/godot/`](runtime/godot/README.md) and [`fixtures/movement/`](fixtures/movement/README.md) - documented Phase 1B boundaries only.

## Current limitations

- No Godot runtime adapter, live connection, or movement fixture exists yet.
- No visual editor exists.
- There is no jumping, airborne movement, swimming, climbing, slopes, ledges, root motion, or animation state.
- There is no combat, targeting, enemy, weapon, damage, audio, VFX, progression, multiplayer, or open-world implementation.
- Movement Editor v0.1 as a whole is not complete until Phase 1B proves the same profile through Godot.

## Documentation

- [Product vision](docs/product-vision.md)
- [Architecture](docs/architecture.md)
- [Codex contract](docs/codex-contract.md)
- [Movement Editor v0.1](docs/movement-editor-v0.1.md)
- [Runtime and CLI protocols](docs/runtime-protocol.md)
- [Testing strategy](docs/testing-strategy.md)
- [Roadmap](docs/roadmap.md)
- Decisions: [CLI first](docs/decisions/0001-cli-first.md), [Godot runtime](docs/decisions/0002-godot-runtime.md), and [authored vs. engine-owned files](docs/decisions/0003-codex-owned-vs-engine-owned.md)
