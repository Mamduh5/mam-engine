import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { validateDefinition } from "../src/application/definitions/definitionValidationRegistry";
import { isLoadedHunterBundle, loadValidHunterBundle } from "../src/application/hunter/hunterOperationSupport";
import { setHunterValue } from "../src/application/hunter/setHunterValue";
import { setArenaValue } from "../src/application/arena/setArenaValue";
import { rollbackSnapshot } from "../src/application/snapshots/rollbackSnapshot";
import { executeCli } from "../src/cli/main";
import type { ArenaProfile } from "../src/domain/arena/arenaTypes";
import { validateArenaDefinition } from "../src/domain/arena/arenaValidation";
import type { HunterProfile } from "../src/domain/hunter/hunterTypes";
import { validateHunterDefinition } from "../src/domain/hunter/hunterValidation";
import { listSnapshotSummaries } from "../src/infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../src/shared/errorCodes";

const root = path.resolve(__dirname, "../..");
const relative = { hunter: "examples/hunter/training-hunter.json", arena: "examples/arena/training-arena.json", health: "examples/health/default.json", stamina: "examples/stamina/default.json" } as const;

async function createWorkspace(context: TestContext) {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "mam-hunter-arena-test-")); context.after(async () => rm(workspaceRoot, { recursive: true, force: true }));
  const files = Object.fromEntries(await Promise.all(Object.entries(relative).map(async ([key, file]) => { const target = path.join(workspaceRoot, ...file.split("/")); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, await readFile(path.join(root, ...file.split("/")), "utf8"), "utf8"); return [key, target]; }))) as Record<keyof typeof relative, string>;
  await writeFile(path.join(workspaceRoot, "unrelated.txt"), "unchanged\n", "utf8"); return { root: workspaceRoot, files };
}

test("hunter schema registry references and inspection expose only resolved state", async (context) => {
  const target = await createWorkspace(context); const profile = JSON.parse(await readFile(target.files.hunter, "utf8")) as HunterProfile;
  assert.equal(validateHunterDefinition(profile).valid, true); assert.equal(validateDefinition(profile).kind, "hunter-profile"); assert.equal(validateHunterDefinition({ ...profile, maxHealth: 100 }).errors[0]?.code, ErrorCodes.HunterSchemaInvalid);
  const bundle = await loadValidHunterBundle(target.root, relative.hunter); assert.equal(isLoadedHunterBundle(bundle), true); if (!isLoadedHunterBundle(bundle)) return; assert.deepEqual(bundle.resolvedDefinitionPaths, { healthFile: relative.health, staminaFile: relative.stamina });
  const execution = await executeCli(["hunter", "inspect", relative.hunter, "--json"], target.root); assert.equal(execution.result.status, "passed"); assert.deepEqual(execution.result.changedFiles, []); assert.deepEqual(execution.result.data, { hunterId: "training-hunter", displayName: "Training Hunter", resolvedDefinitionPaths: { healthFile: relative.health, staminaFile: relative.stamina }, maximumHealth: 100, startingHealth: 100, maximumStamina: 100, startingStamina: 100 });
});

test("arena schema registry placement rules and inspection report deterministic geometry metrics", async (context) => {
  const target = await createWorkspace(context); const profile = JSON.parse(await readFile(target.files.arena, "utf8")) as ArenaProfile;
  assert.equal(validateArenaDefinition(profile).valid, true); assert.equal(validateDefinition(profile).kind, "arena-profile"); assert.equal(validateArenaDefinition({ ...profile, extra: true }).errors[0]?.code, ErrorCodes.ArenaSchemaInvalid); assert.equal(validateArenaDefinition({ ...profile, radius: 0 }).errors[0]?.code, ErrorCodes.ArenaSchemaInvalid); assert.equal(validateArenaDefinition({ ...profile, playerSpawn: { x: 30, y: 0, z: 0 } }).errors[0]?.code, ErrorCodes.ArenaSemanticInvalid); assert.equal(validateArenaDefinition({ ...profile, enemySpawn: profile.playerSpawn }).errors[0]?.code, ErrorCodes.ArenaSemanticInvalid); assert.equal(validateArenaDefinition({ ...profile, playerSpawn: { x: Number.NaN, y: 0, z: 0 } }).valid, false);
  const execution = await executeCli(["arena", "inspect", relative.arena, "--json"], target.root); assert.equal(execution.result.status, "passed"); assert.deepEqual(execution.result.changedFiles, []); assert.deepEqual(execution.result.data, { arenaId: "training-arena", radius: 25, playerSpawn: { x: -5, y: 0, z: 0 }, enemySpawn: { x: 5, y: 0, z: 0 }, spawnSeparationDistance: 10, playerSpawnWithinBounds: true, enemySpawnWithinBounds: true });
});

