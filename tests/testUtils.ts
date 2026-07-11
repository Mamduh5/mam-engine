import { readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import type { TestContext } from "node:test";
import { rm } from "node:fs/promises";

import type { MovementProfile } from "../src/domain/movement/movementTypes";

export function projectRoot(): string {
  return path.resolve(__dirname, "../..");
}

export async function defaultProfile(): Promise<MovementProfile> {
  return JSON.parse(await readFile(path.join(projectRoot(), "examples", "movement", "default.json"), "utf8")) as MovementProfile;
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
