import assert from "node:assert/strict";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";

import { discoverGodot, GodotDiscoveryError, resolveGodotExecutablePath } from "../src/infrastructure/runtime/godotDiscovery";
import { parseGodotVersion } from "../src/infrastructure/runtime/godotVersion";
import { ErrorCodes } from "../src/shared/errorCodes";

async function fakeExecutable(root: string, name: string): Promise<string> {
  const file = path.join(root, name);
  await writeFile(file, "fake", "utf8");
  if (process.platform !== "win32") await chmod(file, 0o755);
  return file;
}

test("Godot discovery precedence is explicit, environment, then PATH", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "mam-godot-discovery-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const explicit = await fakeExecutable(root, process.platform === "win32" ? "explicit.exe" : "explicit");
  const environment = await fakeExecutable(root, process.platform === "win32" ? "environment.exe" : "environment");
  const pathDirectory = path.join(root, "path"); await mkdir(pathDirectory);
  await fakeExecutable(pathDirectory, process.platform === "win32" ? "godot.exe" : "godot");
  assert.equal((await resolveGodotExecutablePath(explicit, { MAM_GODOT_BIN: environment, PATH: pathDirectory })).source, "explicit");
  assert.equal((await resolveGodotExecutablePath(undefined, { MAM_GODOT_BIN: environment, PATH: pathDirectory })).source, "environment");
  assert.equal((await resolveGodotExecutablePath(undefined, { PATH: pathDirectory })).source, "path");
});

test("missing Godot binary uses stable code", async () => {
  await assert.rejects(resolveGodotExecutablePath(undefined, { PATH: "" }), (error: unknown) => error instanceof GodotDiscoveryError && error.code === ErrorCodes.GodotBinaryNotFound);
});

test("non-file Godot path uses the non-executable stable code", async () => {
  await assert.rejects(discoverGodot(tmpdir(), {}), (error: unknown) => error instanceof GodotDiscoveryError && error.code === ErrorCodes.GodotBinaryNotExecutable);
});

test("Godot 4.7 stable and stable patch versions are accepted", () => {
  assert.equal(parseGodotVersion("4.7.stable.official.abc")?.compatible, true);
  assert.equal(parseGodotVersion("4.7.2.stable.official.abc")?.compatible, true);
});

test("Godot release candidates, development builds, and other versions are rejected", () => {
  for (const version of ["4.7.1.rc1.official", "4.7.dev1.official", "4.7.beta2.official", "4.8.stable.official", "3.7.stable.official"]) {
    assert.equal(parseGodotVersion(version)?.compatible, false, version);
  }
});

test("unrecognized Godot version output is rejected", () => assert.equal(parseGodotVersion("Godot Engine development build"), null));
