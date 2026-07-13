# v0.1 release readiness

## Release scope

`mam-engine` v0.1 completes canonical Phases 0–10. It ships definition contracts, deterministic domain operations, transactional persistence, controlled Godot fixture proofs, and a loopback-only local editor. The CLI is the authoritative automation interface; the visual editor calls the same application and domain services.

## Supported installed workflows

The installed package supports CLI help, greenfield project initialization and validation, definition inspection/validation/simulation/editing, snapshots and rollback, packaged examples, runtime commands and assets, plus local editor discovery and inspection. The editor's complete authoring workflow is limited to `movement-profile`: validation preview, persisted-versus-candidate simulation, revision-protected save, and snapshot-backed undo. Other registered definitions are read-only in the editor.

## Validation evidence

- `npm run build`
- focused capability-manifest and packed-install smoke tests
- `npm pack --dry-run` package-content inspection
- installed CLI help, packaged movement inspect/simulate, and editor health/static/discovery/inspection/shutdown checks from a temporary installation

## Known limitations and risks

Godot proofs are controlled fixtures, not production gameplay. Production gameplay, asset authoring, progression, multiplayer, live runtime editing, and additional visual-editor authoring kinds are unsupported. Broad platform regression and Godot runtime verification remain CI-owned release risks.

## Release decision

`ready-with-documented-limitations`
