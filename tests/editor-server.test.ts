import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { parseCommand } from "../src/cli/commandParser";
import { startEditorServer } from "../src/infrastructure/editor/editorServer";

const editableMovement = {
  schemaVersion: 1, kind: "movement-profile", id: "server-movement", displayName: "Server Movement",
  ground: { walkSpeed: 2.5, runSpeed: 5.5, sprintSpeed: 7.5, acceleration: 18, deceleration: 24, rotationSpeedDegrees: 720, orientationMode: "camera_relative" },
  stamina: { maximum: 100, sprintCostPerSecond: 12, regenerationPerSecond: 18, regenerationDelaySeconds: 0.75, minimumToStartSprint: 8 },
  dodge: { distance: 4.2, durationSeconds: 0.55, staminaCost: 20, invulnerabilityStartSeconds: 0.08, invulnerabilityEndSeconds: 0.32, directionMode: "movement_input", steeringMultiplier: 0.15 }
};

async function postWithHost(url: string, host: string, body: string): Promise<{ status: number; json: Record<string, any> }> {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const request = httpRequest({ hostname: target.hostname, port: target.port, path: target.pathname, method: "POST", headers: { Host: host, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode ?? 0, json: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, any> }));
    });
    request.once("error", reject);
    request.end(body);
  });
}

async function createWorkspace(context: TestContext): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "mam-editor-server-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "definitions"), { recursive: true });
  await mkdir(path.join(root, ".git"), { recursive: true });
  await mkdir(path.join(root, "dist"), { recursive: true });
  const health = { schemaVersion: 1, kind: "health-profile", id: "health", displayName: "Health", maxHealth: 100, startingHealth: 90 };
  const stamina = { schemaVersion: 1, kind: "stamina-profile", id: "stamina", displayName: "Stamina", maxStamina: 80, startingStamina: 70 };
  const hunter = { schemaVersion: 1, kind: "hunter-profile", id: "hunter", displayName: "Hunter", healthFile: "definitions/a-health.json", staminaFile: "definitions/b-stamina.json" };
  await Promise.all([
    writeFile(path.join(root, "definitions", "a-health.json"), JSON.stringify(health)),
    writeFile(path.join(root, "definitions", "b-stamina.json"), JSON.stringify(stamina)),
    writeFile(path.join(root, "definitions", "c-hunter.json"), JSON.stringify(hunter)),
    writeFile(path.join(root, "definitions", "d-invalid-health.json"), JSON.stringify({ schemaVersion: 1, kind: "health-profile", id: "invalid" })),
    writeFile(path.join(root, "definitions", "malformed.json"), "{not-json"),
    writeFile(path.join(root, "definitions", "unrelated.json"), JSON.stringify({ kind: "unrelated" })),
    writeFile(path.join(root, ".git", "hidden.json"), JSON.stringify(health)),
    writeFile(path.join(root, "dist", "hidden.json"), JSON.stringify(health))
  ]);
  return root;
}

test("editor server exposes deterministic read-only definition APIs on loopback", async (context) => {
  const workspaceRoot = await createWorkspace(context);
  const server = await startEditorServer({ workspaceRoot, host: "127.0.0.1", port: 0 });
  context.after(() => server.close());

  assert.equal(server.host, "127.0.0.1");
  assert.notEqual(server.port, 0);
  const healthResponse = await fetch(`${server.url}/api/health`);
  assert.deepEqual(await healthResponse.json(), { status: "ok", protocolVersion: "mam.editor/v1", workspaceAvailable: true });
  assert.equal(healthResponse.headers.get("content-security-policy")?.includes("default-src 'self'"), true);
  assert.equal(healthResponse.headers.get("x-content-type-options"), "nosniff");
  assert.equal(healthResponse.headers.get("referrer-policy"), "no-referrer");
  assert.equal(healthResponse.headers.get("cache-control"), "no-store");

  const workspace = await fetch(`${server.url}/api/workspace`).then((response) => response.json()) as Record<string, unknown>;
  assert.equal(workspace.workspaceRoot, workspaceRoot);
  assert.equal(workspace.totalDiscoveredDefinitions, 4);
  assert.equal(workspace.validCount, 3);
  assert.equal(workspace.invalidCount, 1);

  const discovery = await fetch(`${server.url}/api/definitions`).then((response) => response.json()) as { definitions: Array<Record<string, unknown>> };
  assert.deepEqual(discovery.definitions.map((item) => item.relativePath), ["definitions/a-health.json", "definitions/b-stamina.json", "definitions/c-hunter.json", "definitions/d-invalid-health.json"]);
  assert.equal(discovery.definitions[2]?.valid, true);
  assert.deepEqual(discovery.definitions[2]?.referencedRelativePaths, ["definitions/a-health.json", "definitions/b-stamina.json"]);
  assert.equal(discovery.definitions[3]?.valid, false);

  const inspection = await fetch(`${server.url}/api/definitions/inspect?file=${encodeURIComponent("definitions/c-hunter.json")}`).then((response) => response.json()) as Record<string, any>;
  assert.equal(inspection.summary.id, "hunter");
  assert.equal(inspection.summary.valid, true);
  assert.deepEqual(inspection.resolvedReferences.map((reference: Record<string, string>) => reference.relativePath), ["definitions/a-health.json", "definitions/b-stamina.json"]);
  assert.equal(inspection.authoredFields.some((field: Record<string, unknown>) => field.path === "healthFile"), true);
  assert.equal(inspection.validationFindings.length, 0);
  assert.deepEqual(inspection.raw, { schemaVersion: 1, kind: "hunter-profile", id: "hunter", displayName: "Hunter", healthFile: "definitions/a-health.json", staminaFile: "definitions/b-stamina.json" });

  const traversal = await fetch(`${server.url}/api/definitions/inspect?file=${encodeURIComponent("../outside.json")}`);
  assert.equal(traversal.status, 400);
  assert.equal(((await traversal.json()) as Record<string, any>).error.code, "EDITOR_PATH_INVALID");
  const protectedPath = await fetch(`${server.url}/api/definitions/inspect?file=${encodeURIComponent(".git/hidden.json")}`);
  assert.equal(protectedPath.status, 400);
  assert.equal(((await protectedPath.json()) as Record<string, any>).error.code, "EDITOR_PATH_INVALID");
  const method = await fetch(`${server.url}/api/health`, { method: "POST" });
  assert.equal(method.status, 405);
  assert.equal(((await method.json()) as Record<string, any>).error.code, "EDITOR_METHOD_NOT_ALLOWED");

  await server.close();
  await server.closed;
  await assert.rejects(fetch(`${server.url}/api/health`));
});

