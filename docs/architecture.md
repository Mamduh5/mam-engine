# Architecture

## Layer model

```text
Codex / mam CLI (implemented) / future visual editor
                        |
                        v
Movement, camera, runtime, and snapshot application services (implemented)
                        |
                        v
Movement/camera domains, JSON Schema, semantic validation (implemented)
                        |
                        v
Runtime protocol -> process-per-run Godot adapter -> fixture (implemented in Phase 1B)
                        |
                        v
Machine-readable reports
```

Snapshots, rollback, and changed-file safety surround every persistent operation rather than belonging to presentation or Godot.

## Responsibilities

### CLI adapter - implemented in Phase 1A

Parses `mam` movement and snapshot commands, invokes application services, emits a versioned operation-result envelope, and maps failures to exit codes. It contains no movement or persistence policy and uses no CLI framework.

### Engine and application services - shared movement, camera, targeting, and snapshot services implemented

Coordinate movement inspect, validate, transactional set, and simulate plus snapshot create, list, reversible rollback, and changed-file audits. A shared transactional replacement service owns post-write hash/validation checks, scope audit, exact-content recovery, and recovery evidence. Runtime launch and fixture orchestration remain Phase 1B.

### Schemas and definitions - movement, camera, and targeting v1 implemented

The movement v1 JSON Schema defines canonical authored data, identifiers, supported modes, required fields, and unknown-field rejection. Semantic validation supplies cross-field and numeric rules. Stored definitions are data, not executable source patches.

### Validation - implemented for movement, camera, and targeting v1

Ajv performs structural checks and project-owned domain code performs semantic checks. Errors have stable codes and precise dotted paths. Invalid definitions cannot be simulated, snapshotted, or persisted.

### Runtime protocol - implemented in Phase 1B

Provides validated `mam.runtime/v1` request, readiness, and final-response files between engine services and one owned Godot process. Terminal output is bounded diagnostics only.

### Godot runtime adapter - implemented in Phase 1B

Translates validated definitions and fixture commands into Godot execution, then measures and reports outcomes. It may implement runtime integration details but may not define canonical authoring values in scenes or resources.

### Fixtures - movement Phase 1B and camera Phase 2A.2 implemented

Provide controlled worlds, initial state, inputs, clocks, and expected measurements for one vertical slice. A fixture cannot add a private authoring model.

The runtime dispatcher validates `mam.runtime/v1` and selects `movement/basic-ground`, `camera/basic-third-person`, or `targeting/basic-lock-on`. All use the same atomic request/readiness/response transport, bounded process owner, session store, correlation checks, and changed-file audit. Targeting receives normalized targeting and camera profiles plus an ephemeral plan; Godot never reads source definition paths.

Targeting Phase 2B.2 keeps candidates, world events, and lock state as ephemeral runtime inputs. The targeting fixture performs real dedicated-mask ray queries and independently evaluates acquisition, retention, switching, and framing using existing camera fields; it adds no canonical properties or combat semantics.

### Reports - CLI operation envelope implemented

Phase 1A operations return protocol version, command, narrow status, correlation ID, normalized input, data, warnings, errors, exact changed files, and snapshot ID. The separate Godot runtime report contract remains specified for Phase 1B.

### Snapshots and rollback - reversible in Phase 1A.1

Real set operations capture exact previous content immediately before writing. Repository-local ignored snapshot records contain metadata version, ID, timestamp, operation, target path, content hash, and restorable content. Before rollback overwrites a valid current target, it creates a `snapshot.rollback.pre_restore` safety snapshot. Both set and rollback recover the exact pre-operation content when post-write verification or scope auditing fails, then verify recovery without deleting either snapshot.

### Concurrency

Persistent set and rollback operations use an in-process repository-relative target queue. Operations for the same target serialize; different targets may proceed independently. Locks release in `finally`, including failure paths. Inspect, validate, simulate, dry-run, and snapshot listing do not take the write lock.

### Automated tests and remote CI

Node built-in tests verify schema, validation, simulation, transactions, recovery, locking, rollback, CLI output, runtime protocol, discovery, comparison, and process lifecycle. Real Godot tests verify movement, camera, and targeting fixtures. GitHub Actions retains the Node matrix and a Node 22 job that downloads and digest-verifies the exact official `4.7-stable` standard Linux artifact before the complete integration tier.

## Dependency rules

- Clients depend on engine service interfaces; services never depend on a terminal or GUI.
- Services depend on domain types, schemas, validators, and ports for storage/runtime operations.
- Schema and domain code do not depend on Godot.
- The Godot adapter depends on published schemas and protocol contracts, not CLI presentation.
- Fixtures depend on the runtime adapter and validated definitions; engine logic does not depend on a particular fixture.
- Reports use shared protocol/domain types rather than scraping logs.
- Persistence requires validation first; runtime launch will follow the same rule in Phase 1B.
- Persistent operations require an explicit allowed-file plan and a post-operation changed-file audit.

Engine-domain logic must not depend directly on terminal presentation, a future GUI, a particular fixture, or repository-specific source patching. No layer may use arbitrary source detection or regex rewriting as the normal authoring mechanism.

## Canonical data flow

An authoring client inspects the current canonical definition, proposes a structured dotted-path change, validates the complete candidate, and may dry-run or simulate without persistence. A real set locks its target, snapshots the existing file, writes formatted JSON atomically, re-reads it, verifies its hash and domain validity, and audits actual changes. Any post-write failure triggers one exact-content recovery attempt and structured recovery verification. In Phase 1B, runtime execution will receive the same validated definition plus a fixture request; Godot will not write canonical definitions back implicitly.

Temporary live drafts, when introduced, will be separately identified, validated, disposable, and lower priority than an explicit persistent save decision. Clearing a draft must restore the last persisted/baseline behavior without rewriting unrelated files.
