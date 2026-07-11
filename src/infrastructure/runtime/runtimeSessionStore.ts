import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { atomicWriteText, formatJson } from "../files/jsonFileStore";

export interface RuntimeSession {
  correlationId: string;
  directory: string;
  relativeDirectory: string;
  requestPath: string;
  readyPath: string;
  responsePath: string;
  stdoutPath: string;
  stderrPath: string;
  metadataPath: string;
}

export async function createRuntimeSession(workspaceRoot: string, correlationId: string = randomUUID()): Promise<RuntimeSession> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(correlationId)) throw new Error("Unsafe runtime correlation ID");
  const relativeDirectory = `.mam-engine/runtime-sessions/${correlationId}`;
  const directory = path.resolve(workspaceRoot, ...relativeDirectory.split("/"));
  const sessionsRoot = path.resolve(workspaceRoot, ".mam-engine", "runtime-sessions");
  if (!directory.startsWith(`${sessionsRoot}${path.sep}`)) throw new Error("Runtime session escaped the workspace");
  await mkdir(sessionsRoot, { recursive: true });
  await mkdir(directory, { recursive: false });
  return {
    correlationId, directory, relativeDirectory,
    requestPath: path.join(directory, "request.json"), readyPath: path.join(directory, "ready.json"), responsePath: path.join(directory, "response.json"),
    stdoutPath: path.join(directory, "stdout.log"), stderrPath: path.join(directory, "stderr.log"), metadataPath: path.join(directory, "session.json")
  };
}

export async function writeSessionJson(filePath: string, value: unknown): Promise<void> { await atomicWriteText(filePath, formatJson(value)); }
export async function readSessionJson(filePath: string): Promise<unknown> { return JSON.parse(await readFile(filePath, "utf8")) as unknown; }
export async function removeRuntimeSession(session: RuntimeSession): Promise<void> { await rm(session.directory, { recursive: true, force: true }); }
