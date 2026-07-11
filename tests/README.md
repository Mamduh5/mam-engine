# Automated tests

Phase 1A uses Node's built-in `node:test` runner. The suite covers:

- movement schema acceptance, malformed JSON, required fields, unknown fields, and version rejection
- semantic speed, acceleration, stamina, dodge, and invulnerability rules
- deterministic acceleration, stopping, sprint, and dodge simulations
- derived inspection metrics and zero-write inspection auditing
- valid, invalid, dry-run, snapshot-producing, and scope-limited set operations
- exact rollback, unknown snapshots, and unrelated-file preservation
- parseable CLI JSON, exit codes, stable argument errors, and absence of normal-error stack traces

Tests use isolated temporary workspaces and clean them up automatically. They do not write snapshots into the repository. Run `npm test`, or run type checking plus tests with `npm run check`.

Godot headless integration and runtime-fixture smoke tests remain planned for Phase 1B.
