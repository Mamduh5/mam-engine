import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { validateDefinition } from "../src/application/definitions/definitionValidationRegistry";
import { setHealthValue } from "../src/application/health/setHealthValue";
import { simulateHitFiles } from "../src/application/health/simulateHit";
import { rollbackSnapshot } from "../src/application/snapshots/rollbackSnapshot";
import { executeCli } from "../src/cli/main";
import { simulateHit } from "../src/domain/health/hitSimulation";
import type { HealthProfile } from "../src/domain/health/healthTypes";
import { validateHealthDefinition } from "../src/domain/health/healthValidation";
import type { OffensiveActionProfile } from "../src/domain/offensiveAction/offensiveActionTypes";
import { listSnapshotSummaries } from "../src/infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../src/shared/errorCodes";

const root = path.resolve(__dirname, "../..");
async function profiles(): Promise<{ health: HealthProfile; action: OffensiveActionProfile }> { return { health: JSON.parse(await readFile(path.join(root, "examples", "health", "default.json"), "utf8")) as HealthProfile, action: JSON.parse(await readFile(path.join(root, "examples", "offensive-action", "default.json"), "utf8")) as OffensiveActionProfile }; }
async function workspace(context: TestContext) { const workspaceRoot = await mkdtemp(path.join(tmpdir(), "mam-health-test-")); context.after(async () => rm(workspaceRoot, { recursive: true, force: true })); const healthRelative = "examples/health/default.json"; const actionRelative = "examples/offensive-action/default.json"; const healthFile = path.join(workspaceRoot, ...healthRelative.split("/")); const actionFile = path.join(workspaceRoot, ...actionRelative.split("/")); for (const [file, relative] of [[healthFile, healthRelative], [actionFile, actionRelative]] as const) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, await readFile(path.join(root, ...relative.split("/")), "utf8"), "utf8"); } await writeFile(path.join(workspaceRoot, "unrelated.txt"), "unchanged\n", "utf8"); return { root: workspaceRoot, healthRelative, actionRelative, healthFile, actionFile }; }

test("health profile v1 schema and semantics accept only the canonical shape", async () => { const { health } = await profiles(); assert.equal(validateHealthDefinition(health).valid, true); assert.equal(validateDefinition(health).kind, "health-profile"); assert.equal(validateHealthDefinition({ ...health, extra: true }).errors[0]?.code, ErrorCodes.HealthSchemaInvalid); assert.equal(validateHealthDefinition({ ...health, startingHealth: health.maxHealth + 1 }).errors[0]?.code, ErrorCodes.HealthSemanticInvalid); });

test("confirmed hit damage applies exactly once with deterministic clamp and overkill", async () => { const { health, action } = await profiles(); assert.deepEqual(simulateHit(health, action), { startingHealth: 100, incomingDamage: 20, appliedDamage: 20, remainingHealth: 80, overkillDamage: 0, defeated: false, finalTargetState: "alive" }); assert.deepEqual(simulateHit({ ...health, startingHealth: 15 }, action), { startingHealth: 15, incomingDamage: 20, appliedDamage: 15, remainingHealth: 0, overkillDamage: 5, defeated: true, finalTargetState: "defeated" }); });

test("health inspect validate and simulate-hit commands are structured and read-only", async (context) => { const target = await workspace(context); for (const action of ["inspect", "validate"] as const) { const execution = await executeCli(["health", action, target.healthRelative, "--json"], target.root); assert.equal(execution.result.status, "passed", action); assert.deepEqual(execution.result.changedFiles, []); } const hit = await executeCli(["health", "simulate-hit", target.healthRelative, target.actionRelative, "--json"], target.root); assert.equal(hit.result.status, "passed"); assert.deepEqual(hit.result.changedFiles, []); assert.equal((hit.result.data as any).remainingHealth, 80); });

test("health set is transactional, kind-aware, and rollback-safe", async (context) => { const target = await workspace(context); const original = await readFile(target.healthFile, "utf8"); assert.equal((await setHealthValue(target.root, target.healthRelative, "maxHealth", 120, true)).status, "dry_run"); assert.equal(await readFile(target.healthFile, "utf8"), original); const set = await setHealthValue(target.root, target.healthRelative, "maxHealth", 120, false); assert.equal(set.status, "passed"); assert.equal((await listSnapshotSummaries(target.root))[0]?.definitionKind, "health-profile"); assert.equal((await rollbackSnapshot(target.root, set.snapshotId as string)).status, "rolled_back"); assert.equal(await readFile(target.healthFile, "utf8"), original); });

test("health edits and hit simulation reject invalid definitions without writes", async (context) => { const target = await workspace(context); const original = await readFile(target.healthFile, "utf8"); assert.equal((await setHealthValue(target.root, target.healthRelative, "missing", 1, false)).errors[0]?.code, ErrorCodes.HealthPropertyNotFound); assert.equal((await setHealthValue(target.root, target.healthRelative, "startingHealth", 101, false)).errors[0]?.code, ErrorCodes.HealthSemanticInvalid); const action = JSON.parse(await readFile(target.actionFile, "utf8")) as OffensiveActionProfile; await writeFile(target.actionFile, JSON.stringify({ ...action, damage: 0 }), "utf8"); assert.equal((await simulateHitFiles(target.root, target.healthRelative, target.actionRelative)).errors[0]?.code, ErrorCodes.OffensiveActionSemanticInvalid); assert.equal(await readFile(target.healthFile, "utf8"), original); assert.equal((await listSnapshotSummaries(target.root)).length, 0); });
