# ADR 0001: CLI-first editor interface

- Status: Accepted
- Scope: Initial editor interface

## Context

The primary user is Codex or another automated agent. It needs stable operations, structured results, validation, exact failure states, and repeatable automation before visual interaction is useful.

## Decision

The first editor interface is the machine-readable `mam` CLI. Commands call presentation-independent engine/application services and return versioned structured output. A future GUI will call those same services and protocols.

## Consequences

- Contracts and testability precede visual-editor convenience.
- Terminal prose cannot be the automation protocol.
- CLI parsing and exit codes remain adapters, not domain logic.
- Human workflows are initially less visual.
- Service boundaries must be clean enough for another client later.

## Alternatives considered

Starting with a desktop or web GUI was rejected because it would add framework and presentation decisions before the engine contracts are proven. Editing files directly without a CLI was rejected because it provides weak discoverability, validation, safety auditing, and machine-readable evidence.
