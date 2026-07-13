import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const godot = process.env.MAM_GODOT_BIN;

test("packed production consumer runs without npm or engine runtime fixtures", { skip: godot === undefined }, async (context) => {
  const sourceRoot = path.resolve(__dirname, "../../.."); const root = await mkdtemp(path.join(tmpdir(), "mam-consumer-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const pack = path.join(root, "pack"); const prefix = path.join(root, "npm-prefix"); const consumer = path.join(root, "consumer game with spaces"); await mkdir(pack); await mkdir(prefix);
  const packed = run(process.platform === "win32" ? "npm.cmd" : "npm", ["pack", "--json", "--pack-destination", pack], sourceRoot);
  const filename = (JSON.parse(packed) as { filename: string }[])[0]?.filename as string;
  run(process.platform === "win32" ? "npm.cmd" : "npm", ["install", "--prefix", prefix, "--ignore-scripts", "--no-audit", "--no-fund", "--omit=dev", path.join(pack, filename)], prefix);
  const bin = process.platform === "win32" ? path.join(prefix, "node_modules", ".bin", "mam.cmd") : path.join(prefix, "node_modules", ".bin", "mam");
  run(bin, ["project", "init", consumer, "--json"], root); run(bin, ["movement", "create", "movement/player.json", "--json"], consumer);
  await writeFile(path.join(consumer, "project.godot"), "[application]\nconfig/name=\"mam external production consumer\"\nrun/main_scene=\"res://Main.tscn\"\n[display]\nwindow/size/viewport_width=640\nwindow/size/viewport_height=360\n[physics]\ncommon/physics_ticks_per_second=60\n[rendering]\nrenderer/rendering_method=\"gl_compatibility\"\n", "utf8");
  await writeFile(path.join(consumer, "Main.tscn"), "[gd_scene load_steps=2 format=3]\n\n[ext_resource path=\"res://main.gd\" type=\"Script\" id=\"1\"]\n\n[node name=\"Main\" type=\"Node3D\"]\nscript = ExtResource(\"1\")\n", "utf8");
  await copyFile(path.join(sourceRoot, "tests", "godot", "production_consumer_main.gd"), path.join(consumer, "main.gd"));
  const install1 = operation(run(bin, ["godot", "consumer", "install", "--json"], consumer)); const install2 = operation(run(bin, ["godot", "consumer", "install", "--json"], consumer));
  assert.ok((install1.changedFiles as string[]).length >= 4); assert.deepEqual(install2.changedFiles, []);
  const sync1 = operation(run(bin, ["godot", "consumer", "sync", "--json"], consumer)); const sync2 = operation(run(bin, ["godot", "consumer", "sync", "--json"], consumer)); const check = operation(run(bin, ["godot", "consumer", "sync", "--check", "--json"], consumer));
  assert.deepEqual(sync1.changedFiles, ["mam_generated/mam_runtime_bundle.json"]); assert.deepEqual(sync2.changedFiles, []); assert.equal(check.status, "passed");
  assert.equal(await absent(path.join(consumer, "addons", "mam_engine", "scenes")), true); assert.equal(await absent(path.join(consumer, "addons", "mam_engine", "fixtures")), true);
  await rm(prefix, { recursive: true, force: true }); assert.equal(await absent(prefix), true);
  const validResult = path.join(root, "valid result.json"); run(godot as string, ["--headless", "--path", consumer, "--", "--result", validResult], consumer);
  const valid = JSON.parse(await readFile(validResult, "utf8")) as { status: string; data: Record<string, number | string | boolean> }; assert.equal(valid.status, "passed");
  context.diagnostic(`production consumer metrics ${JSON.stringify(valid.data)}`);
  assert.equal(valid.data.bind, "passed"); assert.equal(valid.data.duplicateBind, "MAM_BIND_BODY_OWNED"); assert.equal(valid.data.incompleteBind, "MAM_BIND_PROFILE_INVALID"); assert.equal(valid.data.incompleteStep, "MAM_STEP_INPUT_INVALID"); assert.ok(Number(valid.data.acceleratedSpeed) > 5); assert.ok(Number(valid.data.stoppedSpeed) < 0.001); assert.ok(Number(valid.data.cameraBasisX) > 1); assert.ok(Number(valid.data.sprintSpeed) > 5.5); assert.ok(Number(valid.data.sprintStamina) < Number(valid.data.sprintStartStamina)); assert.ok(Number(valid.data.regeneratedStamina) > Number(valid.data.sprintStamina)); assert.ok(Math.abs(Number(valid.data.dodgeDistance) - 4.2) < 0.08); assert.equal(valid.data.dodgeAcceptedCount, 1); assert.equal(valid.data.iframeObserved, true); assert.equal(valid.data.missingBundleCode, "MAM_BUNDLE_MISSING"); assert.equal(valid.data.invalidBundleCode, "MAM_BUNDLE_INTEGRITY_MISMATCH"); assert.equal(valid.data.unbind, "passed");
  const source = path.join(consumer, "definitions", "movement", "player.json"); await writeFile(source, `${await readFile(source, "utf8")} `);
  const staleResult = path.join(root, "stale result.json"); run(godot as string, ["--headless", "--path", consumer, "--", "--result", staleResult], consumer); const stale = JSON.parse(await readFile(staleResult, "utf8")) as { status: string; diagnostics: { code: string }[] }; assert.equal(stale.status, "failed"); assert.equal(stale.diagnostics[0]?.code, "MAM_SOURCE_HASH_MISMATCH");
});

function run(command: string, args: string[], cwd: string): string { const shell = process.platform === "win32" && command.endsWith(".cmd"); const processArgs = shell ? args.map((arg) => /\s/.test(arg) ? `"${arg}"` : arg) : args; const result = spawnSync(command, processArgs, { cwd, encoding: "utf8", shell, windowsHide: true, timeout: 120_000 }); assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`); return result.stdout; }
function operation(output: string): Record<string, unknown> { return JSON.parse(output.trim()) as Record<string, unknown>; }
async function absent(file: string): Promise<boolean> { try { await readFile(file); return false; } catch (caught) { return (caught as NodeJS.ErrnoException).code === "ENOENT" || (caught as NodeJS.ErrnoException).code === "EISDIR" ? (await import("node:fs/promises")).stat(file).then(() => false, () => true) : false; } }
