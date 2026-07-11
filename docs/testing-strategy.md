# Testing strategy

Automated evidence is part of each editor/engine feature, not a final polish step. Tests should use stable structured results and measurable values, avoid reliance on terminal prose, and identify environment limitations separately from product failures.

## Test layers

### Schema tests

Verify required fields, types, bounds, unknown-field policy, version handling, units, and representative valid/invalid definitions. These tests must be fast and require no Godot installation.

### Validator unit tests

Verify semantic and cross-field rules, stable error codes, precise paths, and aggregation behavior. They must be deterministic, fast, and runtime-independent.

### CLI command tests

Verify parsing, service dispatch, JSON output, exit-code mapping, read-only behavior, failure transparency, and exact changed-file reporting. Most use in-memory or temporary adapters and remain fast.

### Deterministic simulation tests

Use fixed timesteps and explicit inputs to assert ordered samples and metrics. Movement coverage includes acceleration, maximum speed, stopping, turning, sprint stamina, and dodge timing. These tests must be fast and must not require Godot.

### Godot headless integration tests

Launch the real Godot adapter, perform readiness and shutdown handshakes, execute named fixtures, and compare runtime metrics with expected tolerances. These tests require a supported Godot 4 executable and may run in a slower integration job.

### Runtime fixture smoke tests

Prove each registered fixture loads, consumes the expected definition version, emits a report, changes no forbidden files, and exits cleanly. They require Godot and should remain narrow.

### Protocol compatibility tests

Validate request and response envelopes, correlation, required statuses, stable error objects, unsupported-version rejection, timeout handling, and additive-field tolerance. Codec-level tests are fast; end-to-end protocol tests may require Godot.

### Changed-file safety tests

Start from a known file snapshot, run read-only and mutating operations, and compare actual paths to the declared allowlist. Inject unexpected changes and assert failure with `UNEXPECTED_FILE_CHANGE`. These tests must be fast and use isolated temporary repositories or filesystems.

### Snapshot and rollback tests

Verify snapshot manifests, content integrity, overwrite-before-snapshot ordering, rollback previews, path containment, partial failure reports, restored content, and post-rollback audits. Most are fast; an optional integration test may exercise the CLI.

### Regression tests

Every fixed defect receives the smallest test at the owning layer. Cross-layer regressions are added only when the failure escaped an existing boundary test.

## Runtime-independent versus Godot-required

Schema, validator, service, most CLI, deterministic simulation, protocol codec, changed-file, snapshot, and rollback tests must run without Godot and should form the normal fast feedback suite. Godot headless integration and fixture smoke tests form a separate slower suite with explicit executable/version detection.

If Godot is unavailable, the fast suite can pass while Godot-required checks are reported as not run because of the environment. They must not be claimed as passing or silently omitted.

## Visual inspection

Runtime visual inspection is supplementary. It can reveal camera feel, animation artifacts, presentation problems, or unexpected interactions, but it cannot replace assertions for speeds, distances, timing, stamina, protocol state, file safety, or deterministic behavior.
