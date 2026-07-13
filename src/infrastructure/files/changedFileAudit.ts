import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type FileState = ReadonlyMap<string, string>;

const ignoredDirectories = new Set([".git", "node_modules", "dist"]);

export interface WorkspaceAuditFileSystem {
  readDirectory: (directory: string) => Promise<Dirent[]>;
  readBinaryFile: (file: string) => Promise<Buffer>;
}

const productionFileSystem: WorkspaceAuditFileSystem = {
  readDirectory: (directory) => readdir(directory, { withFileTypes: true }),
  readBinaryFile: (file) => readFile(file)
};

export async function captureWorkspaceState(workspaceRoot: string, injected: Partial<WorkspaceAuditFileSystem> = {}): Promise<FileState> {
  const state = new Map<string, string>();
  await visit(workspaceRoot, workspaceRoot, state, { ...productionFileSystem, ...injected });
  return state;
}

async function visit(root: string, directory: string, state: Map<string, string>, fileSystem: WorkspaceAuditFileSystem): Promise<void> {
  let entries: Dirent[];
  try { entries = await fileSystem.readDirectory(directory); }
  catch (caught) { if (isEnoent(caught)) return; throw caught; }
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(root, absolutePath, state, fileSystem);
    } else if (entry.isFile()) {
      let content: Buffer;
      try { content = await fileSystem.readBinaryFile(absolutePath); }
      catch (caught) { if (isEnoent(caught)) continue; throw caught; }
      state.set(toRepositoryPath(root, absolutePath), createHash("sha256").update(content).digest("hex"));
    }
  }
}

function isEnoent(caught: unknown): boolean { return typeof caught === "object" && caught !== null && "code" in caught && (caught as NodeJS.ErrnoException).code === "ENOENT"; }

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