test("hunter and arena CLI validation are deterministic and read-only", async (context) => {
  const target = await createWorkspace(context); for (const [group, file] of [["hunter", relative.hunter], ["arena", relative.arena]] as const) { const execution = await executeCli([group, "validate", file, "--json"], target.root); assert.equal(execution.result.status, "passed"); assert.deepEqual(execution.result.changedFiles, []); }
});

test("hunter and arena set operations are transactional snapshot-aware and rollback compatible", async (context) => {
  const hunter = await createWorkspace(context); const originalHunter = await readFile(hunter.files.hunter, "utf8"); assert.equal((await setHunterValue(hunter.root, relative.hunter, "displayName", "Updated Hunter", true)).status, "dry_run"); assert.equal(await readFile(hunter.files.hunter, "utf8"), originalHunter); const hunterSet = await setHunterValue(hunter.root, relative.hunter, "displayName", "Updated Hunter", false); assert.equal(hunterSet.status, "passed"); assert.equal((await listSnapshotSummaries(hunter.root))[0]?.definitionKind, "hunter-profile"); assert.equal((await rollbackSnapshot(hunter.root, hunterSet.snapshotId as string)).status, "rolled_back"); assert.equal(await readFile(hunter.files.hunter, "utf8"), originalHunter);
  const arena = await createWorkspace(context); const originalArena = await readFile(arena.files.arena, "utf8"); assert.equal((await setArenaValue(arena.root, relative.arena, "playerSpawn.x", -6, true)).status, "dry_run"); assert.equal(await readFile(arena.files.arena, "utf8"), originalArena); const arenaSet = await setArenaValue(arena.root, relative.arena, "playerSpawn.x", -6, false); assert.equal(arenaSet.status, "passed"); assert.equal((await listSnapshotSummaries(arena.root))[0]?.definitionKind, "arena-profile"); assert.equal((await rollbackSnapshot(arena.root, arenaSet.snapshotId as string)).status, "rolled_back"); assert.equal(await readFile(arena.files.arena, "utf8"), originalArena);
});

test("hunter references and hunter arena property edits reject invalid or unsafe inputs before writes", async (context) => {
  const target = await createWorkspace(context); const hunter = JSON.parse(await readFile(target.files.hunter, "utf8")) as HunterProfile;
  await writeFile(target.files.hunter, JSON.stringify({ ...hunter, healthFile: "../outside.json" }), "utf8"); let execution = await executeCli(["hunter", "validate", relative.hunter, "--json"], target.root); assert.equal(execution.result.errors[0]?.code, ErrorCodes.HunterReferenceInvalid); await writeFile(target.files.hunter, JSON.stringify(hunter), "utf8");
  const health = JSON.parse(await readFile(target.files.health, "utf8")); await writeFile(target.files.health, JSON.stringify({ ...health, startingHealth: health.maxHealth + 1 }), "utf8"); execution = await executeCli(["hunter", "inspect", relative.hunter, "--json"], target.root); assert.equal(execution.result.errors[0]?.code, ErrorCodes.HunterReferenceInvalid);
  assert.equal((await setHunterValue(target.root, relative.hunter, "missing", 1, false)).errors[0]?.code, ErrorCodes.HunterPropertyNotFound); assert.equal((await setArenaValue(target.root, relative.arena, "playerSpawn.missing", 1, false)).errors[0]?.code, ErrorCodes.ArenaPropertyNotFound); assert.equal((await listSnapshotSummaries(target.root)).length, 0);
});
