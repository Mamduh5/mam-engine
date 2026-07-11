import assert from "node:assert/strict";
import test from "node:test";

import { checkRuntime } from "../../src/application/runtime/checkRuntime";
import { runMovementRuntimeTest } from "../../src/application/runtime/runMovementRuntimeTest";
import { discoverGodot } from "../../src/infrastructure/runtime/godotDiscovery";
import { projectRoot } from "../testUtils";

const availability = discoverGodot().then(() => null, (error: Error) => error.message);
async function requireGodot(context: { skip(message?: string): void }): Promise<boolean> { const reason = await availability; if (reason) { context.skip(`Godot unavailable: ${reason}`); return false; } return true; }

test("runtime check completes a real readiness smoke run", async (context) => { if (!await requireGodot(context)) return; const result = await checkRuntime(projectRoot()); assert.equal(result.status, "passed", JSON.stringify(result)); });
for (const scenario of ["accelerate", "stop", "sprint", "dodge", "turn"] as const) test(`real Godot ${scenario} matches domain simulation`, async (context) => { if (!await requireGodot(context)) return; const result = await runMovementRuntimeTest(projectRoot(), "examples/movement/default.json", scenario, undefined, 0); assert.equal(result.status, "passed", JSON.stringify(result)); });
for (const yaw of [0, 90]) test(`real Godot acceleration uses camera yaw ${yaw}`, async (context) => { if (!await requireGodot(context)) return; const result = await runMovementRuntimeTest(projectRoot(), "examples/movement/default.json", "accelerate", 1, yaw); assert.equal(result.status, "passed", JSON.stringify(result)); const position = ((result.data as any).runtime.metrics.finalPosition) as { x: number; z: number }; if (yaw === 0) { assert(Math.abs(position.x) < 0.05); assert(position.z < -1); } else { assert(position.x < -1); assert(Math.abs(position.z) < 0.05); } });
