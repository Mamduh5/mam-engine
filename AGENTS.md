# mam-engine Codex instructions

## Product priority

mam-engine is primarily an editor and engine for Codex and other coding agents building games.

Prioritize machine-readable CLI operations, structured definitions, deterministic inspection, simulation, modification, and runtime evidence.

A human graphical editor is secondary unless the task explicitly requests it.

## Cost-first operating mode

Default to ECONOMY mode.

Spend most effort on implementation, not repeated validation, documentation, or reporting.

Do not reread the entire repository, roadmap, architecture, or phase history when the relevant files are already identifiable.

Inspect only files directly connected to the requested behavior or observed failure.

Do not restate the complete task before working.

## Task size

Work on one narrowly defined implementation goal at a time.

Do not expand the task into adjacent cleanup, refactoring, documentation, or additional features unless required for correctness.

Do not create speculative abstractions for future phases.

## Validation budget

During normal implementation, the default local validation budget is:

1. build or typecheck when relevant;
2. one directly affected test command;
3. `git diff --check`.

Do not run complete Node and Godot suites locally unless the user explicitly requests RELEASE validation.

CI is the authoritative broad regression gate.

Never rerun a passing command unless relevant code changed afterward.

When a test fails:

* inspect only the failing test and its direct evidence;
* do not read complete logs when a focused error section is available;
* do not rerun the same unchanged command;
* run no more than two focused verification attempts without reporting the blocker;
* do not switch to a broad suite to diagnose a narrow failure.

For Godot failures, inspect at most the directly relevant retained runtime sessions.

## Output budget

Keep progress updates minimal.

Successful command output should be summarized as:

```text
command — passed, N/N
```

Do not paste complete passing logs.

Final reports must contain only:

* status;
* changed files;
* implemented behavior;
* validation performed;
* unresolved issue or next step.

Keep final reports under 200 words unless the user requests detail.

## Documentation

Do not update multiple documentation files during normal implementation.

Update documentation only when:

* a public contract changed;
* a milestone status changed;
* existing documentation would become materially false.

Phase specifications belong in dedicated documents and must not be copied into prompts or this file.

## Git safety

Do not reset, discard, stash, overwrite, or incorporate unexpected work.

Do not force-push, rebase shared history, amend published commits, bypass hooks, or deploy unless explicitly instructed.

Never stage runtime sessions, `.godot` caches, logs, executables, archives, or temporary artifacts.

## Completion modes

ECONOMY mode is the default:

```text
implement → focused check → status review → report
```

RELEASE mode is used only when explicitly requested:

```text
focused checks → complete local gates → commit → push → CI
```

Do not silently upgrade an ECONOMY task into RELEASE mode.
