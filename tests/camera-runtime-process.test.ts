import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import test from "node:test";

import { runCameraRuntimeTest } from "../src/application/runtime/runCameraRuntimeTest";
import { executeCli } from "../src/cli/main";
import { ErrorCodes } from "../src/shared/errorCodes";
import { createCameraTestWorkspace } from "./testUtils";

test("camera profile validation occurs before Godot discovery", async (context) => { const workspace = await createCameraTestWorkspace(context); await writeFile(workspace.cameraFile, "{}\n", "utf8"); const result = await runCameraRuntimeTest(workspace.root, workspace.relativeFile, "orbit", undefined, undefined, { godot: "definitely-missing" }); assert.equal(result.status, "failed"); assert.notEqual(result.errors[0]?.code, ErrorCodes.GodotBinaryNotExecutable); });
test("unsupported camera runtime scenario does not start Godot", async (context) => { const workspace = await createCameraTestWorkspace(context); const result = await runCameraRuntimeTest(workspace.root, workspace.relativeFile, "targeting" as any, undefined, undefined, { godot: "definitely-missing" }); assert.equal(result.errors[0]?.code, ErrorCodes.CameraRuntimeScenarioUnsupported); });
test("camera runtime parser returns outer operation envelope for unsupported scenario", async () => { const execution = await executeCli(["camera", "runtime-test", "examples/camera/default.json", "--scenario", "targeting", "--json"]); assert.equal(execution.result.protocolVersion, 1); assert.equal(execution.result.status, "failed"); assert.equal(execution.result.errors[0]?.code, ErrorCodes.CameraRuntimeScenarioUnsupported); });
