import type { Dirent } from "node:fs";
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

import { inspectRegisteredDefinition } from "../definitions/definitionInspectionRegistry";
import { validateDefinition, type DefinitionKind } from "../definitions/definitionValidationRegistry";
import type { CameraProfile } from "../../domain/camera/cameraTypes";
import { validateCameraDefinition } from "../../domain/camera/cameraValidation";
import type { MovementProfile } from "../../domain/movement/movementTypes";
import { validateMovementDefinition } from "../../domain/movement/movementValidation";
import type { MamProjectManifest, ProjectValidationFinding } from "../../domain/project/projectTypes";
import { safeRelativeJson, validateProjectManifest } from "../../domain/project/projectValidation";
import { atomicWriteText, fileExists, formatJson } from "../../infrastructure/files/jsonFileStore";
import { normalizeRepositoryPath } from "../../infrastructure/files/changedFileAudit";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationError, type OperationResult } from "../../shared/operationResult";

export const PROJECT_MANIFEST_FILE = "mam-project.json";

const basicMovement = (id: string, displayName: string): MovementProfile => ({
  schemaVersion: 1,
  kind: "movement-profile",
  id,
  displayName,
  ground: { walkSpeed: 2.5, runSpeed: 5.5, sprintSpeed: 7.5, acceleration: 18, deceleration: 24, rotationSpeedDegrees: 720, orientationMode: "camera_relative" },
  stamina: { maximum: 100, sprintCostPerSecond: 12, regenerationPerSecond: 18, regenerationDelaySeconds: 0.75, minimumToStartSprint: 8 },
  dodge: { distance: 4.2, durationSeconds: 0.55, staminaCost: 20, invulnerabilityStartSeconds: 0.08, invulnerabilityEndSeconds: 0.32, directionMode: "movement_input", steeringMultiplier: 0.15 }
});

const basicCamera = (id: string, displayName: string): CameraProfile => ({
  schemaVersion: 1,
  kind: "camera-profile",
  id,
  displayName,
  orbit: { yawSpeedDegreesPerSecond: 180, pitchSpeedDegreesPerSecond: 120, invertYaw: false, invertPitch: false, minimumPitchDegrees: -35, maximumPitchDegrees: 60, initialYawDegrees: 0, initialPitchDegrees: 15 },
  follow: { distance: 6, height: 2.2, shoulderOffset: 0.6, lookAtHeight: 1.4, positionHalfLifeSeconds: 0.12, rotationHalfLifeSeconds: 0.08 },
  recenter: { enabled: true, delaySeconds: 1.2, yawSpeedDegreesPerSecond: 90, movementInputThreshold: 0.2 },
  collision: { enabled: true, probeRadius: 0.25, minimumDistance: 1, returnHalfLifeSeconds: 0.1 },
  lens: { fieldOfViewDegrees: 65, nearClipDistance: 0.1, farClipDistance: 500 }
});

export interface LoadedProject { root: string; manifestPath: string; manifest: MamProjectManifest }

