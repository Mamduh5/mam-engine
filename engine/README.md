# Engine and application services

Phase 1A.1 engine code lives under [`src/application/`](../src/application/) and [`src/domain/`](../src/domain/). Application services implement inspect, validate, simulate, transactional set, snapshot, list, reversible rollback, and same-target locking. The movement domain owns profile types, semantic validation, derived metrics, and deterministic fixed-timestep simulation.

The narrow shared helper [`transactionalFileReplace.ts`](../src/application/persistence/transactionalFileReplace.ts) writes, verifies, audits, and restores exact prior content on failure. [`targetOperationLock.ts`](../src/application/persistence/targetOperationLock.ts) serializes persistent operations for one repository-relative target and releases locks in `finally`; different targets and read-only services are independent.

Infrastructure under [`src/infrastructure/`](../src/infrastructure/) supplies Ajv schema validation, safe JSON I/O, workspace state capture, changed-file audits, and snapshot storage. Domain services do not depend on terminal output, a GUI, Godot, fixture scenes, or source-patching heuristics.

Phase 1B runtime orchestration lives under [`src/application/runtime/`](../src/application/runtime/) with protocol/comparison rules under `src/domain/runtime/` and Godot discovery, process, and session adapters under `src/infrastructure/runtime/`. The process-per-run adapter never persists movement changes.
