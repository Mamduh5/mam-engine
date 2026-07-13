import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { getMovementEditModel, previewMovementEdit, rollbackMovementEdit, saveMovementEdit, EditorEditError } from "../src/application/editor/movementEditor";
import { compareMovementMetrics, getMovementSimulationModel, runMovementEditorSimulation } from "../src/application/editor/movementSimulationEditor";
import { simulateMovementFile } from "../src/application/movement/simulateMovement";
import { MOVEMENT_SCENARIOS, type MovementScenario } from "../src/domain/movement/movementTypes";
import { startEditorServer } from "../src/infrastructure/editor/editorServer";
import { listSnapshotSummaries } from "../src/infrastructure/snapshots/fileSnapshotStore";

const movement = {
  schemaVersion: 1, kind: "movement-profile", id: "simulation-movement", displayName: "Simulation Movement",
  ground: { walkSpeed: 2.5, runSpeed: 5.5, sprintSpeed: 7.5, acceleration: 18, deceleration: 24, rotationSpeedDegrees: 720, orientationMode: "camera_relative" },
  stamina: { maximum: 100, sprintCostPerSecond: 12, regenerationPerSecond: 18, regenerationDelaySeconds: 0.75, minimumToStartSprint: 8 },
  dodge: { distance: 4.2, durationSeconds: 0.55, staminaCost: 20, invulnerabilityStartSeconds: 0.08, invulnerabilityEndSeconds: 0.32, directionMode: "movement_input", steeringMultiplier: 0.15 }
};

