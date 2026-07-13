import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createMovementProfile, initProject } from "../../src/application/project/projectOperations";
import { runProjectPlay } from "../../src/application/runtime/runProjectPlay";
import { discoverGodot } from "../../src/infrastructure/runtime/godotDiscovery";

const availability = discoverGodot().then(() => null, (error: Error) => error.message);

test("automated project play drives authored movement, sprint, and dodge through real Godot", async (context) => {
  const unavailable = await availability;
  if (unavailable !== null) { context.skip(`Godot unavailable: ${unavailable}`); return; }
  const workspace = await mkdtemp(path.join(tmpdir(), "mam-movement-sandbox-"));
  context.after(() => rm(workspace, { recursive: true, force: true }));
  assert.equal((await initProject(workspace)).status, "passed");
  assert.equal((await createMovementProfile(workspace, "movement/player.json")).status, "passed");
  const result = await runProjectPlay(workspace, { automatedInput: true });
  assert.equal(result.status, "passed", JSON.stringify(result));
  const data = result.data as Record<string, any>;
  assert.equal(data.nonHeadless, false);
  assert.equal(data.metrics.profileId, "player");
  assert.equal(data.metrics.sprintObserved, true);
  assert.equal(data.metrics.dodgeObserved, true);
  assert.equal(data.metrics.displacement > 1, true);
  assert.equal(data.metrics.remainingStamina < data.metrics.startingStamina, true);
  assert.equal(data.metrics.finalState, "complete");
  assert.deepEqual(await sessions(workspace), []);
});

async function sessions(workspace: string): Promise<string[]> {
  try { return await readdir(path.join(workspace, ".mam-engine", "runtime-sessions")); }
  catch (caught) { if ((caught as NodeJS.ErrnoException).code === "ENOENT") return []; throw caught; }
}
