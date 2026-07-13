import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { SUPPORTED_DEFINITION_KINDS } from "../src/application/definitions/definitionValidationRegistry";

test("v0.1 capability manifest matches authoritative definition and editor scope", async () => {
  const root = path.resolve(__dirname, "../..");
  const manifest = JSON.parse(await readFile(path.join(root, "docs", "capabilities-v0.1.json"), "utf8")) as Record<string, unknown>;
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as { version: string };
  assert.equal(manifest.releaseVersion, packageJson.version);
  assert.deepEqual(manifest.completedCanonicalPhases, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(manifest.supportedDefinitionKinds, [...SUPPORTED_DEFINITION_KINDS]);
  assert.deepEqual(manifest.visualEditorEditableDefinitionKinds, ["movement-profile"]);
  assert.deepEqual(manifest.visualEditorSimulationDefinitionKinds, ["movement-profile"]);
  assert.deepEqual(manifest.visualEditorReadOnlyDefinitionKinds, SUPPORTED_DEFINITION_KINDS.filter((kind) => kind !== "movement-profile"));
});
