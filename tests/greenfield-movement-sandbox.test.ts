import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { initProject } from "../src/application/project/projectOperations";
import { executeCli } from "../src/cli/main";
import { startEditorServer } from "../src/infrastructure/editor/editorServer";

async function emptyWorkspace(context: TestContext, prefix = "mam-greenfield-"): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  context.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("project init, movement create, and project validate form a safe greenfield workflow", async (context) => {
  const root = await emptyWorkspace(context);
  const initialized = await executeCli(["project", "init", "--json"], root);
  assert.equal(initialized.result.status, "passed", JSON.stringify(initialized.result));
  assert.deepEqual((await readdir(root)).sort(), [".gitignore", "README.md", "definitions", "mam-project.json"]);
  assert.deepEqual(await readdir(path.join(root, "definitions")), ["movement"]);
  assert.equal(await readFile(path.join(root, ".gitignore"), "utf8"), ".mam-engine/\n");

  const created = await executeCli(["movement", "create", "movement/player.json", "--json"], root);
  assert.equal(created.result.status, "passed", JSON.stringify(created.result));
  assert.deepEqual(created.result.changedFiles, ["definitions/movement/player.json", "mam-project.json"]);
  const movement = JSON.parse(await readFile(path.join(root, "definitions", "movement", "player.json"), "utf8")) as Record<string, any>;
  assert.equal(movement.kind, "movement-profile");
  assert.equal(movement.id, "player");
  assert.equal(movement.ground.runSpeed, 5.5);
  const manifest = JSON.parse(await readFile(path.join(root, "mam-project.json"), "utf8")) as Record<string, unknown>;
  assert.equal(manifest.entryMovementFile, "definitions/movement/player.json");

  const before = await readFile(path.join(root, "mam-project.json"), "utf8");
  const validated = await executeCli(["project", "validate", "--json"], root);
  assert.equal(validated.result.status, "passed", JSON.stringify(validated.result));
  assert.deepEqual(validated.result.changedFiles, []);
  assert.equal((validated.result.data as Record<string, unknown>).definitionCount, 1);
  assert.equal(await readFile(path.join(root, "mam-project.json"), "utf8"), before);

  const cameraCreated = await executeCli(["camera", "create", "camera/player.json", "--json"], root);
  assert.equal(cameraCreated.result.status, "passed", JSON.stringify(cameraCreated.result));
  assert.deepEqual(cameraCreated.result.changedFiles, ["definitions/camera/player.json", "mam-project.json"]);
  const camera = JSON.parse(await readFile(path.join(root, "definitions", "camera", "player.json"), "utf8")) as Record<string, any>;
  assert.equal(camera.kind, "camera-profile");
  assert.equal(camera.id, "player");
  assert.equal(camera.orbit.yawSpeedDegreesPerSecond, 180);
  assert.equal(camera.follow.distance, 6);
  assert.equal(camera.lens.fieldOfViewDegrees, 65);
  const cameraManifest = JSON.parse(await readFile(path.join(root, "mam-project.json"), "utf8")) as Record<string, unknown>;
  assert.equal(cameraManifest.entryCameraFile, "definitions/camera/player.json");
  const cameraValidated = await executeCli(["project", "validate", "--json"], root);
  assert.equal(cameraValidated.result.status, "passed", JSON.stringify(cameraValidated.result));
  assert.equal((cameraValidated.result.data as Record<string, unknown>).definitionCount, 2);
  assert.equal((cameraValidated.result.data as Record<string, unknown>).entryCameraValid, true);

  const targetingCreated = await executeCli(["targeting", "create", "targeting/player.json", "--json"], root);
  assert.equal(targetingCreated.result.status, "passed", JSON.stringify(targetingCreated.result));
  assert.deepEqual(targetingCreated.result.changedFiles, ["definitions/targeting/player.json", "mam-project.json"]);
  const targeting = JSON.parse(await readFile(path.join(root, "definitions", "targeting", "player.json"), "utf8")) as Record<string, any>;
  assert.equal(targeting.kind, "targeting-profile"); assert.equal(targeting.id, "player"); assert.equal(targeting.acquisition.maximumDistance, 30); assert.equal(targeting.retention.lostTargetGraceSeconds, 0.5);
  const targetingManifest = JSON.parse(await readFile(path.join(root, "mam-project.json"), "utf8")) as Record<string, unknown>;
  assert.equal(targetingManifest.entryTargetingFile, "definitions/targeting/player.json");
  const targetingValidated = await executeCli(["project", "validate", "--json"], root);
  assert.equal(targetingValidated.result.status, "passed", JSON.stringify(targetingValidated.result)); assert.equal((targetingValidated.result.data as Record<string, unknown>).entryTargetingValid, true);
  await rm(path.join(root, "definitions", "camera", "player.json"));
  const recreated = await executeCli(["camera", "create", "camera/player.json", "--json"], root);
  assert.equal(recreated.result.status, "passed", JSON.stringify(recreated.result));
  assert.deepEqual(recreated.result.changedFiles, ["definitions/camera/player.json"]);

  const overwrite = await executeCli(["movement", "create", "movement/player.json", "--json"], root);
  assert.equal(overwrite.result.status, "failed");
  const traversal = await executeCli(["movement", "create", "../outside.json", "--json"], root);
  assert.equal(traversal.result.status, "failed");
  await assert.rejects(readFile(path.join(root, "outside.json")));
  assert.equal((await executeCli(["camera", "create", "camera/player.json", "--json"], root)).result.status, "failed");
  assert.equal((await executeCli(["camera", "create", "../outside-camera.json", "--json"], root)).result.status, "failed");
  assert.equal((await executeCli(["camera", "create", "C:/outside-camera.json", "--json"], root)).result.status, "failed");
  assert.equal((await executeCli(["targeting", "create", "targeting/player.json", "--json"], root)).result.status, "failed");
  assert.equal((await executeCli(["targeting", "create", "../outside-targeting.json", "--json"], root)).result.status, "failed");
  assert.equal((await executeCli(["targeting", "create", "C:/outside-targeting.json", "--json"], root)).result.status, "failed");
  await assert.rejects(readFile(path.join(root, "outside-camera.json")));
  assert.equal((await executeCli(["project", "init", "--json"], root)).result.status, "failed");
});

