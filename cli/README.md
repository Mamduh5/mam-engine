# CLI adapter

The executable CLI is implemented under [`src/cli/`](../src/cli/). `package.json` exposes `dist/src/cli/main.js` as `mam`, including a Node shebang for installed use on Windows and other supported Node platforms.

The local parser supports movement inspection, validation, simulation, transactional set operations, snapshot creation/listing, and reversible rollback without a CLI-framework dependency. Every command accepts `--json`; machine-readable output uses protocol version 1 and normal user errors return stable codes without stack traces.

Failed persistent commands remain top-level `failed` even when recovery restores the original target. Their JSON data identifies `failureStage` and typed recovery evidence. Rollback JSON returns both the selected `sourceSnapshotId` and newly created `preRollbackSnapshotId`; top-level `snapshotId` means the pre-rollback safety snapshot.

The parser also supports `runtime check`, `movement runtime-test`, and `camera runtime-test`. Camera runtime tests accept the six Phase 2A scenarios plus optional duration, fixed delta, Godot path, and session retention. Runtime commands discover Godot from `--godot`, `MAM_GODOT_BIN`, or `PATH`; launch without a shell; and return structured discovery, measurement, comparison, and retained-session evidence. The CLI remains presentation only: movement/camera runtime rules live in domain and application layers, while process, filesystem, session, and discovery behavior remain infrastructure concerns.