async function workspace(context: TestContext): Promise<{ root: string; file: string; relative: string; original: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "mam-editor-simulation-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const relative = "definitions/movement.json";
  const file = path.join(root, ...relative.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  const original = `${JSON.stringify(movement, null, 2)}\n`;
  await writeFile(file, original);
  await writeFile(path.join(root, "definitions", "health.json"), JSON.stringify({ schemaVersion: 1, kind: "health-profile", id: "health", displayName: "Health", maxHealth: 100, startingHealth: 100 }));
  return { root, file, relative, original };
}

test("movement simulation model and runner cover all scenarios with deterministic validation", async (context) => {
  const target = await workspace(context);
  const model = await getMovementSimulationModel(target.root, target.relative);
  assert.deepEqual(model.availableScenarios, MOVEMENT_SCENARIOS.map((id) => ({ id, acceptsCustomSeconds: ["accelerate", "stop", "sprint"].includes(id) })));
  assert.equal(model.currentRevision.length, 64);
  await assert.rejects(getMovementSimulationModel(target.root, "definitions/health.json"), (error: unknown) => error instanceof EditorEditError && error.code === "EDITOR_EDIT_UNSUPPORTED");

  for (const scenario of MOVEMENT_SCENARIOS) {
    const result = await runMovementEditorSimulation(target.root, { file: target.relative, expectedRevision: model.currentRevision, scenario }) as Record<string, any>;
    const reference = await simulateMovementFile(target.root, target.relative, scenario);
    assert.equal(result.scenario, scenario);
    assert.equal(result.requestedSeconds, null);
    assert.deepEqual(result.persistedSimulation, reference.data);
    assert.equal(result.candidateSimulation, null);
  }
  for (const scenario of ["accelerate", "stop", "sprint"] as MovementScenario[]) {
    const result = await runMovementEditorSimulation(target.root, { file: target.relative, expectedRevision: model.currentRevision, scenario, seconds: 2.25 }) as Record<string, any>;
    assert.equal(result.requestedSeconds, 2.25);
  }
  for (const seconds of [0, -1, 61, Number.NaN, Number.POSITIVE_INFINITY, "2"]) {
    await assert.rejects(runMovementEditorSimulation(target.root, { file: target.relative, expectedRevision: model.currentRevision, scenario: "accelerate", seconds }), (error: unknown) => error instanceof EditorEditError && error.code === "EDITOR_SIMULATION_SECONDS_INVALID");
  }
  await assert.rejects(runMovementEditorSimulation(target.root, { file: target.relative, expectedRevision: model.currentRevision, scenario: "dodge", seconds: 1 }), (error: unknown) => error instanceof EditorEditError && error.code === "EDITOR_SIMULATION_SECONDS_UNSUPPORTED");
  await assert.rejects(runMovementEditorSimulation(target.root, { file: target.relative, expectedRevision: model.currentRevision, scenario: "unknown" }), (error: unknown) => error instanceof EditorEditError && error.code === "EDITOR_SIMULATION_SCENARIO_INVALID");
  await assert.rejects(runMovementEditorSimulation(target.root, { file: target.relative, expectedRevision: "stale", scenario: "turn" }), (error: unknown) => error instanceof EditorEditError && error.code === "EDITOR_REVISION_CONFLICT");
  assert.equal(await readFile(target.file, "utf8"), target.original);
  assert.deepEqual(await listSnapshotSummaries(target.root), []);
});

test("candidate simulation is read-only and matches save before exact rollback", async (context) => {
  const target = await workspace(context);
  const originalModel = await getMovementEditModel(target.root, target.relative);
  const request = { file: target.relative, expectedRevision: originalModel.revision, scenario: "accelerate", seconds: 3 };
  const original = await runMovementEditorSimulation(target.root, request) as Record<string, any>;
  const preview = await previewMovementEdit(target.root, { file: target.relative, expectedRevision: originalModel.revision, path: "ground.acceleration", value: 24 }) as Record<string, any>;
  assert.equal(preview.previewStatus, "passed");
  const candidate = await runMovementEditorSimulation(target.root, { ...request, candidate: { path: "ground.acceleration", value: 24 } }) as Record<string, any>;
  assert.equal(candidate.validationFindings.length, 0);
  assert.notDeepEqual(candidate.candidateSimulation, original.persistedSimulation);
  assert.deepEqual(candidate.metricComparison.map((row: Record<string, unknown>) => row.metric), [...candidate.metricComparison.map((row: Record<string, string>) => row.metric)].sort());
  assert.equal(candidate.metricComparison.some((row: Record<string, unknown>) => row.changed), true);
  assert.equal(await readFile(target.file, "utf8"), target.original);
  assert.deepEqual(await listSnapshotSummaries(target.root), []);

  const invalid = await runMovementEditorSimulation(target.root, { ...request, candidate: { path: "ground.acceleration", value: 0 } }) as Record<string, any>;
  assert.equal(invalid.candidateSimulation, null);
  assert.equal(invalid.validationFindings.length > 0, true);
  await assert.rejects(runMovementEditorSimulation(target.root, { ...request, candidate: { path: "id", value: "changed" } }), (error: unknown) => error instanceof EditorEditError && error.code === "EDITOR_PROPERTY_NOT_EDITABLE");

  const saved = await saveMovementEdit(target.root, { file: target.relative, expectedRevision: originalModel.revision, path: "ground.acceleration", value: 24 }) as Record<string, any>;
  const savedSimulation = await runMovementEditorSimulation(target.root, { ...request, expectedRevision: saved.currentRevision }) as Record<string, any>;
  assert.deepEqual(savedSimulation.persistedSimulation, candidate.candidateSimulation);
  const rolledBack = await rollbackMovementEdit(target.root, { file: target.relative, snapshotId: saved.snapshotId, expectedRevision: saved.currentRevision }) as Record<string, any>;
  const restoredSimulation = await runMovementEditorSimulation(target.root, { ...request, expectedRevision: rolledBack.currentRevision }) as Record<string, any>;
  assert.deepEqual(restoredSimulation.persistedSimulation, original.persistedSimulation);
  assert.equal(await readFile(target.file, "utf8"), target.original);

  assert.deepEqual(compareMovementMetrics({ beta: null, alpha: 1, same: 4 }, { beta: null, alpha: 1.3333333333, same: 4 }), [
    { metric: "alpha", persisted: 1, candidate: 1.3333333333, delta: 0.333333333, changed: true },
    { metric: "beta", persisted: null, candidate: null, delta: null, changed: false },
    { metric: "same", persisted: 4, candidate: 4, delta: 0, changed: false }
  ]);
});

test("simulation HTTP routes expose the model and retain mutation security", async (context) => {
  const target = await workspace(context);
  const server = await startEditorServer({ workspaceRoot: target.root, port: 0 });
  context.after(() => server.close());
  const modelResponse = await fetch(`${server.url}/api/definitions/simulation?file=${encodeURIComponent(target.relative)}`);
  assert.equal(modelResponse.status, 200);
  const model = await modelResponse.json() as Record<string, any>;
  assert.equal(model.availableScenarios.length, 5);
  const body = JSON.stringify({ file: target.relative, expectedRevision: model.currentRevision, scenario: "turn" });
  const result = await fetch(`${server.url}/api/definitions/simulation/run`, { method: "POST", headers: { "Content-Type": "application/json", Origin: server.url }, body });
  assert.equal(result.status, 200);
  assert.equal(((await result.json()) as Record<string, any>).persistedSimulation.scenario, "turn");
  const malformed = await fetch(`${server.url}/api/definitions/simulation/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal(malformed.status, 400);
  const wrongType = await fetch(`${server.url}/api/definitions/simulation/run`, { method: "POST", headers: { "Content-Type": "text/plain" }, body });
  assert.equal(wrongType.status, 415);
  const badOrigin = await fetch(`${server.url}/api/definitions/simulation/run`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:1" }, body });
  assert.equal(badOrigin.status, 403);
  const badHost = await postWithHost(`${server.url}/api/definitions/simulation/run`, "example.com", body);
  assert.equal(badHost.status, 403);
});

async function postWithHost(url: string, host: string, body: string): Promise<{ status: number }> {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const request = httpRequest({ hostname: target.hostname, port: target.port, path: target.pathname, method: "POST", headers: { Host: host, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, (response) => {
      response.resume();
      response.on("end", () => resolve({ status: response.statusCode ?? 0 }));
    });
    request.once("error", reject);
    request.end(body);
  });
}
