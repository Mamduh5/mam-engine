import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createMovementProfile, initProject } from "../src/application/project/projectOperations";
import { GODOT_ADAPTER_CONTRACT, GODOT_BUNDLE_FILE, GODOT_CAMERA_ADAPTER_CONTRACT, GODOT_CAMERA_BUNDLE_FILE, GODOT_CAMERA_RUNTIME_BUNDLE_SCHEMA, GODOT_MANIFEST_FILE, GODOT_RUNTIME_BUNDLE_SCHEMA, GODOT_TARGETING_ADAPTER_CONTRACT, GODOT_TARGETING_BUNDLE_FILE, GODOT_TARGETING_RUNTIME_BUNDLE_SCHEMA, installGodotConsumer, syncGodotConsumer } from "../src/application/godotConsumer/godotConsumerOperations";
import { atomicWriteText } from "../src/infrastructure/files/jsonFileStore";
import { ErrorCodes } from "../src/shared/errorCodes";
import { executeCli } from "../src/cli/main";

const CAMERA_SOURCE_FILE = "definitions/camera/player.json";
const TARGETING_SOURCE_FILE = "definitions/targeting/player.json";

async function project(context: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "mam godot consumer "));
  context.after(() => rm(root, { recursive: true, force: true }));
  assert.equal((await initProject(root)).status, "passed");
  assert.equal((await createMovementProfile(root, "movement/player.json")).status, "passed");
  return root;
}

async function configureCamera(root: string): Promise<string> {
  const content = await readFile(path.resolve(__dirname, "../..", "examples", "camera", "default.json"), "utf8");
  const target = path.join(root, ...CAMERA_SOURCE_FILE.split("/")); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, content, "utf8");
  const manifestPath = path.join(root, "mam-project.json"); const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>; manifest.entryCameraFile = CAMERA_SOURCE_FILE; await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return content;
}

async function configureTargeting(root: string): Promise<string> {
  const content = await readFile(path.resolve(__dirname, "../..", "examples", "targeting", "default.json"), "utf8");
  const target = path.join(root, ...TARGETING_SOURCE_FILE.split("/")); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, content, "utf8");
  const manifestPath = path.join(root, "mam-project.json"); const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>; manifest.entryTargetingFile = TARGETING_SOURCE_FILE; await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return content;
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

