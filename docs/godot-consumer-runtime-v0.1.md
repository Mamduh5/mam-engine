# Godot consumer runtime v0.4

## Scope

`mam-engine` 0.4.0 ships a scene-free Godot 4.7 addon for grounded movement, reusable third-person camera control, and production targeting. The game owns every scene and node. The addon consumes deterministic generated bundles and does not require Node, npm, the engine checkout, fixtures, or process transport after export.

The project manifest keeps required `entryMovementFile` plus optional `entryCameraFile` and `entryTargetingFile`. `mam camera create camera/player.json` and `mam targeting create targeting/player.json` create complete validated profiles from canonical defaults and register them without overwrite. Legacy, movement-only, and movement-plus-camera manifests remain valid. Configured paths must remain inside `definitionRoot` and resolve to the matching kind; there is no example fallback.

## Install and synchronization

```text
mam godot consumer install [--project <directory>] [--json]
mam godot consumer sync [--project <directory>] [--check] [--json]
```

Install owns only `addons/mam_engine/`. Its `mam-managed-files.json` records package/contract versions and every installed file's SHA-256. Repeated installation is a no-op. Upgrades replace or remove only previously managed files and fail before writes on local drift or an unowned conflict. No fixture scene, controlled wall, mock target, dispatcher, or process transport is installed.

Movement synchronization remains required and preserves `mam_generated/mam_runtime_bundle.json` and its contract. Configured camera and targeting entries add `mam_camera_runtime_bundle.json` and `mam_targeting_runtime_bundle.json`; targeting uses `mam.godot-targeting-runtime-bundle/v1` and `mam.godot-targeting-adapter/v1`. Each deterministic payload contains package/adapter versions, canonical kind/schema, project-relative source path, SHA-256 of exact source bytes, and the normalized validated profile; the envelope includes a payload SHA-256. Stable key ordering, two-space indentation, one trailing newline, and no timestamps or machine paths are guaranteed.

Sync validates every configured source before writing any bundle. A failure preserves prior valid generated files. `--check` performs no writes and requires the managed addon and every configured bundle to be present and exact.

## Bundle loaders

`MamRuntimeBundleLoader.load_bundle()` loads movement, `MamCameraBundleLoader.load_bundle(...)` loads camera, and `MamTargetingBundleLoader.load_bundle("res://mam_generated/mam_targeting_runtime_bundle.json")` loads targeting. All return `{status: "passed" | "failed", data: {}, diagnostics: []}` and never return a partially usable profile.

Camera and targeting loaders fail closed for missing or unreadable files, malformed JSON, unsupported bundle or adapter contracts, payload-integrity mismatch, wrong kind/schema, incomplete fields/profile, missing canonical source, or source-byte hash drift. Canonical semantic validation remains TypeScript-owned at sync time; Godot validates the transport/runtime boundary without defaults.

## Movement API

`MamMovementRuntime` exposes `bind(game_owned_character_body, loaded_profile)`, `physics_step(delta, input, camera_basis)`, and `unbind()`. Input explicitly supplies `movement`, `walk`, `sprintHeld`, and `dodgePressed`; camera basis explicitly supplies horizontal `forward` and `right`. The game owns its node, collision, scene, input mapping, camera, and callback. The runtime owns bound-body horizontal movement and `move_and_slide` and returns structured movement/stamina/dodge state.

## Camera API

`MamCameraRuntime` exposes `bind(bindings, profile)`, `physics_step(delta, input)`, and `unbind()`. Bindings are explicit game-owned nodes:

```text
followTarget: Node3D
rigRoot: Node3D
yawPivot: Node3D
pitchPivot: Node3D
camera: Camera3D
collisionProbe: ShapeCast3D | null
```

The collision probe may be null only when profile collision is disabled. Binding rejects missing or wrong node types, duplicate binding, a rig owned by another runtime, and enabled collision without a probe. `unbind` releases ownership.

The runtime never reads `Input` or defines action names. Each physics step accepts `orbit: Vector2`, `movementWorldDirection: Vector3`, and `movementMagnitude: float`. Orbit X/Y drives authored yaw/pitch with inversion and pitch clamp. Manual orbit resets the recenter delay; qualifying movement drives delayed, bounded shortest-angle recentering.

The runtime applies authored follow distance/height, shoulder and look-at offsets, position half-life, collision compression and recovery, and Camera3D FOV/near/far lens values. Free orbit and recenter remain direct canonical operations; the authored rotation half-life is currently used by deferred targeting-framing behavior rather than this free-camera runtime. A game-owned `ShapeCast3D` supplies real collision data. The runtime configures its cast and probe radius without per-tick shape allocation, excludes the followed actor where supported, accounts for the probe radius, respects minimum distance, and smooths return after obstruction clears.

The game owns nodes, scene placement, input mapping, target selection, the controlled character, UI, and non-canonical presentation. The runtime owns rig follow position, yaw/pitch pivots, camera boom placement, collision distance, lens values, camera state, and published basis. It never moves the followed actor.

Structured state includes `yawDegrees`, `pitchDegrees`, `desiredDistance`, `actualDistance`, `collisionDetected`, `rigPosition`, `lookAtPosition`, `cameraForward`, `cameraRight`, `manualOrbitActive`, `recentering`, `accepted`, and `diagnostics`. Horizontal `cameraForward` and `cameraRight` are normalized, orthogonal, and can be passed directly to the movement runtime as its camera basis.

## Targeting API

`MamTargetingRuntime` exposes `bind(profile)`, `physics_step(delta, input)`, `clear_target()`, and `unbind()`. It reads no `Input`, nodes, groups, scene tree, physics layers, camera nodes, or global state. Each step receives `origin`, `cameraForward`, `cameraRight`, `cameraUp`, `candidates`, `lockRequested`, `unlockRequested`, and `switchDirection`; negative X switches left and positive X switches right.

Each candidate contains exactly stable `id`, `position`, `aimPosition`, `targetable`, caller-supplied `visible`, and normalized `priority`. Duplicate IDs and malformed values fail with structured diagnostics. The runtime copies candidate values and never mutates caller data. The game performs LOS queries and supplies `visible`; the addon never casts rays or discovers targetable nodes.

The runtime owns canonical acquisition filters/scoring, score/angle/distance/ordinal-ID ties, retention bounds, fixed-step grace and loss, optional deterministic reacquisition, explicit unlock, signed-horizontal switching, and cooldown. State includes mode/lock, target ID/position/aim point/distance/score, grace and cooldown remaining, acquisition/loss/switch flags, evaluations, acceptance, and diagnostics. HUD, movement coordination, later camera framing, and later combat may consume this state without giving the runtime ownership of game nodes.

## Evidence and limitations

Focused Node tests cover legacy manifests, profile creation, invalid entries, deterministic multi-bundle sync/check, preservation on failure, and managed-addon upgrades. Godot and packed-consumer evidence exercises installed public loaders/runtimes after npm is unavailable. Controlled movement, camera, and targeting fixtures use production cores; fixture scenes, targets, walls, and transport are not public addon content.

This contract does not provide target discovery, enemy AI, combat, damage, lock-on camera framing, camera zones, input maps, game UI, animation, networking, or game-scene integration. GAME-004 enemy and targeting integration remains game-owned follow-up work.
