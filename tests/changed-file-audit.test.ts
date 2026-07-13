import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { captureWorkspaceState } from "../src/infrastructure/files/changedFileAudit";
import { createTestWorkspace } from "./testUtils";

function fileError(code: string): NodeJS.ErrnoException { return Object.assign(new Error(code), { code }); }

test("workspace capture tolerates concurrently removed runtime-session directories and files", async (context) => {
  const workspace = await createTestWorkspace(context); const sessions = path.join(workspace.root, ".mam-engine", "runtime-sessions"); const removedDirectory = path.join(sessions, "removed-directory"); const removedFile = path.join(sessions, "removed-file", "session.json"); const stableFile = path.join(sessions, "stable", "session.json");
  for (const file of [path.join(removedDirectory, "session.json"), removedFile, stableFile]) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, "{}\n", "utf8"); }
  const state = await captureWorkspaceState(workspace.root, {
    readDirectory: async (directory) => { if (directory === removedDirectory) throw fileError("ENOENT"); return readdir(directory, { withFileTypes: true }); },
    readBinaryFile: async (file) => { if (file === removedFile) throw fileError("ENOENT"); return readFile(file); }
  });
  assert.equal(state.has(".mam-engine/runtime-sessions/removed-directory/session.json"), false); assert.equal(state.has(".mam-engine/runtime-sessions/removed-file/session.json"), false); assert.equal(state.has(".mam-engine/runtime-sessions/stable/session.json"), true); assert.equal(state.has("examples/movement/default.json"), true);
});

test("workspace capture rethrows non-ENOENT directory and file errors", async (context) => {
  const workspace = await createTestWorkspace(context); const directoryError = fileError("EACCES"); await assert.rejects(captureWorkspaceState(workspace.root, { readDirectory: async () => { throw directoryError; } }), (caught) => caught === directoryError);
  const fileErrorValue = fileError("EIO"); await assert.rejects(captureWorkspaceState(workspace.root, { readBinaryFile: async (file) => { if (file === path.join(workspace.root, "unrelated.txt")) throw fileErrorValue; return readFile(file); } }), (caught) => caught === fileErrorValue);
});
