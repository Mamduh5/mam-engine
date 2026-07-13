# Greenfield movement sandbox dogfood

This post-v0.1 slice closes GF-001 with one consumer-owned workflow:

```text
mam project init
mam movement create movement/player.json
mam project validate
mam project play
```

## Product contract

- `project init` creates only the project manifest, definition directories, `.gitignore`, and project README.
- `movement create` authors an internally defined, validated movement profile and sets the project entry without snapshots or overwrite.
- `project validate` checks the manifest, definition root, every supported definition and reference, and the entry movement profile without writing.
- `project play` validates first, consumes the packaged Godot runtime, opens a visible bounded sandbox, and removes a clean runtime session on exit.
- The loopback editor exposes the same create and play application services; existing movement preview, save, and rollback behavior remains unchanged.

## Sandbox acceptance

The visible sandbox contains a player capsule, ground, arena boundary, following camera, control instructions, speed, stamina, and movement mode. WASD, Shift, Space, and Escape exercise movement, sprint stamina, dodge stamina, and clean shutdown. The automated fixture drives the same movement loop and records movement, sprint, dodge, displacement, stamina, and final-state evidence.

## Acceptance evidence

On 2026-07-13, a tarball was installed into `C:\tmp\mam-greenfield-manual-20260713`, outside this repository. The installed CLI passed init, movement creation, and read-only project validation without copied examples or runtime sources. The installed visual editor changed `ground.runSpeed` from `5.5` to `6.25` through preview and transactional save, then launched the sandbox through **Play movement sandbox**.

The visible Godot window received W, Shift+W, Space, and Escape keyboard input. Its HUD showed non-zero speed and stamina reduced to `67.8 / 100.0`; the player moved within the visible arena, the runtime exited cleanly, the editor reported `Sandbox exited · complete`, and no runtime session remained. Screenshots and temporary install logs remain outside the repository in that acceptance directory.

## Boundaries

This slice adds no combat, enemy, encounter, animation, jumping, navigation, world authoring, exported game build, generalized template system, or copied engine/runtime source in consumer projects.
