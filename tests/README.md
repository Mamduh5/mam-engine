# Automated tests

Phase 1A.1 uses Node's built-in `node:test` runner. The suite covers:

- movement schema acceptance, malformed JSON, required fields, unknown fields, and version rejection
- semantic speed, acceleration, stamina, dodge, and invulnerability rules
- deterministic acceleration, stopping, sprint, and dodge simulations
- derived inspection metrics and zero-write inspection auditing
- valid, invalid, dry-run, snapshot-producing, scope-limited, and transactionally recovered set operations
- injected atomic-write, read, validation, audit, recovery, and pre-rollback snapshot failures
- reversible rollback, both snapshot identities, exact recovery, source immutability, and unrelated-file preservation
- same-target serialization, lock release after success/failure, and unlocked inspection
- parseable recovery/rollback CLI JSON, exit codes, stable argument errors, and absence of normal-error stack traces

Tests use isolated temporary workspaces and clean them up automatically. They do not write snapshots into the repository. Run `npm test`, or run type checking plus tests with `npm run check`. GitHub Actions runs the same check suite across Ubuntu Node 20/22 and Windows Node 22.

Godot headless integration and runtime-fixture smoke tests remain planned for Phase 1B.