test("sync writes a separate deterministic camera bundle and check verifies every configured bundle", async (context) => {
  const root = await project(context); const cameraSource = await configureCamera(root); assert.equal((await installGodotConsumer(root)).status, "passed");
  const missing = await syncGodotConsumer(root, true); assert.equal(missing.status, "failed"); assert.deepEqual(missing.errors.map((error) => error.path), [GODOT_BUNDLE_FILE, GODOT_CAMERA_BUNDLE_FILE]);
  const first = await syncGodotConsumer(root, false); assert.equal(first.status, "passed"); assert.deepEqual(first.changedFiles, [GODOT_CAMERA_BUNDLE_FILE, GODOT_BUNDLE_FILE]);
  const movementBytes = await readFile(path.join(root, ...GODOT_BUNDLE_FILE.split("/")), "utf8"); const movementBundle = JSON.parse(movementBytes) as { schemaVersion: string; payloadJson: string };
  assert.equal(movementBundle.schemaVersion, GODOT_RUNTIME_BUNDLE_SCHEMA); assert.equal((JSON.parse(movementBundle.payloadJson) as { adapterContractVersion: string }).adapterContractVersion, GODOT_ADAPTER_CONTRACT);
  const cameraPath = path.join(root, ...GODOT_CAMERA_BUNDLE_FILE.split("/")); const cameraBytes = await readFile(cameraPath, "utf8"); assert.ok(cameraBytes.endsWith("\n"));
  const cameraBundle = JSON.parse(cameraBytes) as { schemaVersion: string; payloadJson: string; integrity: { algorithm: string; payloadSha256: string } }; const payload = JSON.parse(cameraBundle.payloadJson) as { adapterContractVersion: string; definition: { kind: string; schemaVersion: number; sourcePath: string; sourceSha256: string; profile: { kind: string } } };
  assert.equal(cameraBundle.schemaVersion, GODOT_CAMERA_RUNTIME_BUNDLE_SCHEMA); assert.equal(cameraBundle.integrity.algorithm, "sha256"); assert.equal(cameraBundle.integrity.payloadSha256, sha256(cameraBundle.payloadJson));
  assert.equal(payload.adapterContractVersion, GODOT_CAMERA_ADAPTER_CONTRACT); assert.equal(payload.definition.kind, "camera-profile"); assert.equal(payload.definition.schemaVersion, 1); assert.equal(payload.definition.sourcePath, CAMERA_SOURCE_FILE); assert.equal(payload.definition.sourceSha256, sha256(cameraSource)); assert.equal(payload.definition.profile.kind, "camera-profile");
  assert.equal((first.data as { cameraBundle: { bundleFile: string } }).cameraBundle.bundleFile, GODOT_CAMERA_BUNDLE_FILE); assert.equal((await syncGodotConsumer(root, true)).status, "passed"); assert.deepEqual((await syncGodotConsumer(root, false)).changedFiles, []);
  await rm(cameraPath); const cameraMissing = await syncGodotConsumer(root, true); assert.deepEqual(cameraMissing.errors.map((error) => error.path), [GODOT_CAMERA_BUNDLE_FILE]);
  assert.deepEqual((await syncGodotConsumer(root, false)).changedFiles, [GODOT_CAMERA_BUNDLE_FILE]); assert.equal(await readFile(cameraPath, "utf8"), cameraBytes);
  await writeFile(cameraPath, "not json\n"); const malformed = await syncGodotConsumer(root, true); assert.equal(malformed.errors[0]?.code, ErrorCodes.GodotRuntimeBundleMalformed); assert.equal(malformed.errors[0]?.path, GODOT_CAMERA_BUNDLE_FILE);
  await writeFile(cameraPath, cameraBytes.replace("payloadJson", "payloadJSON")); const stale = await syncGodotConsumer(root, true); assert.equal(stale.errors[0]?.code, ErrorCodes.GodotRuntimeBundleStale); assert.equal(stale.errors[0]?.path, GODOT_CAMERA_BUNDLE_FILE);
});

test("sync writes a separate deterministic targeting bundle and check verifies configured targeting", async (context) => {
  const root = await project(context); const targetingSource = await configureTargeting(root); assert.equal((await installGodotConsumer(root)).status, "passed");
  const missing = await syncGodotConsumer(root, true); assert.equal(missing.status, "failed"); assert.deepEqual(missing.errors.map((error) => error.path), [GODOT_BUNDLE_FILE, GODOT_TARGETING_BUNDLE_FILE]);
  const first = await syncGodotConsumer(root, false); assert.equal(first.status, "passed"); assert.deepEqual(first.changedFiles, [GODOT_BUNDLE_FILE, GODOT_TARGETING_BUNDLE_FILE]);
  const targetPath = path.join(root, ...GODOT_TARGETING_BUNDLE_FILE.split("/")); const bytes = await readFile(targetPath, "utf8"); assert.ok(bytes.endsWith("\n"));
  const bundle = JSON.parse(bytes) as { schemaVersion: string; payloadJson: string; integrity: { payloadSha256: string } }; const payload = JSON.parse(bundle.payloadJson) as { adapterContractVersion: string; definition: { kind: string; schemaVersion: number; sourcePath: string; sourceSha256: string; profile: { kind: string } } };
  assert.equal(bundle.schemaVersion, GODOT_TARGETING_RUNTIME_BUNDLE_SCHEMA); assert.equal(bundle.integrity.payloadSha256, sha256(bundle.payloadJson)); assert.equal(payload.adapterContractVersion, GODOT_TARGETING_ADAPTER_CONTRACT); assert.equal(payload.definition.kind, "targeting-profile"); assert.equal(payload.definition.schemaVersion, 1); assert.equal(payload.definition.sourcePath, TARGETING_SOURCE_FILE); assert.equal(payload.definition.sourceSha256, sha256(targetingSource)); assert.equal(payload.definition.profile.kind, "targeting-profile");
  assert.equal((first.data as { targetingBundle: { bundleFile: string } }).targetingBundle.bundleFile, GODOT_TARGETING_BUNDLE_FILE); assert.equal((await syncGodotConsumer(root, true)).status, "passed"); assert.deepEqual((await syncGodotConsumer(root, false)).changedFiles, []);
  await rm(targetPath); const targetMissing = await syncGodotConsumer(root, true); assert.deepEqual(targetMissing.errors.map((error) => error.path), [GODOT_TARGETING_BUNDLE_FILE]); assert.deepEqual((await syncGodotConsumer(root, false)).changedFiles, [GODOT_TARGETING_BUNDLE_FILE]);
  await writeFile(targetPath, "not json\n"); const malformed = await syncGodotConsumer(root, true); assert.equal(malformed.errors[0]?.code, ErrorCodes.GodotRuntimeBundleMalformed); assert.equal(malformed.errors[0]?.path, GODOT_TARGETING_BUNDLE_FILE);
});

