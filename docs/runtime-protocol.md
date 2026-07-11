# Runtime protocol

## Current implementation status

Phase 1A implements the Codex-facing CLI operation envelope, not the Godot runtime transport described later in this document. Every `mam ... --json` command returns:

```json
{
  "protocolVersion": 1,
  "command": "movement.validate",
  "status": "passed",
  "correlationId": "generated-uuid",
  "input": { "file": "examples/movement/default.json" },
  "data": {},
  "errors": [],
  "warnings": [],
  "changedFiles": [],
  "snapshotId": null
}
```

CLI status is limited to `passed`, `failed`, `dry_run`, and `rolled_back`. Normal errors use project-owned codes, return a non-zero exit code, and do not require terminal-text parsing. Repository-relative paths are used when available.

The `mam.runtime/v1` Godot protocol below remains a Phase 1B design contract and has no implementation in Phase 1A.

## Purpose

The runtime protocol is the versioned JSON boundary between engine/application services and the Godot runtime adapter. Transport is intentionally undecided; implementations may use process standard streams or files, but must exchange complete JSON messages and must never depend on parsing terminal prose.

Protocol version `mam.runtime/v1` below is a design contract for Phase 1B. Examples are illustrative, not evidence of a running runtime.

## Request envelope

Each request contains:

- `schemaVersion`: protocol identifier, initially `mam.runtime/v1`.
- `commandId`: stable command such as `runtime.fixture.run` or `runtime.fixture.shutdown`.
- `fixtureId`: registered fixture such as `movement/basic-ground`.
- `correlationId`: caller-generated unique identifier echoed in all responses.
- `requestedAt`: optional ISO 8601 diagnostic timestamp; never used for simulation behavior.
- `timeoutMs`: positive execution deadline enforced by the caller.
- `payload`: command-specific validated data, including definition and scenario references or values.

```json
{
  "schemaVersion": "mam.runtime/v1",
  "commandId": "runtime.fixture.run",
  "fixtureId": "movement/basic-ground",
  "correlationId": "run-01JEXAMPLE",
  "requestedAt": "2026-07-12T08:00:00Z",
  "timeoutMs": 10000,
  "payload": {
    "definitionSchemaVersion": "mam.movement/v1",
    "profileId": "movement/default",
    "fixedDeltaSeconds": 0.0166666667,
    "scenarioId": "accelerate-forward"
  }
}
```

## Response envelope

Each response contains:

- the echoed `schemaVersion`, `commandId`, `fixtureId`, and `correlationId`
- `status`: `ready`, `ok`, `rejected`, `failed`, `timed_out`, or `shutting_down`
- `metrics`: typed command-specific measurements, or an empty object
- `warnings`: stable coded non-fatal findings
- `validationErrors`: rejected input findings
- `runtimeErrors`: launch or execution failures
- `changedFiles`: repository-relative paths changed by the runtime; normally empty because fixtures must not persist canonical data
- `evidence`: optional structured samples, report references, and runtime version details

```json
{
  "schemaVersion": "mam.runtime/v1",
  "commandId": "runtime.fixture.run",
  "fixtureId": "movement/basic-ground",
  "correlationId": "run-01JEXAMPLE",
  "status": "ok",
  "metrics": {
    "maximumGroundSpeedMetersPerSecond": 6.0,
    "timeToMaximumSpeedSeconds": 0.75,
    "stoppingDistanceMeters": 1.42
  },
  "warnings": [],
  "validationErrors": [],
  "runtimeErrors": [],
  "changedFiles": [],
  "evidence": {
    "godotVersion": "4.x",
    "physicsSteps": 180
  }
}
```

## Errors

Errors use an object with `code`, `message`, and optional `path` and `details`. Messages may improve without breaking clients; codes and field meanings follow protocol compatibility rules.

```json
{
  "schemaVersion": "mam.runtime/v1",
  "commandId": "runtime.fixture.run",
  "fixtureId": "movement/basic-ground",
  "correlationId": "run-01JEXAMPLE",
  "status": "rejected",
  "metrics": {},
  "warnings": [],
  "validationErrors": [
    {
      "code": "MOVEMENT_DODGE_WINDOW_OUT_OF_RANGE",
      "message": "Invulnerability must end no later than dodge duration.",
      "path": "/dodge/invulnerabilityEndSeconds"
    }
  ],
  "runtimeErrors": [],
  "changedFiles": []
}
```

Initial cross-domain codes include `PROTOCOL_VERSION_UNSUPPORTED`, `COMMAND_UNKNOWN`, `FIXTURE_UNKNOWN`, `REQUEST_INVALID`, `RUNTIME_START_FAILED`, `RUNTIME_NOT_READY`, `RUNTIME_TIMEOUT`, `RUNTIME_EXECUTION_FAILED`, `RUNTIME_SHUTDOWN_FAILED`, and `UNEXPECTED_FILE_CHANGE`. Domain validators add stable domain-prefixed codes.

## Lifecycle

1. The engine starts Godot with a registered fixture and protocol version.
2. Godot emits exactly one structured readiness response with status `ready`, fixture identity, correlation data for the launch request, and runtime version evidence.
3. If readiness is not received before the startup deadline, the caller records `RUNTIME_NOT_READY` or `RUNTIME_TIMEOUT`, terminates the owned process, and preserves available diagnostics.
4. The caller sends only schema-valid commands. The runtime still validates compatibility and rejects malformed or unsupported messages.
5. The caller requests `runtime.fixture.shutdown`. Godot stops accepting work, emits `shutting_down`, flushes the final report, and exits.
6. If controlled shutdown exceeds its deadline, the caller may terminate only the process it launched and reports `RUNTIME_SHUTDOWN_FAILED`.

Timeout is never reported as success. Late responses retain their correlation ID and cannot satisfy another request. Fixture launch and shutdown must not alter canonical definitions; any unexpected changed file makes the operation fail its safety audit.

## Compatibility

Consumers reject unsupported major protocol versions with `PROTOCOL_VERSION_UNSUPPORTED`. Additive optional fields may be introduced within a major version. Removing fields, changing meanings or units, or altering required status/error behavior requires a new major schema version and compatibility tests.
