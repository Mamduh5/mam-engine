# CLI adapter

The executable CLI is implemented under [`src/cli/`](../src/cli/). `package.json` exposes `dist/src/cli/main.js` as `mam`, including a Node shebang for installed use on Windows and other supported Node platforms.

The local parser supports movement inspection, validation, simulation, safe set operations, snapshot creation/listing, and rollback without a CLI-framework dependency. Every command accepts `--json`; machine-readable output uses protocol version 1 and normal user errors return stable codes without stack traces.

The CLI parses and presents operations only. Movement rules live in the domain layer, orchestration in application services, and filesystem/schema behavior in infrastructure. Godot launch commands are not implemented in Phase 1A.
