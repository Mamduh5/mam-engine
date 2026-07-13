import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { startEditorServer } from "../src/infrastructure/editor/editorServer";

test("editor serves the static visual shell and packages its assets", async (context) => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "mam-editor-client-"));
  context.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  const server = await startEditorServer({ workspaceRoot, port: 0 });
  context.after(() => server.close());

  const indexResponse = await fetch(server.url);
  const index = await indexResponse.text();
  assert.equal(indexResponse.headers.get("content-type"), "text/html; charset=utf-8");
  assert.match(index, /<header class="app-header">/);
  assert.match(index, /<aside class="definition-sidebar"/);
  assert.match(index, /<main id="inspector"/);
  assert.match(index, /id="definition-search"/);
  assert.doesNotMatch(index, /on(?:click|change|input)=/i);

  const stylesheet = await fetch(`${server.url}/styles.css`);
  assert.equal(stylesheet.status, 200);
  assert.equal((await stylesheet.text()).includes(":focus-visible"), true);
  const client = await fetch(`${server.url}/client.js`);
  assert.equal(client.status, 200);
  const clientScript = await client.text();
  assert.equal(clientScript.includes("/api/definitions/inspect"), true);
  for (const control of ["Edit", "Preview", "Save", "Cancel", "Undo last save", "Run simulation", "Simulate preview"]) assert.equal(clientScript.includes(`\"${control}\"`), true);
  for (const route of ["/api/definitions/edit/preview", "/api/definitions/edit/save", "/api/definitions/edit/rollback", "/api/definitions/simulation", "/api/definitions/simulation/run"]) assert.equal(clientScript.includes(route), true);
  for (const contract of ["availableScenarios", "acceptsCustomSeconds", "persistedSimulation", "metricComparison"]) assert.equal(clientScript.includes(contract), true);
  assert.equal(clientScript.includes("candidate: { path: selected.path, value: candidate }"), true);
  const head = await fetch(`${server.url}/client.js`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");

  const packageJson = JSON.parse(await readFile(path.resolve(__dirname, "../../package.json"), "utf8")) as { files: string[] };
  assert.equal(packageJson.files.includes("editor"), true);
});
