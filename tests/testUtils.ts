import { readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import type { TestContext } from "node:test";
import { rm } from "node:fs/promises";

import type { MovementProfile } from "../src/domain/movement/movementTypes";
import type { CameraProfile } from "../src/domain/camera/cameraTypes";
import type { TargetingProfile } from "../src/domain/targeting/targetingTypes";

export function projectRoot(): string {
  return path.resolve(__dirname, "../..");
}

export async function defaultProfile(): Promise<MovementProfile> {
  return JSON.parse(await readFile(path.join(projectRoot(), "examples", "movement", "default.json"), "utf8")) as MovementProfile;
}

export async function defaultCameraProfile(): Promise<CameraProfile> {
  return JSON.parse(await readFile(path.join(projectRoot(), "examples", "camera", "default.json"), "utf8")) as CameraProfile;
}

export async function defaultTargetingProfile(): Promise<TargetingProfile> {
  return JSON.parse(await readFile(path.join(projectRoot(), "examples", "targeting", "default.json"), "utf8")) as TargetingProfile;
}

export async function createTargetingTestWorkspace(context: TestContext): Promise<{ root: string; targetingFile: string; relativeFile: string; cameraFile: string; cameraRelativeFile: string; movementFile: string; movementRelativeFile: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "mam-targeting-test-")); context.after(async () => rm(root, { recursive: true, force: true }));
  const relativeFile = "examples/targeting/default.json"; const cameraRelativeFile = "examples/camera/default.json"; const movementRelativeFile = "examples/movement/default.json";
  const targetingFile = path.join(root, ...relativeFile.split("/")); const cameraFile = path.join(root, ...cameraRelativeFile.split("/")); const movementFile = path.join(root, ...movementRelativeFile.split("/"));
  for (const [destination, source] of [[targetingFile, relativeFile], [cameraFile, cameraRelativeFile], [movementFile, movementRelativeFile]] as const) { await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, await readFile(path.join(projectRoot(), ...source.split("/")), "utf8"), "utf8"); }
  await writeFile(path.join(root, "unrelated.txt"), "unchanged\n", "utf8"); return { root, targetingFile, relativeFile, cameraFile, cameraRelativeFile, movementFile, movementRelativeFile };
}

export async function createTestWorkspace(context: TestContext): Promise<{ root: string; movementFile: string; relativeFile: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "mam-engine-test-"));
  context.after(async () => rm(root, { recursive: true, force: true }));
  const relativeFile = "examples/movement/default.json";
  const movementFile = path.join(root, ...relativeFile.split("/"));
  await mkdir(path.dirname(movementFile), { recursive: true });
  await writeFile(movementFile, await readFile(path.join(projectRoot(), ...relativeFile.split("/")), "utf8"), "utf8");
  await writeFile(path.join(root, "unrelated.txt"), "unchanged\n", "utf8");
  return { root, movementFile, relativeFile };
}

export async function createCameraTestWorkspace(context: TestContext): Promise<{ root: string; cameraFile: string; relativeFile: string; movementFile: string; movementRelativeFile: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "mam-camera-test-"));
  context.after(async () => rm(root, { recursive: true, force: true }));
  const relativeFile = "examples/camera/default.json";
  const cameraFile = path.join(root, ...relativeFile.split("/"));
  const movementRelativeFile = "examples/movement/default.json";
  const movementFile = path.join(root, ...movementRelativeFile.split("/"));
  await mkdir(path.dirname(cameraFile), { recursive: true });
  await mkdir(path.dirname(movementFile), { recursive: true });
  await writeFile(cameraFile, await readFile(path.join(projectRoot(), ...relativeFile.split("/")), "utf8"), "utf8");
  await writeFile(movementFile, await readFile(path.join(projectRoot(), ...movementRelativeFile.split("/")), "utf8"), "utf8");
  await writeFile(path.join(root, "unrelated.txt"), "unchanged\n", "utf8");
  return { root, cameraFile, relativeFile, movementFile, movementRelativeFile };
}
