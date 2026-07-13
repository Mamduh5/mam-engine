import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createMovementProfile, initProject } from "../src/application/project/projectOperations";
import { GODOT_BUNDLE_FILE, GODOT_MANIFEST_FILE, installGodotConsumer, syncGodotConsumer } from "../src/application/godotConsumer/godotConsumerOperations";
import { atomicWriteText } from "../src/infrastructure/files/jsonFileStore";
import { ErrorCodes } from "../src/shared/errorCodes";
import { executeCli } from "../src/cli/main";

async function project(context: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "mam godot consumer "));
  context.after(() => rm(root, { recursive: true, force: true }));
  assert.equal((await initProject(root)).status, "passed");
  assert.equal((await createMovementProfile(root, "movement/player.json")).status, "passed");
  return root;
}

test("consumer CLI parses public install and check options", async () => {
  const install = await executeCli(["godot", "consumer", "install", "--project", "somewhere", "--json"]);
  assert.equal(install.result.command, "godot.consumer.install");
  const invalid = await executeCli(["godot", "consumer", "install", "--check", "--json"]);
  assert.equal(invalid.exitCode, 2);
});

test("install is scoped, deterministic, idempotent, and detects drift", async (context) => {
  const root = await project(context); const beforeProject = await readFile(path.join(root, "mam-project.json"), "utf8");
  const first = await installGodotConsumer(root); assert.equal(first.status, "passed"); assert.ok(first.changedFiles.includes(GODOT_MANIFEST_FILE));
  assert.equal(await readFile(path.join(root, "mam-project.json"), "utf8"), beforeProject);
  const second = await installGodotConsumer(root); assert.equal(second.status, "passed"); assert.deepEqual(second.changedFiles, []);
  const manifest = JSON.parse(await readFile(path.join(root, ...GODOT_MANIFEST_FILE.split("/")), "utf8")) as { files: { path: string }[] };
  assert.ok(manifest.files.every((file) => file.path.startsWith("addons/mam_engine/") && !/fixture|sandbox|hud|transport/i.test(file.path)));
  const managed = manifest.files[0]?.path as string; await writeFile(path.join(root, ...managed.split("/")), "local edit\n", "utf8");
  const drift = await installGodotConsumer(root); assert.equal(drift.status, "failed"); assert.equal(drift.errors[0]?.code, ErrorCodes.GodotConsumerManagedFileDrift);
});

test("install refuses an unowned conflict and leaves it byte-identical", async (context) => {
  const root = await project(context); const conflict = path.join(root, "addons", "mam_engine", "README.md"); await mkdir(path.dirname(conflict), { recursive: true }); await writeFile(conflict, "mine\n");
  const result = await installGodotConsumer(root); assert.equal(result.status, "failed"); assert.equal(result.errors[0]?.code, ErrorCodes.GodotConsumerUnownedConflict); assert.equal(await readFile(conflict, "utf8"), "mine\n");
});

test("install recovers exact prior state after an injected partial write failure", async (context) => {
  const root = await project(context); let writes = 0;
  const result = await installGodotConsumer(root, { writeText: async (file, content) => { writes += 1; if (writes === 2) throw new Error("injected write failure"); await atomicWriteText(file, content); } });
  assert.equal(result.status, "failed"); assert.equal((result.data as { recovery: { status: string } }).recovery.status, "restored"); assert.deepEqual(result.changedFiles, []);
});

test("sync writes deterministic exact-byte bundle and check detects missing, malformed, and stale state", async (context) => {
  const root = await project(context); assert.equal((await installGodotConsumer(root)).status, "passed");
  const missing = await syncGodotConsumer(root, true); assert.equal(missing.errors[0]?.code, ErrorCodes.GodotRuntimeBundleMissing);
  const first = await syncGodotConsumer(root, false); assert.equal(first.status, "passed"); assert.deepEqual(first.changedFiles, [GODOT_BUNDLE_FILE]);
  const bytes = await readFile(path.join(root, ...GODOT_BUNDLE_FILE.split("/")), "utf8"); assert.ok(bytes.endsWith("\n"));
  assert.equal((await syncGodotConsumer(root, true)).status, "passed"); assert.deepEqual((await syncGodotConsumer(root, false)).changedFiles, []);
  await writeFile(path.join(root, ...GODOT_BUNDLE_FILE.split("/")), "not json\n"); const malformed = await syncGodotConsumer(root, true); assert.equal(malformed.errors[0]?.code, ErrorCodes.GodotRuntimeBundleMalformed);
  await writeFile(path.join(root, ...GODOT_BUNDLE_FILE.split("/")), bytes.replace("payloadJson", "payloadJSON")); const stale = await syncGodotConsumer(root, true); assert.equal(stale.errors[0]?.code, ErrorCodes.GodotRuntimeBundleStale);
});

test("sync preserves the prior valid bundle on validation and write failures", async (context) => {
  const root = await project(context); await installGodotConsumer(root); await syncGodotConsumer(root, false); const bundle = path.join(root, ...GODOT_BUNDLE_FILE.split("/")); const before = await readFile(bundle, "utf8");
  const source = path.join(root, "definitions", "movement", "player.json"); const sourceBefore = await readFile(source, "utf8"); await writeFile(source, "{}\n"); const invalid = await syncGodotConsumer(root, false); assert.equal(invalid.status, "failed"); assert.equal(await readFile(bundle, "utf8"), before);
  const changed = JSON.parse(sourceBefore) as { ground: { runSpeed: number } }; changed.ground.runSpeed = 6; await writeFile(source, `${JSON.stringify(changed, null, 2)}\n`);
  let failed = false; const writeFailure = await syncGodotConsumer(root, false, { writeText: async (file, content) => { if (!failed) { failed = true; throw new Error("injected bundle write failure"); } await atomicWriteText(file, content); } });
  assert.equal(writeFailure.status, "failed"); assert.equal((writeFailure.data as { recovery: { status: string } }).recovery.status, "restored"); assert.equal(await readFile(bundle, "utf8"), before);
});
