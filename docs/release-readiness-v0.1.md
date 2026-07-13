# v0.3 release readiness

## 0.3 production camera addition

`mam-engine` 0.3.0 completes ENGINE-GAP-001B. Initialized projects may create and register an optional canonical camera profile; consumer sync preserves the required movement bundle and adds a separate deterministic camera bundle when configured. The scene-free managed addon now includes fail-closed camera loading and a reusable runtime for game-owned camera nodes, explicit input, orbit/follow/recenter/collision/lens behavior, and movement-basis output.

The 0.2.0 movement consumer contract remains supported. Production targeting, lock-on/combat cameras, full-hunt game integration, presentation, assets, progression, multiplayer, and live editing remain unsupported.

## Release scope

`mam-engine` 0.3.0 retains the canonical Phases 0–10 definition, simulation, persistence, controlled-fixture, and local-editor scope while adding the production camera consumer boundary. The CLI remains the authoritative automation interface; the visual editor calls the same application and domain services.

## Supported installed workflows

The installed package supports CLI help, greenfield project initialization and validation, `movement create`, optional `camera create`, definition inspection/validation/simulation/editing, snapshots and rollback, packaged examples, runtime commands and assets, and local editor discovery and inspection. `mam godot consumer install` safely manages the scene-free addon; sync/check covers every configured deterministic bundle. The installed addon and generated bundles have no runtime dependency on Node or npm, and packed-consumer evidence runs after the npm installation is removed. The visual editor's complete authoring workflow remains limited to `movement-profile`; other registered definitions are read-only there.

## Validation evidence

- `npm run build`
- focused project, consumer synchronization, camera runtime, capability-manifest, and packed-install tests
- `npm pack --dry-run` package-content inspection
- installed CLI, managed-addon, dual-bundle, consumer-owned movement/camera binding, and runtime-independence checks from a temporary installation

## Known limitations and risks

The public camera runtime is production consumer infrastructure, not completed game integration. Targeting and combat evidence still comes from controlled fixtures. Production gameplay, asset authoring, progression, multiplayer, live runtime editing, and additional visual-editor authoring kinds are unsupported. Broad platform regression and full Godot verification remain CI-owned release risks.

## Release decision

`ready-with-documented-limitations`
