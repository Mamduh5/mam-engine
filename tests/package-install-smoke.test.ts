import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("packed v0.1 installs and exposes CLI examples plus the local editor", async (context) => {
  const sourceRoot = path.resolve(__dirname, "../..");
  const root = await mkdtemp(path.join(tmpdir(), "mam-package-smoke-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const packRoot = path.join(root, "pack");
  const installRoot = path.join(root, "installed");
  await mkdir(packRoot, { recursive: true });
  await mkdir(installRoot, { recursive: true });

  const packed = runNpm(["pack", "--json", "--pack-destination", packRoot], sourceRoot);
  const packRecords = JSON.parse(packed.stdout) as Array<{ filename: string }>;
  assert.equal(packRecords.length, 1);
  const tarball = path.join(packRoot, packRecords[0]?.filename ?? "");
  runNpm(["install", "--prefix", installRoot, "--ignore-scripts", "--no-audit", "--no-fund", "--omit=dev", "--prefer-offline", tarball], installRoot);

  const packageRoot = path.join(installRoot, "node_modules", "mam-engine");
  const packageJson = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8")) as { bin: { mam: string } };
  assert.equal(packageJson.bin.mam, "dist/src/cli/main.js");
  for (const required of [
    "editor/index.html", "editor/styles.css", "editor/client.js", "schemas/movement/v1.schema.json",
    "examples/movement/default.json", "runtime/godot/project.godot", "runtime/godot/scenes/movement_fixture.tscn",
    "runtime/godot/scripts/runtime_main.gd", "docs/capabilities-v0.1.json", "docs/release-readiness-v0.1.md"
  ]) await readFile(path.join(packageRoot, ...required.split("/")));
  assert.equal((await readdir(path.join(packageRoot, "schemas"))).length >= 16, true);

  const bin = process.platform === "win32" ? path.join(installRoot, "node_modules", ".bin", "mam.cmd") : path.join(installRoot, "node_modules", ".bin", "mam");
  const help = runInstalled(bin, ["--help"], installRoot);
  assert.match(help.stdout, /mam <command-group>/);
  const packagedExample = "examples/movement/default.json";
  const inspection = operation(runInstalled(bin, ["movement", "inspect", packagedExample, "--json"], packageRoot).stdout);
  assert.equal(inspection.command, "movement.inspect");
  assert.equal(inspection.status, "passed");
  const simulation = operation(runInstalled(bin, ["movement", "simulate", packagedExample, "--scenario", "accelerate", "--json"], packageRoot).stdout);
  assert.equal(simulation.command, "movement.simulate");
  assert.equal(simulation.status, "passed");

  const workspace = path.join(root, "workspace");
  await mkdir(workspace, { recursive: true });
  await copyFile(path.join(packageRoot, "examples", "movement", "default.json"), path.join(workspace, "movement.json"));
  const main = path.join(packageRoot, packageJson.bin.mam);
  const server = spawn(process.execPath, [main, "editor", "serve", "--host", "127.0.0.1", "--port", "0", "--workspace", workspace, "--json"], { cwd: installRoot, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  context.after(() => { if (server.exitCode === null && server.signalCode === null) server.kill("SIGTERM"); });
  const started = operation(await firstOutputLine(server));
  assert.equal(started.status, "passed");
  const url = (started.data as { url: string }).url;
  assert.equal((await fetch(`${url}/api/health`)).status, 200);
  for (const asset of ["/", "/styles.css", "/client.js"]) assert.equal((await fetch(`${url}${asset}`)).status, 200);
  const definitions = await fetch(`${url}/api/definitions`).then((response) => response.json()) as { definitions: Array<{ relativePath: string }> };
  assert.deepEqual(definitions.definitions.map((definition) => definition.relativePath), ["movement.json"]);
  const editorInspection = await fetch(`${url}/api/definitions/inspect?file=movement.json`).then((response) => response.json()) as { summary: { kind: string; valid: boolean } };
  assert.deepEqual(editorInspection.summary, { ...editorInspection.summary, kind: "movement-profile", valid: true });
  server.kill("SIGTERM");
  await processExit(server);
  await assert.rejects(fetch(`${url}/api/health`));
});

function runNpm(args: string[], cwd: string): { stdout: string } {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(command, args, { cwd, encoding: "utf8", shell: process.platform === "win32", windowsHide: true });
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  return { stdout: result.stdout };
}

function runInstalled(bin: string, args: string[], cwd: string): { stdout: string } {
  const result = spawnSync(bin, args, { cwd, encoding: "utf8", shell: process.platform === "win32", windowsHide: true });
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  return { stdout: result.stdout };
}

function operation(output: string): Record<string, unknown> { return JSON.parse(output.trim()) as Record<string, unknown>; }

function firstOutputLine(child: ChildProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("Installed editor did not report readiness")), 10_000);
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
      const newline = output.indexOf("\n");
      if (newline >= 0) { clearTimeout(timeout); resolve(output.slice(0, newline)); }
    });
    child.once("error", (error) => { clearTimeout(timeout); reject(error); });
    child.once("exit", (code, signal) => { if (!output.includes("\n")) { clearTimeout(timeout); reject(new Error(`Installed editor exited before readiness (${String(code)}, ${String(signal)})`)); } });
  });
}

function processExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Installed editor did not shut down")), 10_000);
    child.once("exit", () => { clearTimeout(timeout); resolve(); });
  });
}
