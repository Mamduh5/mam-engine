# CLI adapter

This directory will contain the `mam` executable and terminal adapter. It will parse commands, call engine/application services, map stable results to exit codes, and emit versioned JSON without embedding domain rules.

The CLI may format optional human diagnostics on standard error, but scripts must never need to parse terminal prose. It must not access Godot fixture internals, edit definitions without validation, or implement movement behavior itself. No CLI implementation is included in Phase 0.
