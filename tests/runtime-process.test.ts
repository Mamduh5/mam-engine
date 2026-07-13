import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { runGodotProcess } from "../src/infrastructure/runtime/godotProcessRunner";
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
test("process runner configures Linux interactive rendering without changing headless launch", async (context) => {
  const calls: Array<{ executable: string; args: readonly string[]; options: Record<string, unknown> }> = [];
  const captureSpawn = ((executable: string, args: readonly string[], options: Record<string, unknown>) => {
    calls.push({ executable, args, options });
    const fixture = path.resolve(__dirname, "../../tests/fixtures/runtime-process-fixture.js");
    return spawn(process.execPath, [fixture, "success", ...args], options);
  }) as typeof spawn;

  const interactive = await run(context, "interactive-linux", { interactive: true, platform: "linux", spawnProcess: captureSpawn });
  assert.equal(interactive.result.readyObserved, true);
  assert.equal(calls[0]?.executable, "xvfb-run");
  assert.deepEqual(calls[0]?.args.slice(0, 7), ["-a", "fake", "--display-driver", "x11", "--rendering-method", "gl_compatibility", "--path"]);
  assert.equal((calls[0]?.options.env as NodeJS.ProcessEnv).LIBGL_ALWAYS_SOFTWARE, "1");

  await run(context, "headless-linux", { platform: "linux", spawnProcess: captureSpawn });
  assert.equal(calls[1]?.executable, "fake");
  assert.equal(calls[1]?.args[0], "--headless");
  assert.deepEqual(calls[1]?.options, { shell: false, windowsHide: true });
});
test("runtime sessions clean on success and can be retained for failed diagnostics", async (context) => { const { session } = await run(context, "success"); await removeRuntimeSession(session); await assert.rejects(import("node:fs/promises").then(({ stat }) => stat(session.directory))); const retained = await run(context, "nonzero"); assert.equal(retained.result.exitCode, 9); });
