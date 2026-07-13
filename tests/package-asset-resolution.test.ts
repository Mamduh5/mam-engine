import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { PACKAGE_ASSET_NOT_FOUND, PackageAssetResolutionError, resolvePackageAsset } from "../src/infrastructure/runtime/packageAssetResolver";

test("package assets resolve from the compiled module location", async () => {
  const project = await resolvePackageAsset("runtime/godot/project.godot");
  const movement = await resolvePackageAsset("examples/movement/default.json");
  assert.equal(path.dirname(project.path), path.join(project.packageRoot, "runtime", "godot"));
  assert.equal(movement.path, path.join(project.packageRoot, "examples", "movement", "default.json"));
});

test("installed-layout resolution is independent of cwd and returns stable missing-asset errors", async (context) => {
  const packageRoot = await mkdtemp(path.join(tmpdir(), "mam-package-assets-"));
  context.after(() => rm(packageRoot, { recursive: true, force: true }));
  const moduleDirectory = path.join(packageRoot, "dist", "src", "infrastructure", "runtime");
  for (const relative of ["runtime/godot/project.godot", "examples/movement/default.json"]) {
    const file = path.join(packageRoot, ...relative.split("/"));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, "{}\n", "utf8");
    assert.equal((await resolvePackageAsset(relative, moduleDirectory)).path, file);
  }
  await assert.rejects(
    resolvePackageAsset("runtime/godot/missing.tscn", moduleDirectory),
    (caught: unknown) => caught instanceof PackageAssetResolutionError && caught.code === PACKAGE_ASSET_NOT_FOUND && caught.relativePath === "runtime/godot/missing.tscn"
  );
});
