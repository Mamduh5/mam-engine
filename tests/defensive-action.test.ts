import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { validateDefinition } from "../src/application/definitions/definitionValidationRegistry";
import { rollbackSnapshot } from "../src/application/snapshots/rollbackSnapshot";
import { setDefensiveActionValue } from "../src/application/defensiveAction/setDefensiveActionValue";
import { executeCli } from "../src/cli/main";
import { simulateDefensiveAction } from "../src/domain/defensiveAction/defensiveActionSimulation";
import type { DefensiveActionProfile } from "../src/domain/defensiveAction/defensiveActionTypes";
import { validateDefensiveActionDefinition } from "../src/domain/defensiveAction/defensiveActionValidation";
import { listSnapshotSummaries } from "../src/infrastructure/snapshots/fileSnapshotStore";
import { ErrorCodes } from "../src/shared/errorCodes";

const root = path.resolve(__dirname, "../..");
async function defaultProfile(): Promise<DefensiveActionProfile> { return JSON.parse(await readFile(path.join(root, "examples", "defensive-action", "default.json"), "utf8")) as DefensiveActionProfile; }
async function workspace(context: TestContext) { const workspaceRoot = await mkdtemp(path.join(tmpdir(), "mam-defensive-action-test-")); context.after(async () => rm(workspaceRoot, { recursive: true, force: true })); const relativeFile = "examples/defensive-action/default.json"; const file = path.join(workspaceRoot, ...relativeFile.split("/")); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, await readFile(path.join(root, ...relativeFile.split("/")), "utf8"), "utf8"); await writeFile(path.join(workspaceRoot, "unrelated.txt"), "unchanged\n", "utf8"); return { root: workspaceRoot, relativeFile, file }; }

test("defensive action v1 schema and semantics accept only the canonical dodge shape", async () => { const profile = await defaultProfile(); const valid = validateDefensiveActionDefinition(profile); assert.equal(valid.valid, true); assert.equal(validateDefinition(profile).kind, "defensive-action-profile"); assert.equal(validateDefensiveActionDefinition({ ...profile, extra: true }).errors[0]?.code, ErrorCodes.DefensiveActionSchemaInvalid); assert.equal(validateDefensiveActionDefinition({ ...profile, invulnerabilityEndSeconds: profile.durationSeconds + 0.1 }).errors[0]?.code, ErrorCodes.DefensiveActionSemanticInvalid); });

test("defensive action dodge simulation is deterministic and reports fixed-step lifecycle evidence", async () => { const profile = await defaultProfile(); const first = simulateDefensiveAction(profile); const second = simulateDefensiveAction(profile); assert.deepEqual(first, second); assert.deepEqual(first, { fixedDeltaSeconds: 0.016666667, totalSteps: 60, distanceTravelled: 4, staminaConsumed: 25, invulnerabilityStartStep: 7, invulnerabilityEndStep: 21, cooldownCompletionStep: 60, finalActionState: "ready" }); });

test("defensive action inspect validate and simulate commands are structured and read-only", async (context) => { const target = await workspace(context); for (const action of ["inspect", "validate", "simulate"] as const) { const execution = await executeCli(["defensive-action", action, target.relativeFile, "--json"], target.root); assert.equal(execution.result.status, "passed", action); assert.equal(execution.result.command, `defensive-action.${action}`); assert.deepEqual(execution.result.changedFiles, []); } });

test("defensive action set is transactional, kind-aware, and rollback-safe", async (context) => { const target = await workspace(context); const original = await readFile(target.file, "utf8"); const dryRun = await setDefensiveActionValue(target.root, target.relativeFile, "staminaCost", 20, true); assert.equal(dryRun.status, "dry_run"); assert.equal(await readFile(target.file, "utf8"), original); const set = await setDefensiveActionValue(target.root, target.relativeFile, "staminaCost", 20, false); assert.equal(set.status, "passed"); assert.equal((JSON.parse(await readFile(target.file, "utf8")) as DefensiveActionProfile).staminaCost, 20); assert.equal((await listSnapshotSummaries(target.root))[0]?.definitionKind, "defensive-action-profile"); const rollback = await rollbackSnapshot(target.root, set.snapshotId as string); assert.equal(rollback.status, "rolled_back"); assert.equal(await readFile(target.file, "utf8"), original); });

test("defensive action set rejects unknown and semantically invalid edits without writes", async (context) => { const target = await workspace(context); const original = await readFile(target.file, "utf8"); assert.equal((await setDefensiveActionValue(target.root, target.relativeFile, "missing", 1, false)).errors[0]?.code, ErrorCodes.DefensiveActionPropertyNotFound); assert.equal((await setDefensiveActionValue(target.root, target.relativeFile, "invulnerabilityEndSeconds", 2, false)).errors[0]?.code, ErrorCodes.DefensiveActionSemanticInvalid); assert.equal(await readFile(target.file, "utf8"), original); assert.equal((await listSnapshotSummaries(target.root)).length, 0); });
