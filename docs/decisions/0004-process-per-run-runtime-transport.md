# ADR 0004: Process-per-run runtime transport

- Status: Accepted
- Scope: Movement Editor v0.1 runtime proof

## Context

Movement Editor Phase 1B needs deterministic ownership of Godot startup, readiness, execution, timeout, diagnostics, and shutdown. A persistent interactive process would add port or socket management and a second command lifecycle before the first runtime proof exists.

## Decision

For Movement Editor v0.1, each runtime test owns one Godot process. The TypeScript adapter validates the movement profile, creates a filename-safe correlation ID and isolated `.mam-engine/runtime-sessions/<correlation-id>/` directory, writes one complete `mam.runtime/v1` request, starts Godot without a shell, validates structured `ready.json` and `response.json`, compares runtime measurements with the domain simulation, terminates only its owned process on timeout, audits repository changes, and removes successful diagnostics unless `--keep-session` was requested. Failed and timed-out sessions are retained.

The Godot process reads user arguments after `--`, validates the request envelope, atomically writes exactly one readiness response, executes exactly one registered fixture scenario, atomically writes exactly one final response, and exits. Standard output and error are bounded diagnostic evidence only; terminal prose is never the protocol.

Clean process exit is the normal shutdown lifecycle. A persistent interactive process and an explicit `runtime.fixture.shutdown` command are reserved for a later phase.

## Consequences

- Lifecycle and timeout ownership are simple and deterministic.
- No sockets, ports, or persistent-session coordination are required.
- Each request pays Godot startup cost, so it is slower than a persistent editor session.
- The design is suitable for initial automated proof and can later be replaced without changing movement definitions or the `mam.runtime/v1` data boundary.
