# Greenfield v0.1 game-creation dogfood

## Tested build

- Source: `dogfood/v0.1-self-hosting` at `0bbb1860afff456d348c5fad7314e3164836d17d`.
- Package: `mam-engine@0.1.0`, packed to `C:\tmp\mam-engine-greenfield-1b28871597f34347bb2ef62fa25063bb\mam-engine-0.1.0.tgz` outside the repository.
- Package SHA-256: `8F68F6E332FBE9F82268EC3235594CFE49B3EB88E33EE7BF822FD2BD474CE7CC`.
- Packaged entry count: 334.
- Operating system: Microsoft Windows NT 10.0.26200.0, x64.
- Node.js: v20.20.2. npm: 10.8.2.
- Godot: available on `PATH` as `4.6.3.stable.official.7d41c59c4`. No runtime command was reached because authoring stopped at the first product blocker.

The compiled output from the tested commit was already current, so no additional build was required before packing.

## Empty-start proof

- Orphan branch: `dogfood/greenfield-training-hunt`.
- Parentless root commit: `7b1d49af2104e0b4d5676fcd9f37ee12be06a87d` (`chore: start empty greenfield dogfood`).
- `git rev-list --parents -n 1 HEAD` reported only the root SHA, with no parent.
- Initial tracked file tree: empty (`git ls-tree -r --name-only HEAD` produced no paths).
- Initial physical worktree after cleanup: `.git/` only.
- The root commit was pushed before consumer setup.
- No mam-engine source, examples, schemas, runtime project, definitions, or files from another branch were copied.

Normal consumer setup then created `package.json`, `package-lock.json`, and ignored `node_modules/`. A manual `.gitignore` was added only for `node_modules/`, `.mam-engine/`, tarballs, and npm logs. Before the first mam-engine command, the complete untracked file list excluding `node_modules` was `.gitignore`, `package-lock.json`, and `package.json`.

## Target game

The intended result was a small playable third-person training hunt with a controllable hunter, movement and camera control, targeting, stamina and dodge, one weapon attack, one large enemy with hurtboxes and target points, a bounded arena, encounter victory, and visible runtime status. The intended final proof was a non-headless Godot session played through real input.

## Attempt log

| Step | User goal | Discovered command or action | Actual result and evidence | Status |
| --- | --- | --- | --- | --- |
| 1 | Package the fixed build | `npm pack --json --pack-destination <temporary-directory>` | Produced `mam-engine-0.1.0.tgz`; metadata reported version 0.1.0 and 334 entries; SHA-256 recorded above. | pass |
| 2 | Start from no project | `git switch --orphan dogfood/greenfield-training-hunt`; empty root commit | Root has no parent and no tracked paths; pushed successfully. | pass |
| 3 | Set up a consumer | `npm init -y`; `npm install <tarball> --ignore-scripts --no-audit --no-fund --prefer-offline` | Six packages installed. Only npm setup files and ignored dependencies were created. | pass |
| 4 | Discover the product | `npx mam --help` | Listed 19 command groups and directed the user to group help. It exposed no project initialization or project creation group. | pass |
| 5 | Find definition authoring | `npx mam movement --help`; `npx mam hunter --help` | Movement offered `inspect`, `validate`, `simulate`, `runtime-test`, and existing-property `set`; hunter offered `inspect`, `validate`, and `set`. Every action requires an existing file. No create action was exposed. | blocked |
| 6 | Find encounter launch | `npx mam encounter --help` | Encounter offered inspection, validation, simulation, controlled runtime/interactive/recovery tests, and `set`, all requiring an existing encounter file. | pass (discovery only) |
| 7 | Open the editor | `npx mam editor --help`; installed shim `mam editor serve --host 127.0.0.1 --port 0 --workspace . --json` | Help exposed only `serve`. Startup passed at `http://127.0.0.1:59583` against the empty workspace and reported no changed files. | pass (server only) |
| 8 | Use the visual UI to create the first definition | Actual browser interaction was required | No browser-interaction connector was available in this environment. No HTTP API substitute was used and no screenshot was claimed. Installed help was insufficient, so the packaged README was consulted; it describes exploration of existing definitions, editing of an existing movement profile, and other kinds as read-only, with broader authoring pending. | environment limitation; product blocker independently confirmed by documented interfaces |

The creation attempt stopped here. No packaged example was opened or copied, no definition was manually authored, and no simulation or runtime fixture was invoked.

## First product blocker

### GF-001 - No documented way to create the first definition in an empty workspace

- Required user action: initialize a game project or create the first movement definition through mam-engine's installed CLI or visual editor.
- Observed product behavior: top-level help has no initialization/scaffolding command. Relevant group help exposes operations on an already-existing `<file>` only. Editor help exposes only `serve`. The installed README describes definition exploration and editing of an existing movement profile, not definition creation.
- Expected product behavior: an empty-workspace workflow should provide a documented CLI or UI action that creates a valid first definition without copying examples or manually writing JSON.
- Reproduction:
  1. Create an empty directory and initialize npm.
  2. Install the packed `mam-engine@0.1.0`.
  3. Run `npx mam --help`, `npx mam movement --help`, and `npx mam editor --help`.
  4. Start `npx mam editor serve --host 127.0.0.1 --port 0 --workspace .`.
  5. Attempt to discover a documented action that creates a movement profile.
- Console evidence: movement help lists only `inspect`, `validate`, `simulate`, `runtime-test`, and `set`; editor help lists only `serve`. Editor startup succeeded but generated no workspace files.
- Screenshot evidence: none. Actual browser tooling was unavailable, which is recorded separately and was not replaced with direct API calls.
- Prevents creating a game: yes. Without the first definition, no hunter, arena, enemy, weapon, encounter, or playable project can be authored through permitted interfaces.
- Smallest capability direction: provide one documented empty-workspace project/definition creation workflow that can create a valid initial definition through the installed CLI or visual editor.

## Evidence integrity

- Product commands executed: `npx mam --help`; `npx mam movement --help`; `npx mam editor --help`; `npx mam encounter --help`; `npx mam hunter --help`; installed `mam editor serve --host 127.0.0.1 --port 0 --workspace . --json`.
- Editor actions: server launch only. No browser UI action was possible in the test environment.
- Files generated by npm: `package.json`, `package-lock.json`, and ignored `node_modules/`.
- Files generated by mam-engine: none. Editor startup reported `changedFiles: []`.
- Files created manually: `.gitignore` and this report only.
- Game definitions manually authored: none.
- Godot files manually authored: none.
- Untracked files excluding `node_modules` immediately before the report: `.gitignore`, `package-lock.json`, and `package.json`.
- Screenshots: none; `dogfood-evidence/` was not created because actual browser interaction was unavailable.
- Tarball, runtime sessions, and temporary console logs remain outside Git or ignored.

## Product conclusion

`cannot-start-game-from-empty-workspace`

The package can be installed, its commands can be discovered, and its editor server can start against an empty workspace. The documented product workflow cannot create the first required definition, so no playable game was produced.

## Release implication

`v0.1-needs-clearer-product-positioning`

The tested build provides substantial validated engine/editor infrastructure: schemas, validation, deterministic simulations, transactional editing of existing definitions, snapshots, and machine-readable commands. It also provides controlled runtime fixtures that compare authored profiles with Godot behavior. Those are not equivalent to a real user starting from nothing, authoring a connected game, generating a runnable project, and playing it. v0.1 can be positioned as infrastructure for existing definition work and controlled proofs, but it should not imply greenfield playable-game creation until a creation/scaffolding workflow exists.
