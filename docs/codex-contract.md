# Codex contract

This contract governs automated-agent work in `mam-engine`. A task must identify whether Codex is developing engine capability or authoring a game through existing capability.

## Operating modes

### Engine-development mode

Codex may modify engine-owned infrastructure only when the task explicitly requests a new engine feature or a fix to existing engine behavior. It must keep the change within the requested vertical slice, update contracts and tests, and report any authored-definition migration.

### Game-authoring mode

Codex modifies validated game definitions and fixture configuration through supported services or formats. It must not change engine-owned runtime code merely to make authored data pass. If the engine lacks a requested capability, Codex returns a structured unsupported-capability result and proposes a separate engine-development task.

## Ownership

Codex-authored game content includes:

- project manifests
- movement profiles
- action definitions
- weapon definitions
- enemy definitions
- encounter definitions
- fixture configuration

Only movement profiles and movement fixture configuration are planned for the next milestone; the other categories reserve long-term boundaries and are not implemented.

Engine-owned infrastructure includes:

- validators
- command dispatch
- schema loaders
- runtime adapters
- simulation logic
- report protocol
- snapshot implementation
- safety audits

Ownership is about permitted change paths, not who typed a file. Game-authoring mode cannot modify engine-owned infrastructure.

## Mandatory behavior

For every operation Codex must:

1. Inspect current definitions, repository state, ownership, and allowed paths before changing anything.
2. Validate a complete candidate before running or persisting it.
3. Return structured results with stable status and error codes.
4. Report exact changed files, including partial changes after failure.
5. Reject invalid definitions without silently coercing unsafe values.
6. Never hide partial failure, timeout, missing tools, or unverified claims.
7. Never modify unrelated files or paths outside the operation's allowlist.
8. Snapshot affected existing files before a destructive or overwrite operation.
9. Support an inspectable, validated rollback operation.
10. Never report success without evidence appropriate to the claim.

Read-only inspection, validation, and simulation should not change repository files. A temporary draft is not a persistent save and must be reported as such. Every persistent command should expose a planned file set before applying it, compare actual changes afterward, and fail with a safety error if unexpected paths changed.

## Result expectations

Results must identify the command, schema version, correlation ID, status, validation findings, warnings, evidence, and changed files. A process exit code is useful but is not a substitute for the structured result. Human-facing text may summarize the result but cannot be its only representation.
