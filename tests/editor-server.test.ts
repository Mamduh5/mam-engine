import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { parseCommand } from "../src/cli/commandParser";
import { startEditorServer } from "../src/infrastructure/editor/editorServer";

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
