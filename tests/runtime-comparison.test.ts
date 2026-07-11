import assert from "node:assert/strict";
import test from "node:test";

import { simulateMovement } from "../src/domain/movement/movementSimulation";
import { compareMovementRuntime } from "../src/domain/runtime/runtimeComparison";
import { defaultProfile } from "./testUtils";

test("runtime comparison passes matching metrics and one-step time drift", async () => {
  const simulation = simulateMovement(await defaultProfile(), "accelerate", 2);
  const runtime = { ...simulation.metrics, physicsSteps: simulation.metrics.simulationSteps } as Record<string, unknown>;
  runtime.timeToNinetyFivePercentSeconds = Number(runtime.timeToNinetyFivePercentSeconds) + 1 / 60;
  assert.equal(compareMovementRuntime(simulation, runtime).passed, true);
});

test("runtime comparison treats matching nullable metrics as equal", async () => {
  const simulation = simulateMovement(await defaultProfile(), "sprint", 2);
  const runtime = { ...simulation.metrics, physicsSteps: simulation.metrics.simulationSteps } as Record<string, unknown>;
  assert.equal(runtime.timeUntilSprintUnavailableSeconds, null);
  assert.equal(compareMovementRuntime(simulation, runtime).passed, true);
});

test("runtime comparison rejects speed, distance, time, stamina, angle, and exact step mismatches", async () => {
  const profile = await defaultProfile();
  const cases: Array<[Parameters<typeof simulateMovement>[1], string, number]> = [
    ["accelerate", "finalSpeed", 1], ["accelerate", "totalDistance", 1], ["accelerate", "timeToNinetyFivePercentSeconds", 1],
    ["sprint", "finalStamina", 1], ["turn", "finalYawDegrees", 1]
  ];
  for (const [scenario, metric, delta] of cases) {
    const simulation = simulateMovement(profile, scenario, 2);
    const runtime = { ...simulation.metrics, physicsSteps: simulation.metrics.simulationSteps } as Record<string, unknown>;
    runtime[metric] = Number(runtime[metric]) + delta;
    assert.equal(compareMovementRuntime(simulation, runtime).passed, false, `${scenario}:${metric}`);
  }
  const simulation = simulateMovement(profile, "stop");
  const runtime = { ...simulation.metrics, physicsSteps: Number(simulation.metrics.simulationSteps) + 1 };
  assert.equal(compareMovementRuntime(simulation, runtime).passed, false);
});
