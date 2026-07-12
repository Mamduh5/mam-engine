import assert from "node:assert/strict";
import test from "node:test";

import { runDefensiveActionRuntimeTest } from "../../src/application/runtime/runDefensiveActionRuntimeTest";
import { discoverGodot } from "../../src/infrastructure/runtime/godotDiscovery";
import { projectRoot } from "../testUtils";

const availability = discoverGodot().then(() => null, (error: Error) => error.message);

test("real Godot default defensive action matches the TypeScript simulation", async (context) => { const reason = await availability; if (reason) { context.skip(`Godot unavailable: ${reason}`); return; } const result = await runDefensiveActionRuntimeTest(projectRoot(), "examples/defensive-action/default.json"); assert.equal(result.status, "passed", JSON.stringify(result)); assert.deepEqual(result.changedFiles, []); assert.equal((result.data as any).runtime.fixtureId, "defensive-action/basic-dodge"); assert.equal((result.data as any).runtime.scenarioId, "default"); assert.equal((result.data as any).comparison.passed, true); });
