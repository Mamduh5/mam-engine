# Testing strategy

Automated evidence is part of each editor/engine feature, not a final polish step. Tests should use stable structured results and measurable values, avoid reliance on terminal prose, and identify environment limitations separately from product failures.

Phase 1A.1 implements the fast engine-independent layers with Node's built-in test runner. Tests compile from TypeScript and use isolated temporary workspaces for all write operations. Injected application dependencies deterministically force write, read, validation, audit, snapshot, and recovery failures without production CLI debug flags. Godot-dependent layers remain pending Phase 1B.

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

**Phase 1B.** Launch the real Godot adapter, perform readiness and shutdown handshakes, execute named fixtures, and compare runtime metrics with expected tolerances. These tests require a supported Godot 4 executable and may run in a slower integration job.

### Runtime fixture smoke tests

**Phase 1B.** Prove each registered fixture loads, consumes the expected definition version, emits a report, changes no forbidden files, and exits cleanly. They require Godot and should remain narrow.

### Protocol compatibility tests

Validate request and response envelopes, correlation, required statuses, stable error objects, unsupported-version rejection, timeout handling, and additive-field tolerance. Codec-level tests are fast; end-to-end protocol tests may require Godot.

### Changed-file safety tests

Start from a known file snapshot, run read-only and mutating operations, and compare actual paths to the declared allowlist. Inject unexpected changes and assert failure with `UNEXPECTED_FILE_CHANGE`. These tests must be fast and use isolated temporary repositories or filesystems.

### Snapshot and rollback tests

Verify snapshot manifests, content integrity, overwrite-before-snapshot ordering, reversible rollback, both snapshot identities, path containment, failure recovery, restored content, source immutability, and post-rollback audits.

### Transaction and locking tests

Force atomic write, post-write read, validation, scope audit, recovery write, recovery validation, and pre-rollback snapshot failures through explicit test seams. Assertions cover exact final bytes and retained snapshots. Concurrency tests prove same-target writes do not interleave, locks release after success/failure, and inspection remains available while a write is waiting.

### Remote CI

GitHub Actions runs `npm ci` and `npm run check` for Ubuntu Node 20, Ubuntu Node 22, and Windows Node 22. Ubuntu Node 20 also runs `npm pack --dry-run`. The workflow uses lockfile caching, read-only contents permission, and no deployment, secrets, or Godot installation.

### Regression tests

Every fixed defect receives the smallest test at the owning layer. Cross-layer regressions are added only when the failure escaped an existing boundary test.

## Runtime-independent versus Godot-required

Schema, validator, service, CLI, deterministic simulation, changed-file, snapshot, and rollback tests run without Godot through `npm test`. Type checking plus the full suite runs through `npm run check`. Godot protocol integration and fixture smoke tests will form a separate slower suite with explicit executable/version detection in Phase 1B.

If Godot is unavailable, the fast suite can pass while Godot-required checks are reported as not run because of the environment. They must not be claimed as passing or silently omitted.

## Visual inspection

Runtime visual inspection is supplementary. It can reveal camera feel, animation artifacts, presentation problems, or unexpected interactions, but it cannot replace assertions for speeds, distances, timing, stamina, protocol state, file safety, or deterministic behavior.