export async function initProject(workspaceRoot: string, directory?: string): Promise<OperationResult> {
  const command = "project.init";
  const target = path.resolve(workspaceRoot, directory ?? ".");
  const input = { directory: normalizeRepositoryPath(path.relative(workspaceRoot, target)) || "." };
  const manifestPath = path.join(target, PROJECT_MANIFEST_FILE);
  if (await fileExists(manifestPath)) return operationResult({ command, status: "failed", input, errors: [error(ErrorCodes.ProjectAlreadyInitialized, PROJECT_MANIFEST_FILE, "Project is already initialized")] });
  let entries: string[] = [];
  try { entries = await readdir(target); }
  catch (caught) { if ((caught as NodeJS.ErrnoException).code !== "ENOENT") throw caught; }
  const meaningful = entries.filter((entry) => entry !== ".git");
  if (meaningful.length > 0) return operationResult({ command, status: "failed", input, errors: [error(ErrorCodes.ProjectDirectoryNotEmpty, undefined, "Project init requires an empty directory", meaningful, [])] });
  const displayName = title(path.basename(target) || "mam project");
  const manifest: MamProjectManifest = { schemaVersion: 1, kind: "mam-project", id: `${slug(path.basename(target) || "mam-project")}-project`, displayName, definitionRoot: "definitions", entryMovementFile: null, entryCameraFile: null };
  const generatedReadme = `# ${displayName}\n\nCreated with mam-engine.\n\n## Start\n\n\`\`\`sh\nmam movement create movement/player.json\nmam project validate\nmam project play\n\`\`\`\n`;
  await mkdir(path.join(target, "definitions", "movement"), { recursive: true });
  await atomicWriteText(manifestPath, formatJson(manifest));
  await atomicWriteText(path.join(target, ".gitignore"), ".mam-engine/\n");
  await atomicWriteText(path.join(target, "README.md"), generatedReadme);
  return operationResult({ command, status: "passed", input, data: { projectRoot: target, manifest, definitionRoot: manifest.definitionRoot }, changedFiles: [PROJECT_MANIFEST_FILE, ".gitignore", "README.md", "definitions/", "definitions/movement/"] });
}

export async function createMovementProfile(workspaceRoot: string, inputFile: string): Promise<OperationResult> {
  const command = "movement.create";
  const project = await loadProject(workspaceRoot);
  if (!("manifest" in project)) return operationResult({ command, status: "failed", input: { file: inputFile }, errors: project.errors });
  const relativeFile = resolveDefinitionCreatePath(project.manifest, inputFile);
  if (relativeFile === null) return operationResult({ command, status: "failed", input: { file: inputFile }, errors: [error(ErrorCodes.ProjectWriteBlocked, inputFile, "Movement path must be a JSON file inside the project definition root")] });
  const absoluteFile = path.join(project.root, ...relativeFile.split("/"));
  if (await fileExists(absoluteFile)) return operationResult({ command, status: "failed", input: { file: inputFile }, errors: [error(ErrorCodes.ProjectWriteBlocked, relativeFile, "Movement create will not overwrite an existing file")] });
  const base = path.posix.basename(relativeFile, ".json");
  const profile = basicMovement(slug(base), title(base));
  const validation = validateMovementDefinition(profile);
  if (!validation.valid) return operationResult({ command, status: "failed", input: { file: inputFile }, errors: validation.errors });
  const updatedManifest: MamProjectManifest = { ...project.manifest, entryMovementFile: relativeFile };
  try {
    await atomicWriteText(absoluteFile, formatJson(profile));
    await atomicWriteText(project.manifestPath, formatJson(updatedManifest));
  } catch (caught) {
    await rm(absoluteFile, { force: true }).catch(() => undefined);
    throw caught;
  }
  return operationResult({ command, status: "passed", input: { file: inputFile }, data: { file: relativeFile, profile, projectEntryMovementFile: relativeFile }, changedFiles: [relativeFile, PROJECT_MANIFEST_FILE] });
}

