import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import { SUPPORTED_COMMAND_ACTIONS, type CommandGroup } from "../src/cli/commandParser";
import { COMMAND_HELP } from "../src/cli/help";
import type { OperationResult } from "../src/shared/operationResult";

const root = path.resolve(__dirname, "../..");
const cli = path.join(root, "dist", "src", "cli", "main.js");

test("top-level help lists every supported command group and the discovery command", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0, result.stderr);
  for (const group of Object.keys(SUPPORTED_COMMAND_ACTIONS)) assert.match(result.stdout, new RegExp(`^  ${escape(group)}$`, "m"));
  assert.match(result.stdout, /mam <command-group> --help/);
});

test("movement and snapshot group help expose exact syntax", () => {
  const movement = run(["movement", "--help"]);
  assert.equal(movement.status, 0, movement.stderr);
  for (const action of ["inspect", "validate", "simulate", "set", "runtime-test"]) assert.match(movement.stdout, new RegExp(`mam movement ${action}`));
  assert.match(movement.stdout, /--scenario <accelerate\|stop\|sprint\|dodge\|turn>/);
  assert.match(movement.stdout, /--camera-yaw-degrees <number>/);

  const snapshot = run(["snapshot", "--help"]);
  assert.equal(snapshot.status, 0, snapshot.stderr);
  assert.match(snapshot.stdout, /mam snapshot rollback <snapshot-id> \[--json\]/);
});

test("help command alias renders the same group help", () => {
  assert.equal(run(["help", "movement"]).stdout, run(["movement", "--help"]).stdout);
});

test("unknown actions point to the relevant working help command", () => {
  const result = run(["movement", "launch", "--json"]);
  assert.equal(result.status, 2);
  const operation = JSON.parse(result.stdout) as OperationResult;
  assert.match(operation.errors[0]?.message ?? "", /Run 'mam movement --help' for supported movement commands\./);
});

test("capability-manifest groups and parser actions have matching help entries", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "docs", "capabilities-v0.1.json"), "utf8")) as { cliCommandGroups: string[] };
  assert.deepEqual(manifest.cliCommandGroups, Object.keys(SUPPORTED_COMMAND_ACTIONS));
  for (const [group, actions] of Object.entries(SUPPORTED_COMMAND_ACTIONS) as Array<[CommandGroup, readonly string[]]>) {
    const documentedActions = COMMAND_HELP[group].map((syntax) => syntax.split(" ")[1]);
    assert.deepEqual(new Set(documentedActions), new Set(actions), group);
  }
});

function run(args: string[]) { return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8" }); }
function escape(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
