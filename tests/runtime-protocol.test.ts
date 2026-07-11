import assert from "node:assert/strict";
import test from "node:test";

import { FIXED_TIMESTEP_SECONDS } from "../src/domain/movement/movementSimulation";
import { MOVEMENT_FIXTURE_ID, RUNTIME_RUN_COMMAND, RUNTIME_SCHEMA_VERSION, type RuntimeRequest } from "../src/domain/runtime/runtimeProtocol";
import { validateRuntimeRequest, validateRuntimeResponse } from "../src/domain/runtime/runtimeValidation";
import { defaultProfile } from "./testUtils";

async function request(): Promise<RuntimeRequest> { return { schemaVersion: RUNTIME_SCHEMA_VERSION, commandId: RUNTIME_RUN_COMMAND, fixtureId: MOVEMENT_FIXTURE_ID, correlationId: "correlation-1", requestedAt: new Date(0).toISOString(), timeoutMs: 10000, payload: { definitionSchemaVersion: 1, profile: await defaultProfile(), scenario: { id: "accelerate", durationSeconds: 3, fixedDeltaSeconds: FIXED_TIMESTEP_SECONDS, cameraYawDegrees: 0 } } }; }
function response(overrides: Record<string, unknown> = {}): unknown { return { schemaVersion: RUNTIME_SCHEMA_VERSION, commandId: RUNTIME_RUN_COMMAND, fixtureId: MOVEMENT_FIXTURE_ID, correlationId: "correlation-1", status: "ok", metrics: {}, warnings: [], validationErrors: [], runtimeErrors: [], changedFiles: [], evidence: { godotVersion: "4.7.stable.official", physicsTicksPerSecond: 60, physicsSteps: 1, fixtureScene: "res://scenes/movement_fixture.tscn", scenarioId: "accelerate" }, ...overrides }; }
const expected = { correlationId: "correlation-1", fixtureId: MOVEMENT_FIXTURE_ID, commandId: RUNTIME_RUN_COMMAND, status: "ok" as const };

test("valid runtime request passes", async () => assert.equal(validateRuntimeRequest(await request()).valid, true));
test("runtime request rejects protocol, correlation, fixture, scenario, timestep, and non-finite values", async () => {
  const variants: Array<(value: any) => void> = [
    (value) => { value.schemaVersion = "mam.runtime/v2"; }, (value) => { value.correlationId = ""; },
    (value) => { value.fixtureId = "unknown"; }, (value) => { value.payload.scenario.id = "fly"; },
    (value) => { value.payload.scenario.fixedDeltaSeconds = 0; }, (value) => { value.payload.scenario.cameraYawDegrees = Number.NaN; }
  ];
  for (const mutate of variants) { const value = await request(); mutate(value); assert.equal(validateRuntimeRequest(value).valid, false); }
});
test("runtime response detects readiness and response correlation mismatch", () => {
  assert.equal(validateRuntimeResponse(response({ commandId: "runtime.fixture.ready", status: "ready", correlationId: "wrong", evidence: { godotVersion: "4.7.stable.official", physicsTicksPerSecond: 60 } }), { ...expected, commandId: "runtime.fixture.ready", status: "ready" }).valid, false);
  assert.equal(validateRuntimeResponse(response({ correlationId: "wrong" }), expected).valid, false);
});
test("runtime response rejects malformed response, invalid status, missing metrics, and changed files", () => {
  for (const value of ["bad", response({ status: "unknown" }), response({ metrics: undefined }), response({ changedFiles: ["examples/movement/default.json"] })]) assert.equal(validateRuntimeResponse(value, expected).valid, false);
});
