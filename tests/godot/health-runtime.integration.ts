import assert from "node:assert/strict";
import test from "node:test";

import { runHealthRuntimeTest } from "../../src/application/runtime/runHealthRuntimeTest";
import { discoverGodot } from "../../src/infrastructure/runtime/godotDiscovery";
import { projectRoot } from "../testUtils";

const availability = discoverGodot().then(() => null, (error: Error) => error.message);

test("real Godot confirmed hit matches the TypeScript health simulation", async (context) => { const reason = await availability; if (reason) { context.skip(`Godot unavailable: ${reason}`); return; } const result = await runHealthRuntimeTest(projectRoot(), "examples/health/default.json", "examples/offensive-action/default.json"); assert.equal(result.status, "passed", JSON.stringify(result)); assert.deepEqual(result.changedFiles, []); assert.equal((result.data as any).runtime.fixtureId, "health/basic-confirmed-hit"); assert.equal((result.data as any).runtime.scenarioId, "confirmed-hit"); assert.equal((result.data as any).comparison.passed, true); });
