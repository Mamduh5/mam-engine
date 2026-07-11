import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { executeCli } from "../src/cli/main";
import { ErrorCodes } from "../src/shared/errorCodes";
import type { OperationResult } from "../src/shared/operationResult";
import { createCameraTestWorkspace } from "./testUtils";

function runCli(root: string, args: string[]) { return spawnSync(process.execPath, [path.resolve(__dirname, "../src/cli/main.js"), ...args], { cwd: root, encoding: "utf8" }); }

test("camera CLI JSON output parses and successful commands return zero", async (context) => { const workspace = await createCameraTestWorkspace(context); const processResult = runCli(workspace.root, ["camera", "inspect", workspace.relativeFile, "--json"]); assert.equal(processResult.status, 0, processResult.stderr); const result = JSON.parse(processResult.stdout) as OperationResult; assert.equal(result.command, "camera.inspect"); assert.equal(result.status, "passed"); });
test("camera CLI failures return nonzero without stack traces", async (context) => { const workspace = await createCameraTestWorkspace(context); await writeFile(workspace.cameraFile, "{}\n", "utf8"); const processResult = runCli(workspace.root, ["camera", "validate", workspace.relativeFile, "--json"]); assert.notEqual(processResult.status, 0); assert.equal(processResult.stderr.includes("Error:"), false); assert.equal(processResult.stderr.includes(" at "), false); assert.equal((JSON.parse(processResult.stdout) as OperationResult).status, "failed"); });
test("unknown camera scenario returns stable code", async () => { const execution = await executeCli(["camera", "simulate", "examples/camera/default.json", "--scenario", "target-lock", "--json"]); assert.equal(execution.exitCode, 2); assert.equal(execution.result.errors[0]?.code, ErrorCodes.CameraScenarioUnsupported); });
test("camera CLI set dry run succeeds without persistence", async (context) => { const workspace = await createCameraTestWorkspace(context); const processResult = runCli(workspace.root, ["camera", "set", workspace.relativeFile, "orbit.yawSpeedDegreesPerSecond", "200", "--dry-run", "--json"]); assert.equal(processResult.status, 0, processResult.stderr); assert.equal((JSON.parse(processResult.stdout) as OperationResult).status, "dry_run"); });
