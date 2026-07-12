import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { validateDefinition } from "../src/application/definitions/definitionValidationRegistry";
import { setOffensiveActionValue } from "../src/application/offensiveAction/setOffensiveActionValue";
import { rollbackSnapshot } from "../src/application/snapshots/rollbackSnapshot";
import { executeCli } from "../src/cli/main";
import { simulateOffensiveAction } from "../src/domain/offensiveAction/offensiveActionSimulation";
import type { OffensiveActionProfile } from "../src/domain/offensiveAction/offensiveActionTypes";
import { validateOffensiveActionDefinition } from "../src/domain/offensiveAction/offensiveActionValidation";
import { listSnapshotSummaries } from "../src/infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../src/shared/errorCodes";

const root = path.resolve(__dirname, "../..");
async function defaultProfile(): Promise<OffensiveActionProfile> { return JSON.parse(await readFile(path.join(root, "examples", "offensive-action", "default.json"), "utf8")) as OffensiveActionProfile; }
async function workspace(context: TestContext) { const workspaceRoot = await mkdtemp(path.join(tmpdir(), "mam-offensive-action-test-")); context.after(async () => rm(workspaceRoot, { recursive: true, force: true })); const relativeFile = "examples/offensive-action/default.json"; const file = path.join(workspaceRoot, ...relativeFile.split("/")); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, await readFile(path.join(root, ...relativeFile.split("/")), "utf8"), "utf8"); await writeFile(path.join(workspaceRoot, "unrelated.txt"), "unchanged\n", "utf8"); return { root: workspaceRoot, relativeFile, file }; }

test("offensive action v1 schema and semantics accept only the canonical light attack shape", async () => { const profile = await defaultProfile(); assert.equal(validateOffensiveActionDefinition(profile).valid, true); assert.equal(validateDefinition(profile).kind, "offensive-action-profile"); assert.equal(validateOffensiveActionDefinition({ ...profile, extra: true }).errors[0]?.code, ErrorCodes.OffensiveActionSchemaInvalid); assert.equal(validateOffensiveActionDefinition({ ...profile, activeEndSeconds: profile.durationSeconds + 0.1 }).errors[0]?.code, ErrorCodes.OffensiveActionSemanticInvalid); });

test("offensive action simulation is deterministic and reports fixed-step lifecycle evidence", async () => { const profile = await defaultProfile(); const first = simulateOffensiveAction(profile); assert.deepEqual(first, simulateOffensiveAction(profile)); assert.deepEqual(first, { fixedDeltaSeconds: 0.016666667, totalSteps: 51, distanceTravelled: 1.2, staminaConsumed: 10, damageValue: 20, activeStartStep: 10, activeEndStep: 18, cooldownCompletionStep: 51, finalActionState: "ready" }); });

test("offensive action inspect validate and simulate commands are structured and read-only", async (context) => { const target = await workspace(context); for (const action of ["inspect", "validate", "simulate"] as const) { const execution = await executeCli(["offensive-action", action, target.relativeFile, "--json"], target.root); assert.equal(execution.result.status, "passed", action); assert.equal(execution.result.command, `offensive-action.${action}`); assert.deepEqual(execution.result.changedFiles, []); } });

test("offensive action set is transactional, kind-aware, and rollback-safe", async (context) => { const target = await workspace(context); const original = await readFile(target.file, "utf8"); assert.equal((await setOffensiveActionValue(target.root, target.relativeFile, "damage", 24, true)).status, "dry_run"); assert.equal(await readFile(target.file, "utf8"), original); const set = await setOffensiveActionValue(target.root, target.relativeFile, "damage", 24, false); assert.equal(set.status, "passed"); assert.equal((JSON.parse(await readFile(target.file, "utf8")) as OffensiveActionProfile).damage, 24); assert.equal((await listSnapshotSummaries(target.root))[0]?.definitionKind, "offensive-action-profile"); assert.equal((await rollbackSnapshot(target.root, set.snapshotId as string)).status, "rolled_back"); assert.equal(await readFile(target.file, "utf8"), original); });

test("offensive action set rejects unknown and semantically invalid edits without writes", async (context) => { const target = await workspace(context); const original = await readFile(target.file, "utf8"); assert.equal((await setOffensiveActionValue(target.root, target.relativeFile, "missing", 1, false)).errors[0]?.code, ErrorCodes.OffensiveActionPropertyNotFound); assert.equal((await setOffensiveActionValue(target.root, target.relativeFile, "activeEndSeconds", 2, false)).errors[0]?.code, ErrorCodes.OffensiveActionSemanticInvalid); assert.equal(await readFile(target.file, "utf8"), original); assert.equal((await listSnapshotSummaries(target.root)).length, 0); });
