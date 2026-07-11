# ADR 0002: Godot 4 runtime host

- Status: Accepted
- Scope: Runtime and fixture execution

## Context

The engine needs a practical third-person runtime with rendering, physics, skeletal animation, input, audio, navigation, and automated headless execution. Rebuilding these host capabilities is outside the product's purpose.

## Decision

Use Godot 4 as the runtime and fixture host. Godot consumes validated engine definitions through a versioned adapter and returns machine-readable runtime reports.

Godot is not the complete editor architecture and does not own canonical definitions. Scene resources and script defaults may provide adapter mechanics or explicit fallbacks, but they may not silently supersede supplied authored values.

## Consequences

- The project can focus on authoring contracts, validation, simulation, orchestration, and evidence.
- Runtime integration tests can use Godot headless mode.
- Godot-specific code is isolated behind the runtime protocol.
- Runtime availability and version become explicit integration-test prerequisites.
- Care is required to prevent fixture scenes from becoming the hidden source of truth.

## Alternatives considered

A custom runtime was rejected as unnecessary foundation work. Making Godot resources the whole editor model was rejected because it would couple Codex authoring and future clients to fixture/runtime internals.