export async function createCameraProfile(workspaceRoot: string, inputFile: string): Promise<OperationResult> {
  const command = "camera.create";
  const project = await loadProject(workspaceRoot);
  if (!("manifest" in project)) return operationResult({ command, status: "failed", input: { file: inputFile }, errors: project.errors });
  const relativeFile = resolveDefinitionCreatePath(project.manifest, inputFile);
  if (relativeFile === null) return operationResult({ command, status: "failed", input: { file: inputFile }, errors: [error(ErrorCodes.ProjectWriteBlocked, inputFile, "Camera path must be a JSON file inside the project definition root")] });
  const absoluteFile = path.join(project.root, ...relativeFile.split("/"));
  if (await fileExists(absoluteFile)) return operationResult({ command, status: "failed", input: { file: inputFile }, errors: [error(ErrorCodes.ProjectWriteBlocked, relativeFile, "Camera create will not overwrite an existing file")] });
  const base = path.posix.basename(relativeFile, ".json");
  const profile = basicCamera(slug(base), title(base));
  const validation = validateCameraDefinition(profile);
  if (!validation.valid) return operationResult({ command, status: "failed", input: { file: inputFile }, errors: validation.errors });
  const updatedManifest: MamProjectManifest = { ...project.manifest, entryCameraFile: relativeFile };
  const updatedManifestText = formatJson(updatedManifest);
  const manifestChanged = await readFile(project.manifestPath, "utf8") !== updatedManifestText;
  try {
    await atomicWriteText(absoluteFile, formatJson(profile));
    if (manifestChanged) await atomicWriteText(project.manifestPath, updatedManifestText);
  } catch (caught) {
    await rm(absoluteFile, { force: true }).catch(() => undefined);
    throw caught;
  }
  return operationResult({ command, status: "passed", input: { file: inputFile }, data: { file: relativeFile, profile, projectEntryCameraFile: relativeFile }, changedFiles: [relativeFile, ...(manifestChanged ? [PROJECT_MANIFEST_FILE] : [])] });
}

export async function validateProject(workspaceRoot: string): Promise<OperationResult> {
  const command = "project.validate";
  const inspected = await inspectProjectWorkspace(workspaceRoot);
  const errors = inspected.findings.map((finding) => error(ErrorCodes.ProjectValidationFailed, finding.path ?? finding.file, finding.message));
  return operationResult({ command, status: inspected.valid ? "passed" : "failed", data: inspected, errors, changedFiles: [] });
}

export async function inspectProjectWorkspace(workspaceRoot: string): Promise<{ valid: boolean; initialized: boolean; manifest: MamProjectManifest | null; manifestPath: string; definitionCount: number; validDefinitionCount: number; entryMovementValid: boolean; entryCameraValid: boolean; findings: ProjectValidationFinding[] }> {
  const loaded = await loadProject(workspaceRoot);
  if (!("manifest" in loaded)) return { valid: false, initialized: false, manifest: null, manifestPath: PROJECT_MANIFEST_FILE, definitionCount: 0, validDefinitionCount: 0, entryMovementValid: false, entryCameraValid: false, findings: loaded.findings };
  const findings: ProjectValidationFinding[] = [];
  const definitionRoot = path.join(loaded.root, ...loaded.manifest.definitionRoot.split("/"));
  try { if (!(await stat(definitionRoot)).isDirectory()) findings.push({ code: "PROJECT_DEFINITION_ROOT_INVALID", path: "definitionRoot", message: "Definition root is not a directory" }); }
  catch { findings.push({ code: "PROJECT_DEFINITION_ROOT_INVALID", path: "definitionRoot", message: "Definition root does not exist" }); }
  const files: string[] = [];
  if (findings.length === 0) await visitJson(loaded.root, definitionRoot, files);
  let validDefinitionCount = 0;
  const kinds = new Map<string, DefinitionKind>();
  for (const file of files) {
    let value: unknown;
    try { value = JSON.parse(await readFile(path.join(loaded.root, ...file.split("/")), "utf8")) as unknown; }
    catch { findings.push({ code: "DEFINITION_FILE_INVALID", file, message: "Definition file contains invalid JSON" }); continue; }
    const validation = validateDefinition(value);
    if (!validation.valid || validation.kind === null) { for (const item of validation.errors) findings.push({ code: item.code, file, path: item.path, message: item.message }); continue; }
    const inspection = await inspectRegisteredDefinition(loaded.root, file, validation.kind);
    if (inspection.status !== "passed") { for (const item of inspection.errors) findings.push({ code: item.code, file, path: item.path, message: item.message }); continue; }
    validDefinitionCount += 1;
    kinds.set(file, validation.kind);
  }
  let entryMovementValid = false;
  if (loaded.manifest.entryMovementFile === null) findings.push({ code: "PROJECT_ENTRY_MOVEMENT_INVALID", path: "entryMovementFile", message: "Project entry movement is not configured" });
  else if (!loaded.manifest.entryMovementFile.startsWith(`${loaded.manifest.definitionRoot}/`) || kinds.get(loaded.manifest.entryMovementFile) !== "movement-profile") findings.push({ code: "PROJECT_ENTRY_MOVEMENT_INVALID", path: "entryMovementFile", file: loaded.manifest.entryMovementFile, message: "Project entry movement must resolve to a valid movement-profile inside definitionRoot" });
  else entryMovementValid = true;
  let entryCameraValid = false;
  if (loaded.manifest.entryCameraFile !== undefined && loaded.manifest.entryCameraFile !== null) {
    if (!loaded.manifest.entryCameraFile.startsWith(`${loaded.manifest.definitionRoot}/`) || kinds.get(loaded.manifest.entryCameraFile) !== "camera-profile") findings.push({ code: "PROJECT_ENTRY_CAMERA_INVALID", path: "entryCameraFile", file: loaded.manifest.entryCameraFile, message: "Project entry camera must resolve to a valid camera-profile inside definitionRoot" });
    else entryCameraValid = true;
  }
  return { valid: findings.length === 0, initialized: true, manifest: loaded.manifest, manifestPath: PROJECT_MANIFEST_FILE, definitionCount: files.length, validDefinitionCount, entryMovementValid, entryCameraValid, findings };
}

