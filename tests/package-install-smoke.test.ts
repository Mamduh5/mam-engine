import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("packed v0.4 works from a separate consumer workspace", async (context) => {
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
    "examples/movement/default.json", "examples/camera/default.json", "runtime/godot/project.godot", "runtime/godot/scenes/movement_fixture.tscn",
    "runtime/godot/addons/mam_engine/runtime/mam_runtime_bundle_loader.gd", "runtime/godot/addons/mam_engine/runtime/mam_movement_runtime.gd",
    "runtime/godot/addons/mam_engine/runtime/mam_camera_bundle_loader.gd", "runtime/godot/addons/mam_engine/runtime/mam_camera_core.gd", "runtime/godot/addons/mam_engine/runtime/mam_camera_runtime.gd",
    "runtime/godot/addons/mam_engine/runtime/mam_targeting_bundle_loader.gd", "runtime/godot/addons/mam_engine/runtime/mam_targeting_core.gd", "runtime/godot/addons/mam_engine/runtime/mam_targeting_runtime.gd",
    "runtime/godot/scripts/runtime_main.gd", "docs/capabilities-v0.1.json", "docs/release-readiness-v0.1.md"
  ]) await readFile(path.join(packageRoot, ...required.split("/")));
  assert.equal((await readdir(path.join(packageRoot, "schemas"))).length >= 16, true);

  const bin = process.platform === "win32" ? path.join(installRoot, "node_modules", ".bin", "mam.cmd") : path.join(installRoot, "node_modules", ".bin", "mam");
  const workspace = path.join(root, "workspace");
  await mkdir(workspace, { recursive: true });
  const sourceDefinition = await readFile(path.join(packageRoot, "examples", "movement", "default.json"), "utf8");
  await copyFile(path.join(packageRoot, "examples", "movement", "default.json"), path.join(workspace, "movement.json"));

  const help = runInstalled(bin, ["--help"], workspace);
  assert.match(help.stdout, /mam <command-group>/);
  const movementHelp = runInstalled(bin, ["movement", "--help"], workspace);
  assert.match(movementHelp.stdout, /mam movement runtime-test <file>/);
  if (process.env.MAM_GODOT_BIN !== undefined) {
    const runtimeCheck = operation(runInstalled(bin, ["runtime", "check", "--json"], workspace).stdout);
    assert.equal(runtimeCheck.status, "passed");
    assert.equal((runtimeCheck.data as { headlessSmokePassed: boolean }).headlessSmokePassed, true);
    const runtimeProof = operation(runInstalled(bin, ["movement", "runtime-test", "movement.json", "--scenario", "accelerate", "--seconds", "2", "--json"], workspace).stdout);
    assert.equal(runtimeProof.status, "passed");
    assert.equal(((runtimeProof.data as { comparison: { passed: boolean } }).comparison).passed, true);
  }
  await assert.rejects(readFile(path.join(workspace, "runtime", "godot", "project.godot")));
  assert.equal(await readFile(path.join(workspace, "movement.json"), "utf8"), sourceDefinition);
  assert.deepEqual(await runtimeSessions(workspace), []);

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

async function runtimeSessions(workspace: string): Promise<string[]> {
  try { return await readdir(path.join(workspace, ".mam-engine", "runtime-sessions")); }
  catch (caught) { if ((caught as NodeJS.ErrnoException).code === "ENOENT") return []; throw caught; }
}
