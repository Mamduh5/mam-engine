# Godot consumer movement and camera runtime v0.3

## Scope

`mam-engine` 0.3.0 ships a scene-free Godot 4.7 addon for grounded movement and reusable third-person camera control. The game owns every scene and node. The addon consumes deterministic generated bundles and does not require Node, npm, the engine checkout, fixtures, or process transport after export.

The project manifest keeps the required `entryMovementFile` and adds optional `entryCameraFile`. `mam camera create camera/player.json` creates a complete validated camera-profile from the canonical prototype values and registers it without overwriting an existing file. Legacy and movement-only manifests may omit the camera entry. A configured camera path must remain inside `definitionRoot` and resolve to a valid `camera-profile`; there is no hidden example fallback.

## Install and synchronization

```text
mam godot consumer install [--project <directory>] [--json]
mam godot consumer sync [--project <directory>] [--check] [--json]
```

Install owns only `addons/mam_engine/`. Its `mam-managed-files.json` records package/contract versions and every installed file's SHA-256. Repeated installation is a no-op. Upgrades replace or remove only previously managed files and fail before writes on local drift or an unowned conflict. No fixture scene, controlled wall, mock target, dispatcher, or process transport is installed.

Movement synchronization remains required and preserves `mam_generated/mam_runtime_bundle.json` and `mam.godot-runtime-bundle/v1`. When `entryCameraFile` is configured, the same operation also writes `mam_generated/mam_camera_runtime_bundle.json` using `mam.godot-camera-runtime-bundle/v1` and `mam.godot-camera-adapter/v1`. Each deterministic payload contains the package and adapter contract versions, canonical kind/schema, project-relative source path, SHA-256 of the exact source bytes, and normalized validated profile; the envelope includes a payload SHA-256. Stable key ordering, two-space indentation, and one trailing newline are used, with no timestamps, absolute paths, or machine values.

Sync validates every configured source before writing any bundle. A failure preserves prior valid generated files. `--check` performs no writes and requires the managed addon and every configured bundle to be present and exact.

## Bundle loaders

`MamRuntimeBundleLoader.load_bundle()` loads movement. `MamCameraBundleLoader.load_bundle("res://mam_generated/mam_camera_runtime_bundle.json")` loads camera. Both return `{status: "passed" | "failed", data: {}, diagnostics: []}` and never return a partially usable profile.

The camera loader fails closed for missing or unreadable files, malformed JSON, unsupported bundle or adapter contracts, payload-integrity mismatch, wrong kind/schema, missing required data or canonical source, source-byte hash drift, and an incomplete normalized profile. Canonical semantic validation remains TypeScript-owned at sync time; Godot validates the transport and runtime boundary without substituting defaults.

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

## Evidence and limitations

Focused Node tests cover legacy manifests, camera creation, invalid entries, deterministic dual-bundle sync/check, preservation on failure, and managed-addon upgrades. Godot and packed-consumer evidence exercises the installed public loader/runtime with consumer-owned nodes after npm is unavailable. The controlled camera fixture uses the production camera core; fixture scenes are not public addon content.

This contract does not provide targeting, lock-on framing, combat or cinematic cameras, camera zones, shake, cutscenes, photo mode, input maps, game UI, animation, or game-scene integration. Production targeting remains ENGINE-GAP-001C, and integration into `3d-combat-game` remains game-owned follow-up work.
