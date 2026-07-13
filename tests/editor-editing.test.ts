import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { inspectMovement } from "../src/application/movement/inspectMovement";
import { EditorEditError, getMovementEditModel, previewMovementEdit, rollbackMovementEdit, saveMovementEdit } from "../src/application/editor/movementEditor";
import { listSnapshotSummaries } from "../src/infrastructure/snapshots/fileSnapshotStore";

const movement = {
  schemaVersion: 1, kind: "movement-profile", id: "editor-movement", displayName: "Editor Movement",
  ground: { walkSpeed: 2.5, runSpeed: 5.5, sprintSpeed: 7.5, acceleration: 18, deceleration: 24, rotationSpeedDegrees: 720, orientationMode: "camera_relative" },
  stamina: { maximum: 100, sprintCostPerSecond: 12, regenerationPerSecond: 18, regenerationDelaySeconds: 0.75, minimumToStartSprint: 8 },
  dodge: { distance: 4.2, durationSeconds: 0.55, staminaCost: 20, invulnerabilityStartSeconds: 0.08, invulnerabilityEndSeconds: 0.32, directionMode: "movement_input", steeringMultiplier: 0.15 }
};

async function workspace(context: TestContext): Promise<{ root: string; file: string; relative: string; original: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "mam-editor-editing-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const relative = "definitions/movement.json";
  const file = path.join(root, ...relative.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  const original = `${JSON.stringify(movement, null, 2)}\n`;
  await writeFile(file, original);
  await writeFile(path.join(root, "definitions", "health.json"), JSON.stringify({ schemaVersion: 1, kind: "health-profile", id: "health", displayName: "Health", maxHealth: 100, startingHealth: 100 }));
  return { root, file, relative, original };
}

test("movement editor model and preview stay typed, scoped, and read-only", async (context) => {
  const target = await workspace(context);
  const model = await getMovementEditModel(target.root, target.relative);
  assert.equal(model.kind, "movement-profile");
  assert.equal(model.revision.length, 64);
  assert.deepEqual(model.readOnlyFields.map((field) => field.path), ["schemaVersion", "kind", "id"]);
  assert.equal(model.editableFields.some((field) => field.path === "ground.runSpeed" && field.valueType === "number"), true);
  await assert.rejects(getMovementEditModel(target.root, "definitions/health.json"), (error: unknown) => error instanceof EditorEditError && error.code === "EDITOR_EDIT_UNSUPPORTED");

  const valid = await previewMovementEdit(target.root, { file: target.relative, expectedRevision: model.revision, path: "ground.runSpeed", value: 6 }) as Record<string, any>;
  assert.equal(valid.previewStatus, "passed");
  assert.equal(valid.candidateAuthoredValue, 6);
  assert.equal(valid.currentRevision, model.revision);
  assert.deepEqual(valid.validationFindings, []);
  assert.equal(await readFile(target.file, "utf8"), target.original);
  assert.deepEqual(await listSnapshotSummaries(target.root), []);

  const invalid = await previewMovementEdit(target.root, { file: target.relative, expectedRevision: model.revision, path: "ground.runSpeed", value: 20 }) as Record<string, any>;
  assert.equal(invalid.previewStatus, "failed");
  assert.equal(invalid.validationFindings.length > 0, true);
  assert.equal(await readFile(target.file, "utf8"), target.original);
  assert.deepEqual(await listSnapshotSummaries(target.root), []);

  await assert.rejects(previewMovementEdit(target.root, { file: target.relative, expectedRevision: model.revision, path: "ground.runSpeed", value: "six" }), (error: unknown) => error instanceof EditorEditError && error.code === "EDITOR_VALUE_TYPE_INVALID");
  await assert.rejects(previewMovementEdit(target.root, { file: target.relative, expectedRevision: model.revision, path: "id", value: "changed" }), (error: unknown) => error instanceof EditorEditError && error.code === "EDITOR_PROPERTY_NOT_EDITABLE");
});

test("movement editor save snapshots one property and rollback restores exact bytes", async (context) => {
  const target = await workspace(context);
  const model = await getMovementEditModel(target.root, target.relative);
  const saved = await saveMovementEdit(target.root, { file: target.relative, expectedRevision: model.revision, path: "ground.runSpeed", value: 6 }) as Record<string, any>;
  assert.equal(saved.saveStatus, "passed");
  assert.equal(saved.previousRevision, model.revision);
  assert.notEqual(saved.currentRevision, model.revision);
  assert.equal(typeof saved.snapshotId, "string");
  assert.equal(saved.changedFiles.includes(target.relative), true);
  assert.equal(saved.changedFiles.some((file: string) => file.startsWith(".mam-engine/snapshots/")), true);
  assert.equal((JSON.parse(await readFile(target.file, "utf8")) as Record<string, any>).ground.runSpeed, 6);
  assert.equal((await listSnapshotSummaries(target.root)).length, 1);
  const inspection = await inspectMovement(target.root, target.relative);
  assert.equal((inspection.data as Record<string, any>).profile.ground.runSpeed, 6);

  const updated = await readFile(target.file, "utf8");
  await assert.rejects(saveMovementEdit(target.root, { file: target.relative, expectedRevision: model.revision, path: "ground.runSpeed", value: 6.5 }), (error: unknown) => error instanceof EditorEditError && error.code === "EDITOR_REVISION_CONFLICT");
  assert.equal(await readFile(target.file, "utf8"), updated);
  assert.equal((await listSnapshotSummaries(target.root)).length, 1);

  const rolledBack = await rollbackMovementEdit(target.root, { file: target.relative, snapshotId: saved.snapshotId, expectedRevision: saved.currentRevision }) as Record<string, any>;
  assert.equal(rolledBack.rollbackStatus, "rolled_back");
  assert.equal(rolledBack.restoredSnapshotId, saved.snapshotId);
  assert.equal(typeof rolledBack.safetySnapshotId, "string");
  assert.notEqual(rolledBack.safetySnapshotId, saved.snapshotId);
  assert.equal(rolledBack.changedFiles.includes(target.relative), true);
  assert.equal(await readFile(target.file, "utf8"), target.original);
  assert.equal((await listSnapshotSummaries(target.root)).length, 2);
});
