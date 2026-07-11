import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { OperationResult } from "../src/shared/operationResult";
import { ErrorCodes } from "../src/shared/errorCodes";
import { createTestWorkspace } from "./testUtils";

function runCli(workspaceRoot: string, args: string[]) {
  const cliPath = path.resolve(__dirname, "../src/cli/main.js");
  return spawnSync(process.execPath, [cliPath, ...args], { cwd: workspaceRoot, encoding: "utf8" });
}

test("JSON output parses and successful commands exit zero", async (context) => {
  const workspace = await createTestWorkspace(context);
  const processResult = runCli(workspace.root, ["movement", "inspect", workspace.relativeFile, "--json"]);
  assert.equal(processResult.status, 0, processResult.stderr);
  const result = JSON.parse(processResult.stdout) as OperationResult;
  assert.equal(result.protocolVersion, 1);
  assert.equal(result.status, "passed");
  assert.equal(result.command, "movement.inspect");
});

test("failed validation exits non-zero without a stack trace", async (context) => {
  const workspace = await createTestWorkspace(context);
  await writeFile(workspace.movementFile, "{}\n", "utf8");
  const processResult = runCli(workspace.root, ["movement", "validate", workspace.relativeFile, "--json"]);
  assert.notEqual(processResult.status, 0);
  const result = JSON.parse(processResult.stdout) as OperationResult;
  assert.equal(result.status, "failed");
  assert.equal(processResult.stderr.includes(" at "), false);
  assert.equal(processResult.stderr.includes("Error:"), false);
});

test("unknown commands return CLI_ARGUMENT_INVALID", async (context) => {
  const workspace = await createTestWorkspace(context);
  const processResult = runCli(workspace.root, ["movement", "fly", "--json"]);
  assert.equal(processResult.status, 2);
  const result = JSON.parse(processResult.stdout) as OperationResult;
  assert.equal(result.errors[0]?.code, ErrorCodes.CliArgumentInvalid);
  assert.equal(processResult.stderr, "");
});
