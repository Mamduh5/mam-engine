# v0.4 release readiness

## 0.4 production targeting addition

`mam-engine` 0.4.0 completes ENGINE-GAP-001C. Initialized projects may create and register an optional canonical targeting profile. Consumer sync preserves movement and camera contracts and adds a separate deterministic targeting bundle when configured. The scene-free managed addon includes fail-closed targeting loading and a reusable runtime for explicit game-owned candidates, visibility, camera basis, and lock/switch requests.

The 0.2.0 movement and 0.3.0 camera consumer contracts remain supported. The targeting runtime owns canonical acquisition, scoring, stable ties, retention, grace, loss/reacquisition, directional switching, cooldown, and structured state without owning game nodes or physics queries.

## Release scope

`mam-engine` 0.4.0 retains canonical Phases 0-10 definition, simulation, persistence, controlled-fixture, and local-editor scope while adding the production targeting consumer boundary. The CLI remains the authoritative automation interface.

## Supported installed workflows

The installed package supports greenfield project initialization and validation, movement/camera/targeting creation, definition operations, snapshots, runtime assets, and local editor inspection. `mam godot consumer install` safely manages the scene-free addon; sync/check covers every configured deterministic bundle. Installed runtimes and generated bundles have no dependency on Node or npm after synchronization. Visual authoring remains limited to `movement-profile`.

## Validation evidence

- focused build and project/consumer tests
- controlled targeting runtime comparison through the production core
- packed external-consumer targeting loader/runtime proof after npm removal
- package-content and deterministic package-candidate inspection

## Known limitations and risks

The public targeting runtime is production infrastructure, not completed game integration. It does not provide target discovery, enemy AI, combat, damage, lock-on camera framing, input actions, HUD, animation, assets, progression, multiplayer, or live editing. GAME-004 and the first combat loop remain deferred. Broad Node and Godot regression suites remain user/CI-owned release gates.

## Release decision

`ready-with-documented-limitations`
