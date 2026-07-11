import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type FileState = ReadonlyMap<string, string>;

const ignoredDirectories = new Set([".git", "node_modules", "dist"]);

export async function captureWorkspaceState(workspaceRoot: string): Promise<FileState> {
  const state = new Map<string, string>();
  await visit(workspaceRoot, workspaceRoot, state);
  return state;
}

async function visit(root: string, directory: string, state: Map<string, string>): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(root, absolutePath, state);
    } else if (entry.isFile()) {
      const content = await readFile(absolutePath);
      state.set(toRepositoryPath(root, absolutePath), createHash("sha256").update(content).digest("hex"));
    }
  }
}

export function diffFileStates(before: FileState, after: FileState): string[] {
  const paths = new Set([...before.keys(), ...after.keys()]);
  return [...paths].sort().filter((filePath) => before.get(filePath) !== after.get(filePath));
}

export interface ChangedFileAudit {
  ok: boolean;
  changedFiles: string[];
  unexpectedFiles: string[];
}

export function auditChangedFiles(before: FileState, after: FileState, allowedPaths: string[]): ChangedFileAudit {
  const changedFiles = diffFileStates(before, after);
  const allowed = new Set(allowedPaths.map(normalizeRepositoryPath));
  const unexpectedFiles = changedFiles.filter((filePath) => !allowed.has(normalizeRepositoryPath(filePath)));
  return { ok: unexpectedFiles.length === 0, changedFiles, unexpectedFiles };
}

export function resolveWorkspacePath(workspaceRoot: string, inputPath: string): { absolutePath: string; relativePath: string } {
  const absoluteRoot = path.resolve(workspaceRoot);
  const absolutePath = path.resolve(absoluteRoot, inputPath);
  const relative = path.relative(absoluteRoot, absolutePath);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
    throw new Error("Path must identify a file inside the repository workspace");
  }
  const relativePath = normalizeRepositoryPath(relative);
  const topLevel = relativePath.split("/")[0]?.toLowerCase();
  if ([".git", ".mam-engine", "node_modules", "dist"].includes(topLevel ?? "")) {
    throw new Error("Movement targets cannot be inside protected repository infrastructure directories");
  }
  if (path.extname(relativePath).toLowerCase() !== ".json") {
    throw new Error("Movement targets must be JSON files");
  }
  return { absolutePath, relativePath };
}

export function toRepositoryPath(workspaceRoot: string, absolutePath: string): string {
  return normalizeRepositoryPath(path.relative(path.resolve(workspaceRoot), path.resolve(absolutePath)));
}

export function normalizeRepositoryPath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}
