# Engine and application services

Phase 1A engine code lives under [`src/application/`](../src/application/) and [`src/domain/`](../src/domain/). Application services implement inspect, validate, simulate, set, snapshot, list, and rollback use cases. The movement domain owns profile types, semantic validation, derived metrics, and deterministic fixed-timestep simulation.

Infrastructure under [`src/infrastructure/`](../src/infrastructure/) supplies Ajv schema validation, safe JSON I/O, workspace state capture, changed-file audits, and snapshot storage. Domain services do not depend on terminal output, a GUI, Godot, fixture scenes, or source-patching heuristics.

Godot runtime orchestration remains a Phase 1B service boundary and is not present in this implementation.
