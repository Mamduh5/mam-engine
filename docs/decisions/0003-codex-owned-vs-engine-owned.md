# ADR 0003: Separate authored definitions from engine infrastructure

- Status: Accepted
- Scope: Ownership and mutation safety

## Context

Automated agents need freedom to author game content without routinely rewriting validators, runtime adapters, or simulation code. Without explicit ownership, a failed content request can turn into an unreviewed engine modification and invalidate safety guarantees.

## Decision

Separate Codex-authored game definitions from protected engine-owned infrastructure. Game-authoring mode changes project manifests, supported domain definitions, and fixture configuration. Engine-development mode changes validators, dispatch, loaders, runtime adapters, simulation, reporting, snapshots, and audits only when the task explicitly requests engine capability.

Examples:

- Changing `movement/default` sprint speed is authored content.
- Adding the sprint-speed range rule is engine infrastructure.
- Choosing a movement scenario for a fixture is authored configuration.
- Changing how Godot calculates or measures velocity is engine infrastructure.
- Future weapon, enemy, and encounter definitions are authored content after their engine phases exist; implementing those systems is infrastructure.

## Consequences

- Normal game authoring is smaller, reviewable, and safer.
- Definitions require deliberate, versioned extension when the engine gains capability.
- Unsupported authoring requests must fail honestly instead of patching engine code.
- Engine-development work carries broader test and compatibility obligations.
- Allowed-file policies can differ by operating mode and be audited mechanically.

## Tradeoffs

The boundary adds schemas, migrations, and service APIs that direct source editing could avoid in the short term. It also makes experimental engine behavior require an explicit engine-development task. In return, authored changes remain portable across CLI, future GUI, deterministic simulation, and Godot fixtures, while infrastructure changes receive appropriate scrutiny and tests.