test("editor command parses stable defaults and server rejects external binding", async (context) => {
  const workspaceRoot = await createWorkspace(context);
  assert.deepEqual(parseCommand(["editor", "serve"]), { kind: "editor.serve", host: "127.0.0.1", port: 4310, json: false });
  assert.deepEqual(parseCommand(["editor", "serve", "--host", "localhost", "--port", "4400", "--workspace", "examples", "--json"]), { kind: "editor.serve", host: "localhost", port: 4400, workspace: "examples", json: true });
  await assert.rejects(startEditorServer({ workspaceRoot, host: "0.0.0.0", port: 0 }), /loopback-only/);
});

test("editor mutation routes enforce revisions, JSON limits, Host, and Origin", async (context) => {
  const workspaceRoot = await createWorkspace(context);
  await writeFile(path.join(workspaceRoot, "definitions", "movement.json"), `${JSON.stringify(editableMovement, null, 2)}\n`);
  const server = await startEditorServer({ workspaceRoot, port: 0 });
  context.after(() => server.close());

  const modelResponse = await fetch(`${server.url}/api/definitions/edit?file=${encodeURIComponent("definitions/movement.json")}`);
  assert.equal(modelResponse.status, 200);
  const model = await modelResponse.json() as Record<string, any>;
  assert.equal(model.kind, "movement-profile");
  assert.equal(model.editableFields.some((field: Record<string, unknown>) => field.path === "ground.runSpeed"), true);
  const readOnly = await fetch(`${server.url}/api/definitions/edit?file=${encodeURIComponent("definitions/a-health.json")}`);
  assert.equal(readOnly.status, 400);
  assert.equal(((await readOnly.json()) as Record<string, any>).error.code, "EDITOR_EDIT_UNSUPPORTED");

  const edit = { file: "definitions/movement.json", expectedRevision: model.revision, path: "ground.runSpeed", value: 6 };
  const preview = await fetch(`${server.url}/api/definitions/edit/preview`, { method: "POST", headers: { "Content-Type": "application/json", Origin: server.url }, body: JSON.stringify(edit) });
  assert.equal(preview.status, 200);
  assert.equal(((await preview.json()) as Record<string, unknown>).previewStatus, "passed");
  const save = await fetch(`${server.url}/api/definitions/edit/save`, { method: "POST", headers: { "Content-Type": "application/json", Origin: server.url }, body: JSON.stringify(edit) });
  assert.equal(save.status, 200);
  const saved = await save.json() as Record<string, any>;
  assert.equal(saved.saveStatus, "passed");
  const rollback = await fetch(`${server.url}/api/definitions/edit/rollback`, { method: "POST", headers: { "Content-Type": "application/json", Origin: server.url }, body: JSON.stringify({ file: edit.file, snapshotId: saved.snapshotId, expectedRevision: saved.currentRevision }) });
  assert.equal(rollback.status, 200);
  assert.equal(((await rollback.json()) as Record<string, unknown>).rollbackStatus, "rolled_back");

  const malformed = await fetch(`${server.url}/api/definitions/edit/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal(malformed.status, 400);
  assert.equal(((await malformed.json()) as Record<string, any>).error.code, "EDITOR_JSON_INVALID");
  const formBody = await fetch(`${server.url}/api/definitions/edit/preview`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "file=definitions%2Fmovement.json" });
  assert.equal(formBody.status, 415);
  assert.equal(((await formBody.json()) as Record<string, any>).error.code, "EDITOR_CONTENT_TYPE_INVALID");
  const oversized = await fetch(`${server.url}/api/definitions/edit/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ padding: "x".repeat(65_536) }) });
  assert.equal(oversized.status, 413);
  assert.equal(((await oversized.json()) as Record<string, any>).error.code, "EDITOR_BODY_TOO_LARGE");
  const badOrigin = await fetch(`${server.url}/api/definitions/edit/preview`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:1" }, body: JSON.stringify(edit) });
  assert.equal(badOrigin.status, 403);
  assert.equal(((await badOrigin.json()) as Record<string, any>).error.code, "EDITOR_ORIGIN_INVALID");
  const badHost = await postWithHost(`${server.url}/api/definitions/edit/preview`, "example.com", JSON.stringify(edit));
  assert.equal(badHost.status, 403);
  assert.equal((badHost.json.error as Record<string, unknown>).code, "EDITOR_HOST_INVALID");

  assert.equal((await fetch(`${server.url}/api/health`)).status, 200);
  assert.equal((await fetch(`${server.url}/api/definitions`)).status, 200);
});
