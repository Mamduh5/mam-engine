import assert from "node:assert/strict";
import test from "node:test";

import { runOffensiveActionRuntimeTest } from "../../src/application/runtime/runOffensiveActionRuntimeTest";
import { discoverGodot } from "../../src/infrastructure/runtime/godotDiscovery";
import { projectRoot } from "../testUtils";

const availability = discoverGodot().then(() => null, (error: Error) => error.message);

test("real Godot default offensive action matches the TypeScript simulation", async (context) => { const reason = await availability; if (reason) { context.skip(`Godot unavailable: ${reason}`); return; } const result = await runOffensiveActionRuntimeTest(projectRoot(), "examples/offensive-action/default.json"); assert.equal(result.status, "passed", JSON.stringify(result)); assert.deepEqual(result.changedFiles, []); assert.equal((result.data as any).runtime.fixtureId, "offensive-action/basic-light-attack"); assert.equal((result.data as any).runtime.scenarioId, "default"); assert.equal((result.data as any).comparison.passed, true); });
