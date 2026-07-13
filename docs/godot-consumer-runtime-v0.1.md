# Godot consumer movement runtime v0.1

## Scope

`mam-engine` 0.2.0 ships the first production consumer slice: a scene-free Godot 4.7 movement addon, deterministic generated bundle, and public install/sync commands. It covers grounded walk/run/sprint, camera-relative steering, stamina, and dodge movement. Production camera control, targeting, combat, animation, HUD, models, audio, and VFX are outside this contract.

## Public workflow

```text
mam godot consumer install [--project <directory>] [--json]
mam godot consumer sync [--project <directory>] [--check] [--json]
```

Install owns only `addons/mam_engine/`. Its `mam-managed-files.json` records package/contract versions and every installed file's SHA-256. Repeated installation is a no-op. Upgrades replace or remove only files previously owned by the manifest and stop before writes on local drift or an unowned conflict.

Sync canonically validates the initialized project and entry movement profile, then atomically writes `mam_generated/mam_runtime_bundle.json`. `--check` performs no writes and requires the addon and exact expected bundle to be current. `mam.godot-runtime-bundle/v1` contains an integrity-protected deterministic payload with package/adapter versions, normalized profile, normalized source path, and SHA-256 of the exact source bytes. JSON uses stable key ordering, two-space indentation, and one trailing newline; timestamps and machine paths are excluded.

## Godot API

`MamRuntimeBundleLoader.load_bundle()` returns `{status, data, diagnostics}`. It fails closed on missing/malformed/unsupported bundles, integrity mismatch, wrong kind/schema, incomplete fields, missing canonical source, and source hash drift.

`MamMovementRuntime` exposes `bind(game_owned_character_body, loaded_profile)`, `physics_step(delta, input, camera_basis)`, and `unbind()`. Input explicitly supplies `movement`, `walk`, `sprintHeld`, and `dodgePressed`; camera basis explicitly supplies horizontal `forward` and `right`. The game owns its node, collision, scene, input mapping, camera, and callback. The runtime owns bound-body horizontal movement and `move_and_slide` and returns structured movement/stamina/dodge state.

## Evidence

Node tests cover invalid projects, idempotence, drift/conflicts, deterministic output, check failures, write recovery, and preservation of prior bundles. Real Godot tests share one movement core between the controlled fixture and production adapter. A separate npm-pack consumer with spaces in its path installs through `.bin/mam`, syncs twice, deletes its npm prefix, and proves movement, binding, loader failures, stale-source rejection, and clean exit without engine fixture scenes.
