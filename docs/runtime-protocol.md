# Runtime protocol

## Current implementation status

Canonical Phases 0–10 implement the Codex-facing CLI operation envelope and shared process-per-run Godot runtime transport across the registered controlled fixture categories. Every `mam ... --json` command returns:

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

Phase 1A.1 extends failed persistence data backward-compatibly:

```json
{
  "failureStage": "post_write_validation",
  "recovery": {
    "attempted": true,
    "status": "restored",
    "restoredFile": "examples/movement/default.json",
    "contentHashVerified": true,
    "validationPassed": true,
    "scopeAuditPassed": true
  }
}
```

Recovery status is `not_required`, `restored`, or `failed`. The requested operation remains top-level `failed` after successful recovery, so exit status remains non-zero. Successful rollback data includes `sourceSnapshotId` and `preRollbackSnapshotId`; top-level `snapshotId` is the pre-rollback safety snapshot.

The `mam.runtime/v1` Godot protocol is implemented using atomic files under an isolated runtime session directory. It dispatches validated fixture IDs `movement/basic-ground`, `camera/basic-third-person`, and `targeting/basic-lock-on`; unknown fixtures remain rejected.

Production consumers use a separate transport-free contract. `mam godot consumer sync` writes `mam.godot-runtime-bundle/v1`, whose integrity-protected payload contains the validated movement profile and exact source-byte SHA-256. The loader returns `{status,data,diagnostics}` and the movement API uses explicit `bind`, `physics_step`, and `unbind`.

## Purpose

The runtime protocol is the versioned JSON boundary between engine/application services and the Godot runtime adapter. Transport is process-per-run with complete request, readiness, and response JSON files. Standard streams are bounded diagnostic evidence and are never parsed as protocol.

Protocol version `mam.runtime/v1` below is the implemented movement/camera process contract. Examples illustrate the live contract; real integration tests provide execution evidence.

Camera requests include `definitionKind: "camera-profile"`, `definitionSchemaVersion: 1`, the complete normalized profile, and a scenario containing one of `orbit`, `pitch-clamp`, `recenter`, `follow`, `collision`, or `basis`. Unsupported kinds, schema versions, profiles, scenarios, commands, fixtures, correlations, invalid fixed deltas, and non-finite values are rejected before execution. Runtime responses retain the same envelope and include typed camera metrics plus lens readback; terminal prose is never parsed.

The additive targeting discriminant carries a complete normalized targeting profile as `profile`, a complete normalized camera profile as `cameraProfile`, and a validated scenario plan. It carries no source paths or expected outcomes. Candidates and events remain ephemeral; Godot owns real ray-query LOS and returns structured targeting/framing metrics.

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
    "definitionSchemaVersion": 1,
    "profile": {},
    "scenario": {
      "id": "accelerate",
      "durationSeconds": 3,
      "fixedDeltaSeconds": 0.016666666666666666,
      "cameraYawDegrees": 0
    }
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
    "finalSpeed": 5.5,
    "maximumObservedSpeed": 5.5,
    "timeToNinetyFivePercentSeconds": 0.3,
    "totalDistance": 15.705,
    "physicsSteps": 180
  },
  "warnings": [],
  "validationErrors": [],
  "runtimeErrors": [],
  "changedFiles": [],
  "evidence": {
    "godotVersion": "4.7.stable.official",
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
5. Godot writes exactly one final response and exits cleanly. The TypeScript owner terminates only its child process when a bounded deadline expires.

Persistent interactive sessions and `runtime.fixture.shutdown` are reserved for a later phase.

Timeout is never reported as success. Late responses retain their correlation ID and cannot satisfy another request. Fixture launch and shutdown must not alter canonical definitions; any unexpected changed file makes the operation fail its safety audit.

## Compatibility

Consumers reject unsupported major protocol versions with `PROTOCOL_VERSION_UNSUPPORTED`. Additive optional fields may be introduced within a major version. Removing fields, changing meanings or units, or altering required status/error behavior requires a new major schema version and compatibility tests.
