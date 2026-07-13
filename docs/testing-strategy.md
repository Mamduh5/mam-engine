# Testing strategy

Automated evidence is part of each editor/engine feature, not a final polish step. Tests should use stable structured results and measurable values, avoid reliance on terminal prose, and identify environment limitations separately from product failures.

Fast engine-independent layers use Node's built-in test runner and isolated temporary workspaces for writes. Movement Phase 1B and Camera Phase 2A.2 share a separate Godot-dependent integration tier while normal checks remain runtime-independent.

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

Launch the real process-per-run Godot adapter, validate readiness and clean exit, execute the controlled fixture categories recorded in the v0.1 capability manifest, and compare runtime metrics with named tolerances. This includes movement/camera/targeting behavior and the later scoped action, combat, weapon, large-enemy, and encounter proofs. These tests require compatible Godot 4.7 stable and run in separate slower integration jobs.

The 0.2 production-consumer tier additionally packs npm, installs through the generated `.bin/mam`, creates a separate project with spaces in its path, installs/syncs twice, removes the npm prefix, and runs a consumer-owned Godot scene. It proves movement state and loader/binding failures without fixture scenes or runtime transport.

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

GitHub Actions runs `npm ci` and `npm run check` for Ubuntu Node 20, Ubuntu Node 22, and Windows Node 22. Ubuntu Node 20 also runs `npm pack --dry-run`. A separate Ubuntu/Node 22 job downloads the exact official `4.7-stable` standard binary, verifies its GitHub release SHA-256 digest, and runs the real integration tier. The workflow uses immutable action SHAs, read-only contents permission, no deployment, and no secrets.

### Regression tests

Every fixed defect receives the smallest test at the owning layer. Cross-layer regressions are added only when the failure escaped an existing boundary test.

## Runtime-independent versus Godot-required

Schema, validator, service, CLI, deterministic simulation, changed-file, snapshot, and rollback tests run without Godot through `npm test`. `npm run test:camera-runtime` and `npm run test:targeting-runtime` run focused runtime tests. Type checking plus the full Node suite runs through `npm run check`. Godot integration runs through `npm run test:godot`, with focused camera and targeting scripts available. Local absence is reported as skipped; pinned CI must pass rather than skip.

Targeting Phase 2B.2 adds plan/protocol/simulation/comparison/application Node coverage and real Godot acquisition, eligibility/LOS, tie, retention/loss/reacquisition, switching/cooldown, camera-framing, lens, lifecycle, cleanup, and file-safety coverage.

If Godot is unavailable, the fast suite can pass while Godot-required checks are reported as not run because of the environment. They must not be claimed as passing or silently omitted.

## Visual inspection

Runtime visual inspection is supplementary. It can reveal camera feel, animation artifacts, presentation problems, or unexpected interactions, but it cannot replace assertions for speeds, distances, timing, stamina, protocol state, file safety, or deterministic behavior.
