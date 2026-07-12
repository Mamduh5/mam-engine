import assert from "node:assert/strict";
import test from "node:test";

import { CAMERA_FIXTURE_ID, RUNTIME_RUN_COMMAND, RUNTIME_SCHEMA_VERSION, type CameraRuntimeRequest } from "../src/domain/runtime/runtimeProtocol";
import { validateRuntimeRequest, validateRuntimeResponse } from "../src/domain/runtime/runtimeValidation";
import { defaultCameraProfile } from "./testUtils";

async function request(): Promise<CameraRuntimeRequest> { return { schemaVersion: RUNTIME_SCHEMA_VERSION, commandId: RUNTIME_RUN_COMMAND, fixtureId: CAMERA_FIXTURE_ID, correlationId: "camera-1", requestedAt: new Date(0).toISOString(), timeoutMs: 15000, payload: { definitionKind: "camera-profile", definitionSchemaVersion: 1, profile: await defaultCameraProfile(), scenario: { id: "orbit", durationSeconds: 2, fixedDeltaSeconds: 1 / 60 } } }; }
function metrics() { return { durationSeconds: 2, initialYawDegrees: 0, finalYawDegrees: 0, totalYawTravelDegrees: 360, initialPitchDegrees: 15, finalPitchDegrees: 60, totalPitchTravelDegrees: 45, physicsSteps: 120, fixedDeltaSeconds: 1 / 60, lens: { fieldOfViewDegrees: 65, nearClipDistance: 0.1, farClipDistance: 500 } }; }
function response(overrides: Record<string, unknown> = {}): unknown { return { schemaVersion: RUNTIME_SCHEMA_VERSION, commandId: RUNTIME_RUN_COMMAND, fixtureId: CAMERA_FIXTURE_ID, correlationId: "camera-1", status: "ok", metrics: metrics(), warnings: [], validationErrors: [], runtimeErrors: [], changedFiles: [], evidence: { godotVersion: "4.7.stable.official", physicsTicksPerSecond: 60, physicsSteps: 120, fixtureScene: "res://scenes/camera_fixture.tscn", scenarioId: "orbit" }, ...overrides }; }
const expected = { correlationId: "camera-1", fixtureId: CAMERA_FIXTURE_ID, commandId: RUNTIME_RUN_COMMAND, status: "ok" as const, scenarioId: "orbit" };

test("valid camera request passes", async () => assert.equal(validateRuntimeRequest(await request()).valid, true));
test("camera request rejects invalid definition kind", async () => { const value: any = await request(); value.payload.definitionKind = "movement-profile"; assert.match(validateRuntimeRequest(value).errors.join(" "), /definition kind/); });
test("camera request rejects unsupported camera schema version", async () => { const value: any = await request(); value.payload.definitionSchemaVersion = 2; value.payload.profile.schemaVersion = 2; assert.match(validateRuntimeRequest(value).errors.join(" "), /camera schema/); });
test("camera request rejects unknown fixture and unsupported scenario", async () => { const fixture: any = await request(); fixture.fixtureId = "camera/unknown"; assert.equal(validateRuntimeRequest(fixture).valid, false); const scenario: any = await request(); scenario.payload.scenario.id = "targeting"; assert.equal(validateRuntimeRequest(scenario).valid, false); });
test("camera response rejects fixture and correlation mismatch", () => { assert.equal(validateRuntimeResponse(response({ fixtureId: "camera/other" }), expected).valid, false); assert.equal(validateRuntimeResponse(response({ correlationId: "other" }), expected).valid, false); });
test("camera response rejects malformed camera metrics", () => { const malformed = metrics() as any; malformed.finalPitchDegrees = Number.NaN; assert.equal(validateRuntimeResponse(response({ metrics: malformed }), expected).valid, false); });
