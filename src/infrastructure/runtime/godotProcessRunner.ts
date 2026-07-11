import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { writeFile } from "node:fs/promises";

import { fileExists } from "../files/jsonFileStore";
import type { RuntimeSession } from "./runtimeSessionStore";

export interface GodotProcessResult { exitCode: number | null; signal: NodeJS.Signals | null; timedOut: boolean; readyObserved: boolean; outputTruncated: boolean }
export interface ProcessRunnerOptions { readinessTimeoutMs?: number; executionTimeoutMs?: number; maximumOutputBytes?: number; spawnProcess?: typeof spawn }
const DEFAULT_GODOT_READINESS_TIMEOUT_MS = 5_000;
const DEFAULT_GODOT_EXECUTION_TIMEOUT_MS = 15_000;

export async function runGodotProcess(executable: string, projectPath: string, session: RuntimeSession, options: ProcessRunnerOptions = {}): Promise<GodotProcessResult> {
  const readinessTimeoutMs = options.readinessTimeoutMs ?? DEFAULT_GODOT_READINESS_TIMEOUT_MS;
  const executionTimeoutMs = options.executionTimeoutMs ?? DEFAULT_GODOT_EXECUTION_TIMEOUT_MS;
  const maximumOutputBytes = options.maximumOutputBytes ?? 1024 * 1024;
  const spawnProcess = options.spawnProcess ?? spawn;
  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawnProcess(executable, ["--headless", "--path", projectPath, "--", "--request", session.requestPath, "--ready", session.readyPath, "--response", session.responsePath], { shell: false, windowsHide: true }) as ChildProcessWithoutNullStreams;
  } catch (caught) { throw new Error(`spawn:${caught instanceof Error ? caught.message : String(caught)}`); }

  let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0); let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0); let outputTruncated = false;
  const append = (current: Buffer<ArrayBufferLike>, chunk: Buffer<ArrayBufferLike>): Buffer<ArrayBufferLike> => {
    if (current.length >= maximumOutputBytes) { outputTruncated = true; return current; }
    if (current.length + chunk.length > maximumOutputBytes) outputTruncated = true;
    return Buffer.concat([current, chunk.subarray(0, maximumOutputBytes - current.length)]);
  };
  child.stdout.on("data", (chunk: Buffer) => { stdout = append(stdout, chunk); });
  child.stderr.on("data", (chunk: Buffer) => { stderr = append(stderr, chunk); });
  let closed = false; let exitCode: number | null = null; let signal: NodeJS.Signals | null = null; let processError: Error | null = null;
  const closePromise = new Promise<void>((resolve) => {
    child.once("error", (error) => { processError = error; closed = true; resolve(); });
    child.once("close", (code, childSignal) => { closed = true; exitCode = code; signal = childSignal; resolve(); });
  });
  const started = Date.now(); let readyObserved = false; let timedOut = false;
  try {
    while (!closed && Date.now() - started < readinessTimeoutMs) {
      if (await fileExists(session.readyPath)) { readyObserved = true; break; }
      await delay(20);
    }
    if (!readyObserved && await fileExists(session.readyPath)) readyObserved = true;
    if (!readyObserved && !closed) { timedOut = true; await terminate(child, closePromise); }
    if (readyObserved) {
      const completed = await Promise.race([closePromise.then(() => true), delay(executionTimeoutMs).then(() => false)]);
      if (!completed) { timedOut = true; await terminate(child, closePromise); }
    }
    if (!closed) await closePromise;
  } finally {
    await Promise.all([writeFile(session.stdoutPath, stdout), writeFile(session.stderrPath, stderr)]);
  }
  if (processError !== null) throw new Error(`spawn:${(processError as Error).message}`);
  return { exitCode, signal, timedOut, readyObserved, outputTruncated };
}

async function terminate(child: ChildProcessWithoutNullStreams, closePromise: Promise<void>): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const stopped = await Promise.race([closePromise.then(() => true), delay(1_000).then(() => false)]);
  if (!stopped) { child.kill("SIGKILL"); await closePromise.catch(() => undefined); }
}
function delay(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }
