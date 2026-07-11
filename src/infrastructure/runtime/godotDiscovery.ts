import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";

import { ErrorCodes, type ErrorCode } from "../../shared/errorCodes";
import { parseGodotVersion, type GodotVersionInfo } from "./godotVersion";

export type GodotExecutableSource = "explicit" | "environment" | "path";
export class GodotDiscoveryError extends Error { constructor(public readonly code: ErrorCode, message: string) { super(message); } }
export interface GodotExecutable { path: string; source: GodotExecutableSource; version: GodotVersionInfo }

const candidates = process.platform === "win32" ? ["godot.exe", "godot4.exe", "godot", "godot4"] : ["godot", "godot4"];

export async function discoverGodot(explicitPath?: string, environment: NodeJS.ProcessEnv = process.env): Promise<GodotExecutable> {
  const resolved = await resolveGodotExecutablePath(explicitPath, environment);
  await assertExecutable(resolved.path);
  const reported = await readVersion(resolved.path);
  const version = parseGodotVersion(reported);
  if (!version) throw new GodotDiscoveryError(ErrorCodes.GodotVersionReadFailed, "Godot returned an unrecognized version string");
  if (!version.compatible) throw new GodotDiscoveryError(ErrorCodes.GodotVersionUnsupported, `Godot ${version.reportedVersion} is unsupported; expected a 4.7 stable standard build`);
  return { ...resolved, version };
}

export async function resolveGodotExecutablePath(explicitPath?: string, environment: NodeJS.ProcessEnv = process.env): Promise<{ path: string; source: GodotExecutableSource }> {
  let resolved: { path: string; source: GodotExecutableSource } | null = null;
  if (explicitPath) resolved = { path: path.resolve(explicitPath), source: "explicit" };
  else if (environment.MAM_GODOT_BIN) resolved = { path: path.resolve(environment.MAM_GODOT_BIN), source: "environment" };
  else resolved = await findOnPath(environment.PATH ?? "");
  if (!resolved) throw new GodotDiscoveryError(ErrorCodes.GodotBinaryNotFound, "No Godot executable was found via --godot, MAM_GODOT_BIN, or PATH");
  return resolved;
}

async function findOnPath(pathValue: string): Promise<{ path: string; source: "path" } | null> {
  for (const directory of pathValue.split(path.delimiter).filter(Boolean)) {
    for (const candidate of candidates) {
      const possible = path.join(directory.replace(/^"|"$/g, ""), candidate);
      try { await assertExecutable(possible); return { path: possible, source: "path" }; } catch { /* continue */ }
    }
  }
  return null;
}

async function assertExecutable(filePath: string): Promise<void> {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("not a file");
    await access(filePath, process.platform === "win32" ? constants.F_OK : constants.X_OK);
  } catch {
    throw new GodotDiscoveryError(ErrorCodes.GodotBinaryNotExecutable, "The selected Godot binary is missing or not executable");
  }
}

async function readVersion(executable: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ["--version"], { shell: false, windowsHide: true });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.once("error", () => reject(new GodotDiscoveryError(ErrorCodes.GodotVersionReadFailed, "Could not execute Godot's version command")));
    child.once("close", (code) => code === 0 ? resolve(stdout || stderr) : reject(new GodotDiscoveryError(ErrorCodes.GodotVersionReadFailed, `Godot version command exited with code ${code ?? "unknown"}`)));
  });
}
