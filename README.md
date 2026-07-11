# mam-engine

`mam-engine` is a Codex-native editor and engine for authoring, validating, running, inspecting, and testing third-person action games. Its primary user is Codex or another automated coding agent, so every important operation is intended to have an explicit contract and machine-readable result.

The long-term target is a Dauntless-style action hunting game. The current milestone is **Phase 0: repository foundation and contracts**. It defines boundaries and protocols only; Movement Editor v0.1 is the next implementation milestone.

## Why CLI first

The first editor interface will be the `mam` command-line tool. A CLI gives automated agents stable commands, structured input and output, deterministic validation, exact changed-file reporting, and testable failure behavior before a human-facing interface exists. A later visual editor will call the same engine services and protocols rather than replace them.

Godot 4 is the runtime host because it provides mature rendering, physics, skeletal animation, input, audio, navigation, and headless execution. Godot is not the product or the canonical authoring source: the engine's validated definitions are canonical, and the Godot project is a runtime adapter and test fixture.

## Repository structure

- [`cli/`](cli/README.md) — planned machine-readable `mam` adapter.
- [`engine/`](engine/README.md) — editor/engine application-service boundary.
- [`schemas/`](schemas/README.md) — versioned canonical definition and protocol schemas.
- [`runtime/godot/`](runtime/godot/README.md) — Godot 4 runtime adapter and fixture host.
- [`fixtures/movement/`](fixtures/movement/README.md) — controlled movement acceptance fixture.
- [`tests/`](tests/README.md) — layered automated verification.
- [`docs/`](docs/product-vision.md) — product, architecture, protocol, milestone, and roadmap contracts.

## Planned command style

These commands are **planned and are not implemented in Phase 0**:

```text
mam project inspect
mam movement inspect
mam movement validate
mam movement test
mam runtime launch
mam snapshot create
mam snapshot rollback
```

Commands will keep human diagnostics separate from a versioned JSON result written to standard output. Failures will use stable error codes and non-zero process exit codes.

## Development prerequisites

Phase 0 requires only Git and a Markdown reader. Future runtime work will require Godot 4 with headless execution available. The CLI implementation language and its toolchain will be selected when Movement Editor v0.1 begins; this foundation intentionally adds no package manager, GUI framework, database, or networking dependency.

## Current limitations

- No executable `mam` CLI exists yet.
- No schemas, validators, simulation, snapshots, or rollback implementation exists yet.
- No Godot project or runtime fixture has been created yet.
- No movement or combat behavior is implemented.
- No visual editor exists.

## Documentation

- [Product vision](docs/product-vision.md)
- [Architecture](docs/architecture.md)
- [Codex contract](docs/codex-contract.md)
- [Movement Editor v0.1 specification](docs/movement-editor-v0.1.md)
- [Runtime protocol](docs/runtime-protocol.md)
- [Testing strategy](docs/testing-strategy.md)
- [Roadmap](docs/roadmap.md)
- Decisions: [CLI first](docs/decisions/0001-cli-first.md), [Godot runtime](docs/decisions/0002-godot-runtime.md), and [authored vs. engine-owned files](docs/decisions/0003-codex-owned-vs-engine-owned.md)
