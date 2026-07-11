import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { DEFAULT_GODOT_READINESS_TIMEOUT_MS, runGodotProcess } from "../src/infrastructure/runtime/godotProcessRunner";
import { createRuntimeSession, removeRuntimeSession, writeSessionJson } from "../src/infrastructure/runtime/runtimeSessionStore";
import { fileExists } from "../src/infrastructure/files/jsonFileStore";

async function run(context: TestContext, mode: string, options: Record<string, unknown> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "mam-runtime-process-")); context.after(() => rm(root, { recursive: true, force: true }));
  const session = await createRuntimeSession(root, `test-${mode}`);
  await writeSessionJson(session.requestPath, { correlationId: `test-${mode}` });
  const fixture = path.resolve(__dirname, "../../tests/fixtures/runtime-process-fixture.js");
  const spawnProcess = ((_executable: string, args: readonly string[], spawnOptions: object) => spawn(process.execPath, [fixture, mode, ...args], spawnOptions)) as typeof spawn;
  const result = await runGodotProcess("fake", "fake-project", session, { readinessTimeoutMs: 1_000, executionTimeoutMs: 1_500, maximumOutputBytes: 100, spawnProcess, ...options });
  return { root, session, result };
}

test("process runner observes readiness, clean exit, and bounded output", async (context) => { const { result } = await run(context, "large"); assert.equal(result.readyObserved, true); assert.equal(result.exitCode, 0); assert.equal(result.outputTruncated, true); });
test("process runner allows a cold start before applying the execution deadline", async (context) => {
  assert.equal(DEFAULT_GODOT_READINESS_TIMEOUT_MS, 15_000);
  const { result } = await run(context, "delayed-ready", { readinessTimeoutMs: 1_000, executionTimeoutMs: 200 });
  assert.equal(result.readyObserved, true);
  assert.equal(result.timedOut, false);
  assert.equal(result.exitCode, 0);
});
test("process runner reports asynchronous spawn failure", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "mam-runtime-spawn-")); context.after(() => rm(root, { recursive: true, force: true }));
  const session = await createRuntimeSession(root, "test-spawn-failure"); await writeSessionJson(session.requestPath, {});
  await assert.rejects(runGodotProcess(path.join(root, "missing-executable"), "fake-project", session, { readinessTimeoutMs: 100 }), /spawn:/);
});
test("process runner reports early and non-zero exits", async (context) => { assert.equal((await run(context, "early")).result.exitCode, 7); assert.equal((await run(context, "nonzero")).result.exitCode, 9); });
test("process runner exposes a missing final response after clean exit", async (context) => { const outcome = await run(context, "no-response"); assert.equal(outcome.result.exitCode, 0); assert.equal(outcome.result.readyObserved, true); assert.equal(await fileExists(outcome.session.responsePath), false); });
test("process runner enforces readiness timeout and terminates owned process", async (context) => { const result = (await run(context, "no-ready")).result; assert.equal(result.timedOut, true); assert.notEqual(result.signal, null); });
test("process runner enforces execution timeout after readiness", async (context) => { const result = (await run(context, "hang", { executionTimeoutMs: 250 })).result; assert.equal(result.readyObserved, true); assert.equal(result.timedOut, true); assert.notEqual(result.signal, null); });
test("runtime sessions clean on success and can be retained for failed diagnostics", async (context) => { const { session } = await run(context, "success"); await removeRuntimeSession(session); await assert.rejects(import("node:fs/promises").then(({ stat }) => stat(session.directory))); const retained = await run(context, "nonzero"); assert.equal(retained.result.exitCode, 9); });