test("sync preserves the prior valid bundle on validation and write failures", async (context) => {
  const root = await project(context); await installGodotConsumer(root); await syncGodotConsumer(root, false); const bundle = path.join(root, ...GODOT_BUNDLE_FILE.split("/")); const before = await readFile(bundle, "utf8");
  const source = path.join(root, "definitions", "movement", "player.json"); const sourceBefore = await readFile(source, "utf8"); await writeFile(source, "{}\n"); const invalid = await syncGodotConsumer(root, false); assert.equal(invalid.status, "failed"); assert.equal(await readFile(bundle, "utf8"), before);
  const changed = JSON.parse(sourceBefore) as { ground: { runSpeed: number } }; changed.ground.runSpeed = 6; await writeFile(source, `${JSON.stringify(changed, null, 2)}\n`);
  let failed = false; const writeFailure = await syncGodotConsumer(root, false, { writeText: async (file, content) => { if (!failed) { failed = true; throw new Error("injected bundle write failure"); } await atomicWriteText(file, content); } });
  assert.equal(writeFailure.status, "failed"); assert.equal((writeFailure.data as { recovery: { status: string } }).recovery.status, "restored"); assert.equal(await readFile(bundle, "utf8"), before);
});

test("sync validates camera before writes and rolls back both bundles after a partial write failure", async (context) => {
  const root = await project(context); const cameraSource = await configureCamera(root); await installGodotConsumer(root); await syncGodotConsumer(root, false);
  const movementBundle = path.join(root, ...GODOT_BUNDLE_FILE.split("/")); const cameraBundle = path.join(root, ...GODOT_CAMERA_BUNDLE_FILE.split("/")); const movementBefore = await readFile(movementBundle, "utf8"); const cameraBefore = await readFile(cameraBundle, "utf8");
  const movementSource = path.join(root, "definitions", "movement", "player.json"); const movement = JSON.parse(await readFile(movementSource, "utf8")) as { ground: { runSpeed: number } }; movement.ground.runSpeed += 0.5; await writeFile(movementSource, `${JSON.stringify(movement, null, 2)}\n`);
  const cameraSourcePath = path.join(root, ...CAMERA_SOURCE_FILE.split("/")); await writeFile(cameraSourcePath, "{}\n"); const invalid = await syncGodotConsumer(root, false); assert.equal(invalid.status, "failed"); assert.equal(await readFile(movementBundle, "utf8"), movementBefore); assert.equal(await readFile(cameraBundle, "utf8"), cameraBefore);
  const camera = JSON.parse(cameraSource) as { lens: { fieldOfViewDegrees: number } }; camera.lens.fieldOfViewDegrees += 1; await writeFile(cameraSourcePath, `${JSON.stringify(camera, null, 2)}\n`);
  let writes = 0; const writeFailure = await syncGodotConsumer(root, false, { writeText: async (file, content) => { writes += 1; if (writes === 2) throw new Error("injected second bundle write failure"); await atomicWriteText(file, content); } });
  assert.equal(writeFailure.status, "failed"); assert.equal((writeFailure.data as { recovery: { status: string } }).recovery.status, "restored"); assert.deepEqual(writeFailure.changedFiles, []); assert.equal(await readFile(movementBundle, "utf8"), movementBefore); assert.equal(await readFile(cameraBundle, "utf8"), cameraBefore);
});

function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
