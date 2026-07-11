# CLI adapter

The executable CLI is implemented under [`src/cli/`](../src/cli/). `package.json` exposes `dist/src/cli/main.js` as `mam`, including a Node shebang for installed use on Windows and other supported Node platforms.

The local parser supports movement inspection, validation, simulation, transactional set operations, snapshot creation/listing, and reversible rollback without a CLI-framework dependency. Every command accepts `--json`; machine-readable output uses protocol version 1 and normal user errors return stable codes without stack traces.

Failed persistent commands remain top-level `failed` even when recovery restores the original target. Their JSON data identifies `failureStage` and typed recovery evidence. Rollback JSON returns both the selected `sourceSnapshotId` and newly created `preRollbackSnapshotId`; top-level `snapshotId` means the pre-rollback safety snapshot.

The CLI parses and presents operations only. Movement rules live in the domain layer, orchestration and transaction recovery in application services, and filesystem/schema behavior in infrastructure. Godot launch commands are not implemented in Phase 1A.1.