test("project validation accepts legacy manifests and rejects invalid optional production entries", async (context) => {
  const root = await emptyWorkspace(context);
  assert.equal((await initProject(root)).status, "passed");
  assert.equal((await executeCli(["movement", "create", "movement/player.json", "--json"], root)).result.status, "passed");
  const manifestPath = path.join(root, "mam-project.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  delete manifest.entryCameraFile;
  delete manifest.entryTargetingFile;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const legacy = await executeCli(["project", "validate", "--json"], root);
  assert.equal(legacy.result.status, "passed", JSON.stringify(legacy.result));
  assert.equal((legacy.result.data as Record<string, unknown>).entryCameraValid, false);
  assert.equal((legacy.result.data as Record<string, unknown>).entryTargetingValid, false);

  manifest.entryCameraFile = "camera/player.json";
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  let invalid = await executeCli(["project", "validate", "--json"], root);
  assert.equal(invalid.result.status, "failed");
  assert.equal((invalid.result.data as Record<string, any>).findings.some((finding: Record<string, string>) => finding.code === "PROJECT_ENTRY_CAMERA_INVALID" && finding.path === "entryCameraFile"), true);

  manifest.entryCameraFile = manifest.entryMovementFile;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  invalid = await executeCli(["project", "validate", "--json"], root);
  assert.equal(invalid.result.status, "failed");
  assert.equal((invalid.result.data as Record<string, any>).findings.some((finding: Record<string, string>) => finding.code === "PROJECT_ENTRY_CAMERA_INVALID" && finding.file === manifest.entryMovementFile), true);

  delete manifest.entryCameraFile; manifest.entryTargetingFile = "targeting/player.json";
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  invalid = await executeCli(["project", "validate", "--json"], root);
  assert.equal(invalid.result.status, "failed"); assert.equal((invalid.result.data as Record<string, any>).findings.some((finding: Record<string, string>) => finding.code === "PROJECT_ENTRY_TARGETING_INVALID" && finding.path === "entryTargetingFile"), true);
  manifest.entryTargetingFile = manifest.entryMovementFile; await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  invalid = await executeCli(["project", "validate", "--json"], root);
  assert.equal((invalid.result.data as Record<string, any>).findings.some((finding: Record<string, string>) => finding.code === "PROJECT_ENTRY_TARGETING_INVALID" && finding.file === manifest.entryMovementFile), true);
});

test("project validation rejects invalid definitions and an unconfigured entry read-only", async (context) => {
  const root = await emptyWorkspace(context);
  assert.equal((await initProject(root)).status, "passed");
  let result = await executeCli(["project", "validate", "--json"], root);
  assert.equal(result.result.status, "failed");
  assert.equal((result.result.data as Record<string, any>).findings[0].code, "PROJECT_ENTRY_MOVEMENT_INVALID");
  await writeFile(path.join(root, "definitions", "movement", "bad.json"), JSON.stringify({ schemaVersion: 1, kind: "movement-profile", id: "bad" }));
  result = await executeCli(["project", "validate", "--json"], root);
  assert.equal(result.result.status, "failed");
  assert.equal((result.result.data as Record<string, any>).findings.some((finding: Record<string, string>) => finding.file === "definitions/movement/bad.json"), true);
  assert.deepEqual(result.result.changedFiles, []);
});

test("loopback editor creates the first movement profile and exposes sandbox play only for a valid project", async (context) => {
  const root = await emptyWorkspace(context);
  assert.equal((await initProject(root)).status, "passed");
  const server = await startEditorServer({ workspaceRoot: root, port: 0 });
  context.after(() => server.close());
  const shell = await fetch(server.url).then((response) => response.text());
  assert.match(shell, /id="project-actions"/);
  const client = await fetch(`${server.url}/client.js`).then((response) => response.text());
  for (const contract of ["Create movement profile", "Play movement sandbox", "/api/project/movement/create", "/api/project/play"]) assert.equal(client.includes(contract), true);
  const before = await fetch(`${server.url}/api/project`).then((response) => response.json()) as Record<string, unknown>;
  assert.equal(before.valid, false);
  const response = await fetch(`${server.url}/api/project/movement/create`, { method: "POST", headers: { "Content-Type": "application/json", Origin: server.url }, body: JSON.stringify({ file: "movement/player.json" }) });
  assert.equal(response.status, 200);
  const created = await response.json() as Record<string, any>;
  assert.equal(created.status, "passed");
  assert.equal(created.data.file, "definitions/movement/player.json");
  const after = await fetch(`${server.url}/api/project`).then((item) => item.json()) as Record<string, unknown>;
  assert.equal(after.valid, true);
});

test("packed install initializes and validates a separate consumer without copied engine assets", async (context) => {
  const sourceRoot = path.resolve(__dirname, "../..");
  const root = await emptyWorkspace(context, "mam-greenfield-packed-");
  const packRoot = path.join(root, "pack");
  const installRoot = path.join(root, "installed");
  const workspace = path.join(root, "consumer");
  await Promise.all([mkdir(packRoot), mkdir(installRoot), mkdir(workspace)]);
  const packed = run(npmExecutable(), ["pack", "--json", "--pack-destination", packRoot], sourceRoot);
  const tarball = path.join(packRoot, (JSON.parse(packed) as Array<{ filename: string }>)[0]?.filename ?? "");
  run(npmExecutable(), ["install", "--prefix", installRoot, "--ignore-scripts", "--no-audit", "--no-fund", "--omit=dev", "--prefer-offline", tarball], installRoot);
  const bin = path.join(installRoot, "node_modules", ".bin", process.platform === "win32" ? "mam.cmd" : "mam");
  operation(run(bin, ["project", "init", "--json"], workspace));
  operation(run(bin, ["movement", "create", "movement/player.json", "--json"], workspace));
  const validation = operation(run(bin, ["project", "validate", "--json"], workspace));
  assert.equal(validation.status, "passed");
  await assert.rejects(readFile(path.join(workspace, "examples", "movement", "default.json")));
  await assert.rejects(readFile(path.join(workspace, "runtime", "godot", "project.godot")));

  const editor = spawn(bin, ["editor", "serve", "--port", "0", "--json"], { cwd: workspace, stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32", windowsHide: true });
  context.after(() => stopChild(editor));
  const output = await firstLine(editor);
  const editorResult = operation(output);
  const editorUrl = (editorResult.data as Record<string, string>).url;
  if (editorUrl === undefined) throw new Error("installed editor did not report a URL");
  assert.equal((await fetch(editorUrl)).status, 200);
  await stopChild(editor);
});

function run(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", shell: process.platform === "win32" && command.endsWith(".cmd"), windowsHide: true });
  if (result.error !== undefined) throw result.error;
  const diagnostic = `command: ${command} ${args.join(" ")}\nstderr:\n${result.stderr}\nstdout:\n${result.stdout}`;
  assert.equal(typeof result.status, "number", diagnostic);
  assert.equal(result.status, 0, diagnostic);
  return result.stdout;
}

function npmExecutable(): string { return process.platform === "win32" ? "npm.cmd" : "npm"; }

function operation(output: string): Record<string, any> { return JSON.parse(output.trim()) as Record<string, any>; }

function firstLine(child: ReturnType<typeof spawn>): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("editor did not report readiness")), 10_000);
    child.once("error", reject);
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
      const lineEnd = output.indexOf("\n");
      if (lineEnd >= 0) { clearTimeout(timeout); resolve(output.slice(0, lineEnd)); }
    });
  });
}

async function stopChild(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  if (process.platform === "win32" && child.pid !== undefined) {
    const result = spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { encoding: "utf8", windowsHide: true });
    if (result.error !== undefined) throw result.error;
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  } else {
    child.kill();
  }
  await exited;
}
