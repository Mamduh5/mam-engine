import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { OperationResult } from "../src/shared/operationResult";
import { ErrorCodes } from "../src/shared/errorCodes";
import { setMovementValue } from "../src/application/movement/setMovementValue";
import { executeCli } from "../src/cli/main";
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

test("recovered write failures serialize in JSON and remain non-zero", async (context) => {
  const workspace = await createTestWorkspace(context);
  let reads = 0;
  const execution = await executeCli(
    ["movement", "set", workspace.relativeFile, "ground.runSpeed", "6.5", "--json"],
    workspace.root,
    {
      setMovementValue: (root, file, propertyPath, value, dryRun) => setMovementValue(root, file, propertyPath, value, dryRun, {
        transaction: {
          readText: async (filePath) => {
            reads += 1;
            if (reads === 1) {
              throw new Error("injected CLI verification read failure");
            }
            return readFile(filePath, "utf8");
          }
        }
      })
    }
  );
  const parsed = JSON.parse(JSON.stringify(execution.result)) as OperationResult;
  assert.equal(execution.json, true);
  assert.equal(execution.exitCode, 1);
  assert.equal(parsed.status, "failed");
  assert.equal((parsed.data as { recovery: { status: string } }).recovery.status, "restored");
});

test("rollback JSON includes source and pre-rollback snapshot IDs", async (context) => {
  const workspace = await createTestWorkspace(context);
  const setResult = await setMovementValue(workspace.root, workspace.relativeFile, "ground.runSpeed", 6.5, false);
  const execution = await executeCli(["snapshot", "rollback", setResult.snapshotId as string, "--json"], workspace.root);
  const parsed = JSON.parse(JSON.stringify(execution.result)) as OperationResult;
  assert.equal(execution.exitCode, 0);
  assert.equal(parsed.status, "rolled_back");
  const data = parsed.data as { sourceSnapshotId: string; preRollbackSnapshotId: string };
  assert.equal(data.sourceSnapshotId, setResult.snapshotId);
  assert.equal(data.preRollbackSnapshotId, parsed.snapshotId);
});