export async function loadProject(workspaceRoot: string): Promise<LoadedProject | { errors: OperationError[]; findings: ProjectValidationFinding[] }> {
  const root = path.resolve(workspaceRoot);
  const manifestPath = path.join(root, PROJECT_MANIFEST_FILE);
  let value: unknown;
  try { value = JSON.parse(await readFile(manifestPath, "utf8")) as unknown; }
  catch (caught) {
    const code = (caught as NodeJS.ErrnoException).code === "ENOENT" ? ErrorCodes.ProjectFileNotFound : ErrorCodes.ProjectJsonInvalid;
    const message = code === ErrorCodes.ProjectFileNotFound ? "mam-project.json was not found; run 'mam project init' first" : "mam-project.json contains invalid JSON";
    const finding = { code, path: PROJECT_MANIFEST_FILE, message };
    return { findings: [finding], errors: [error(code, PROJECT_MANIFEST_FILE, message)] };
  }
  const validation = validateProjectManifest(value);
  if (!validation.valid || validation.manifest === null) return { findings: validation.findings, errors: validation.findings.map((finding) => error(ErrorCodes.ProjectSchemaInvalid, finding.path, finding.message)) };
  return { root, manifestPath, manifest: validation.manifest };
}

function resolveDefinitionCreatePath(manifest: MamProjectManifest, input: string): string | null {
  const normalized = normalizeRepositoryPath(input);
  if (path.posix.isAbsolute(normalized) || path.win32.isAbsolute(normalized)) return null;
  const relative = normalized.startsWith(`${manifest.definitionRoot}/`) ? normalized : `${manifest.definitionRoot}/${normalized}`;
  if (!safeRelativeJson(relative) || !relative.startsWith(`${manifest.definitionRoot}/`)) return null;
  return relative;
}

async function visitJson(root: string, directory: string, output: string[]): Promise<void> {
  let entries: Dirent[];
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch { return; }
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await visitJson(root, absolute, output);
    else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".json") output.push(normalizeRepositoryPath(path.relative(root, absolute)));
  }
}

function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "player"; }
function title(value: string): string { return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function error(code: OperationError["code"], pathValue: string | undefined, message: string, actual?: unknown, expected?: unknown): OperationError { return { code, ...(pathValue === undefined ? {} : { path: pathValue }), message, ...(actual === undefined ? {} : { actual }), ...(expected === undefined ? {} : { expected }) }; }
