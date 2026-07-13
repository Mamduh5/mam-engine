import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { inspectProjectWorkspace, loadProject } from "../project/projectOperations";
import { isLoadedMovement, loadErrors, loadValidMovement } from "../movement/movementOperationSupport";
import { auditChangedFiles, captureWorkspaceState, normalizeRepositoryPath, type FileState } from "../../infrastructure/files/changedFileAudit";
import { atomicWriteText, fileExists, formatJson } from "../../infrastructure/files/jsonFileStore";
import { resolvePackageAsset } from "../../infrastructure/runtime/packageAssetResolver";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationError, type OperationResult } from "../../shared/operationResult";

export const GODOT_CONSUMER_CONTRACT = "mam.godot-consumer/v1";
export const GODOT_RUNTIME_BUNDLE_SCHEMA = "mam.godot-runtime-bundle/v1";
export const GODOT_ADAPTER_CONTRACT = "mam.godot-movement-adapter/v1";
export const GODOT_ADDON_ROOT = "addons/mam_engine";
export const GODOT_MANIFEST_FILE = `${GODOT_ADDON_ROOT}/mam-managed-files.json`;
export const GODOT_BUNDLE_FILE = "mam_generated/mam_runtime_bundle.json";

interface ManagedFile { path: string; sha256: string }
interface ManagedManifest { schemaVersion: typeof GODOT_CONSUMER_CONTRACT; packageVersion: string; consumerContractVersion: typeof GODOT_ADAPTER_CONTRACT; files: ManagedFile[] }
interface SourcePlan { packageVersion: string; manifest: ManagedManifest; manifestText: string; files: Map<string, string> }
export interface GodotConsumerDependencies { writeText: (filePath: string, content: string) => Promise<void>; removeFile: (filePath: string) => Promise<void>; captureState: (root: string) => Promise<FileState> }
const productionDependencies: GodotConsumerDependencies = { writeText: atomicWriteText, removeFile: (filePath) => rm(filePath, { force: true }), captureState: captureWorkspaceState };

export async function installGodotConsumer(projectRoot: string, injected: Partial<GodotConsumerDependencies> = {}): Promise<OperationResult> {
  const command = "godot.consumer.install"; const dependencies = { ...productionDependencies, ...injected };
  const validation = await inspectProjectWorkspace(projectRoot);
  if (!validation.valid) return operationResult({ command, status: "failed", errors: projectErrors(validation.findings) });
  let plan: SourcePlan; try { plan = await buildSourcePlan(); } catch (caught) { return operationResult({ command, status: "failed", errors: [{ code: ErrorCodes.GodotConsumerAssetMissing, message: message(caught) }] }); }
  const before = await dependencies.captureState(projectRoot); const inspection = await inspectInstalledAddon(projectRoot, plan, false);
  if (!inspection.ok) return operationResult({ command, status: "failed", errors: inspection.errors, changedFiles: [] });
  const desired = new Map(plan.files); desired.set(GODOT_MANIFEST_FILE, plan.manifestText);
  const removals = inspection.previousFiles.filter((file) => !desired.has(file));
  const mutations = [...desired].filter(([file, content]) => before.get(file) !== sha256(content)).map(([file, content]) => ({ file, content }));
  const allowed = [...new Set([...mutations.map((item) => item.file), ...removals])].sort();
  if (allowed.length === 0) return operationResult({ command, status: "passed", data: installData(plan), changedFiles: [] });
  const transaction = await mutateFiles(projectRoot, before, mutations, removals, allowed, dependencies);
  if (!transaction.ok) return operationResult({ command, status: "failed", data: { recovery: transaction.recovery }, errors: transaction.errors, changedFiles: transaction.changedFiles });
  const finalInspection = await inspectInstalledAddon(projectRoot, plan, true);
  if (!finalInspection.ok) return operationResult({ command, status: "failed", errors: finalInspection.errors, changedFiles: transaction.changedFiles });
  return operationResult({ command, status: "passed", data: installData(plan), changedFiles: transaction.changedFiles });
}

export async function syncGodotConsumer(projectRoot: string, check: boolean, injected: Partial<GodotConsumerDependencies> = {}): Promise<OperationResult> {
  const command = "godot.consumer.sync"; const dependencies = { ...productionDependencies, ...injected }; const before = await dependencies.captureState(projectRoot);
  const validation = await inspectProjectWorkspace(projectRoot);
  if (!validation.valid) return operationResult({ command, status: "failed", input: { check }, errors: projectErrors(validation.findings), changedFiles: [] });
  let plan: SourcePlan; try { plan = await buildSourcePlan(); } catch (caught) { return operationResult({ command, status: "failed", input: { check }, errors: [{ code: ErrorCodes.GodotConsumerAssetMissing, message: message(caught) }], changedFiles: [] }); }
  const addon = await inspectInstalledAddon(projectRoot, plan, true);
  if (!addon.ok) return operationResult({ command, status: "failed", input: { check }, errors: addon.errors, changedFiles: [] });
  const loadedProject = await loadProject(projectRoot);
  if (!("manifest" in loadedProject) || loadedProject.manifest.entryMovementFile === null) return operationResult({ command, status: "failed", input: { check }, errors: [{ code: ErrorCodes.GodotConsumerProjectInvalid, path: "entryMovementFile", message: "Project entry movement is not configured" }], changedFiles: [] });
  const movement = await loadValidMovement(projectRoot, loadedProject.manifest.entryMovementFile);
  if (!isLoadedMovement(movement)) return operationResult({ command, status: "failed", input: { check }, errors: loadErrors(movement), changedFiles: [] });
  const bundle = buildBundle(plan.packageVersion, movement.relativePath, movement.content, movement.profile); const bundlePath = path.join(projectRoot, ...GODOT_BUNDLE_FILE.split("/"));
  let current: string | null = null; try { current = await readFile(bundlePath, "utf8"); } catch (caught) { if ((caught as NodeJS.ErrnoException).code !== "ENOENT") return operationResult({ command, status: "failed", input: { check }, errors: [{ code: ErrorCodes.GodotRuntimeBundleMalformed, path: GODOT_BUNDLE_FILE, message: message(caught) }], changedFiles: [] }); }
  if (check) {
    if (current === null) return operationResult({ command, status: "failed", input: { check }, errors: [{ code: ErrorCodes.GodotRuntimeBundleMissing, path: GODOT_BUNDLE_FILE, message: "Generated runtime bundle is missing; run 'mam godot consumer sync'" }], changedFiles: [] });
    if (current !== bundle.text) { const malformed = !validJson(current); return operationResult({ command, status: "failed", input: { check }, errors: [{ code: malformed ? ErrorCodes.GodotRuntimeBundleMalformed : ErrorCodes.GodotRuntimeBundleStale, path: GODOT_BUNDLE_FILE, message: malformed ? "Generated runtime bundle is malformed" : "Generated runtime bundle is stale or incompatible" }], changedFiles: [] }); }
    return operationResult({ command, status: "passed", input: { check }, data: bundle.data, changedFiles: [] });
  }
  if (current === bundle.text) return operationResult({ command, status: "passed", input: { check }, data: bundle.data, changedFiles: [] });
  const transaction = await mutateFiles(projectRoot, before, [{ file: GODOT_BUNDLE_FILE, content: bundle.text }], [], [GODOT_BUNDLE_FILE], dependencies);
  if (!transaction.ok) return operationResult({ command, status: "failed", input: { check }, data: { recovery: transaction.recovery }, errors: transaction.errors.map((error) => ({ ...error, code: error.code === ErrorCodes.GodotConsumerInstallFailed ? ErrorCodes.GodotRuntimeBundleWriteFailed : error.code })), changedFiles: transaction.changedFiles });
  return operationResult({ command, status: "passed", input: { check }, data: bundle.data, changedFiles: transaction.changedFiles });
}

async function buildSourcePlan(): Promise<SourcePlan> {
  const packageJsonAsset = await resolvePackageAsset("package.json"); const packageJson = JSON.parse(await readFile(packageJsonAsset.path, "utf8")) as { version?: unknown };
  if (typeof packageJson.version !== "string") throw new Error("Installed package version is unavailable");
  const sourceRoot = path.join(packageJsonAsset.packageRoot, "runtime", "godot", "addons", "mam_engine"); const relativeFiles: string[] = []; await visit(sourceRoot, sourceRoot, relativeFiles);
  if (relativeFiles.length === 0) throw new Error("Packaged production Godot addon is empty");
  const files = new Map<string, string>(); const records: ManagedFile[] = [];
  for (const relative of relativeFiles) { const content = await readFile(path.join(sourceRoot, ...relative.split("/")), "utf8"); const target = `${GODOT_ADDON_ROOT}/${relative}`; files.set(target, content); records.push({ path: target, sha256: sha256(content) }); }
  const manifest: ManagedManifest = { schemaVersion: GODOT_CONSUMER_CONTRACT, packageVersion: packageJson.version, consumerContractVersion: GODOT_ADAPTER_CONTRACT, files: records };
  return { packageVersion: packageJson.version, manifest, manifestText: stableJson(manifest), files };
}
async function visit(root: string, directory: string, output: string[]): Promise<void> { const entries: Dirent[] = await readdir(directory, { withFileTypes: true }); entries.sort((a, b) => a.name.localeCompare(b.name)); for (const entry of entries) { const absolute = path.join(directory, entry.name); if (entry.isDirectory()) await visit(root, absolute, output); else if (entry.isFile() && entry.name !== "plugin.cfg" && entry.name !== "mam-managed-files.json") output.push(normalizeRepositoryPath(path.relative(root, absolute))); } }

async function inspectInstalledAddon(root: string, plan: SourcePlan, requirePresent: boolean): Promise<{ ok: boolean; previousFiles: string[]; errors: OperationError[] }> {
  const manifestPath = path.join(root, ...GODOT_MANIFEST_FILE.split("/")); let content: string;
  try { content = await readFile(manifestPath, "utf8"); } catch (caught) {
    if ((caught as NodeJS.ErrnoException).code === "ENOENT") { if (requirePresent) return { ok: false, previousFiles: [], errors: [{ code: ErrorCodes.GodotConsumerAddonMissing, path: GODOT_MANIFEST_FILE, message: "Managed Godot addon is not installed; run 'mam godot consumer install'" }] }; for (const file of [...plan.files.keys(), GODOT_MANIFEST_FILE]) if (await fileExists(path.join(root, ...file.split("/")))) return { ok: false, previousFiles: [], errors: [{ code: ErrorCodes.GodotConsumerUnownedConflict, path: file, message: "Install would overwrite an unowned file" }] }; return { ok: true, previousFiles: [], errors: [] }; }
    return { ok: false, previousFiles: [], errors: [{ code: ErrorCodes.GodotConsumerManifestInvalid, path: GODOT_MANIFEST_FILE, message: message(caught) }] };
  }
  const parsed = parseManifest(content); if (parsed === null) return { ok: false, previousFiles: [], errors: [{ code: ErrorCodes.GodotConsumerManifestInvalid, path: GODOT_MANIFEST_FILE, message: "Managed addon manifest is malformed or uses an unsupported contract" }] };
  const previousFiles = parsed.files.map((file) => file.path);
  for (const record of parsed.files) { const absolute = safeManagedPath(root, record.path); if (absolute === null) return { ok: false, previousFiles, errors: [{ code: ErrorCodes.GodotConsumerManifestInvalid, path: record.path, message: "Managed manifest contains an unsafe path" }] }; let actual: string; try { actual = sha256(await readFile(absolute)); } catch { return { ok: false, previousFiles, errors: [{ code: ErrorCodes.GodotConsumerManagedFileDrift, path: record.path, message: "Previously managed addon file is missing or unreadable" }] }; } if (actual !== record.sha256) return { ok: false, previousFiles, errors: [{ code: ErrorCodes.GodotConsumerManagedFileDrift, path: record.path, message: "Previously managed addon file has local modifications" }] }; }
  const previous = new Set(previousFiles); for (const file of plan.files.keys()) if (!previous.has(file) && await fileExists(path.join(root, ...file.split("/")))) return { ok: false, previousFiles, errors: [{ code: ErrorCodes.GodotConsumerUnownedConflict, path: file, message: "Upgrade would overwrite an unowned file" }] };
  if (requirePresent && content !== plan.manifestText) return { ok: false, previousFiles, errors: [{ code: ErrorCodes.GodotConsumerAddonStale, path: GODOT_MANIFEST_FILE, message: "Managed Godot addon is not current for this mam-engine package" }] };
  return { ok: true, previousFiles, errors: [] };
}
function parseManifest(content: string): ManagedManifest | null { try { const value = JSON.parse(content) as Partial<ManagedManifest>; if (value.schemaVersion !== GODOT_CONSUMER_CONTRACT || typeof value.packageVersion !== "string" || value.consumerContractVersion !== GODOT_ADAPTER_CONTRACT || !Array.isArray(value.files)) return null; if (!value.files.every((file) => file && typeof file.path === "string" && typeof file.sha256 === "string" && /^[a-f0-9]{64}$/.test(file.sha256)) || new Set(value.files.map((file) => file.path)).size !== value.files.length) return null; return value as ManagedManifest; } catch { return null; } }

function buildBundle(packageVersion: string, sourcePath: string, sourceContent: string, profile: unknown): { text: string; data: Record<string, unknown> } { const payload = stableValue({ adapterContractVersion: GODOT_ADAPTER_CONTRACT, definition: { kind: "movement-profile", profile: stableValue(profile), schemaVersion: 1, sourcePath: normalizeRepositoryPath(sourcePath), sourceSha256: sha256(sourceContent) }, packageVersion }); const payloadJson = JSON.stringify(payload); const value = { schemaVersion: GODOT_RUNTIME_BUNDLE_SCHEMA, payloadJson, integrity: { algorithm: "sha256", payloadSha256: sha256(payloadJson) } }; return { text: stableJson(value), data: { bundleFile: GODOT_BUNDLE_FILE, schemaVersion: GODOT_RUNTIME_BUNDLE_SCHEMA, sourcePath: normalizeRepositoryPath(sourcePath), sourceSha256: sha256(sourceContent), payloadSha256: sha256(payloadJson) } }; }

async function mutateFiles(root: string, before: FileState, writes: { file: string; content: string }[], removals: string[], allowed: string[], dependencies: GodotConsumerDependencies): Promise<{ ok: true; changedFiles: string[] } | { ok: false; changedFiles: string[]; recovery: Record<string, unknown>; errors: OperationError[] }> {
  const originals = new Map<string, string | null>(); for (const file of allowed) { try { originals.set(file, await readFile(path.join(root, ...file.split("/")), "utf8")); } catch (caught) { if ((caught as NodeJS.ErrnoException).code === "ENOENT") originals.set(file, null); else throw caught; } }
  try { for (const item of writes) await dependencies.writeText(path.join(root, ...item.file.split("/")), item.content); for (const file of removals) await dependencies.removeFile(path.join(root, ...file.split("/"))); for (const item of writes) if (sha256(await readFile(path.join(root, ...item.file.split("/")))) !== sha256(item.content)) throw new Error(`Post-write hash verification failed for ${item.file}`); for (const file of removals) if (await fileExists(path.join(root, ...file.split("/")))) throw new Error(`Managed removal verification failed for ${file}`); const audit = auditChangedFiles(before, await dependencies.captureState(root), allowed); if (!audit.ok) throw new Error(`Write-scope audit found unexpected files: ${audit.unexpectedFiles.join(", ")}`); return { ok: true, changedFiles: audit.changedFiles }; }
  catch (caught) { let recovered = true; for (const [file, content] of originals) { try { if (content === null) await dependencies.removeFile(path.join(root, ...file.split("/"))); else await dependencies.writeText(path.join(root, ...file.split("/")), content); } catch { recovered = false; } } const audit = auditChangedFiles(before, await dependencies.captureState(root), []); recovered = recovered && audit.ok; return { ok: false, changedFiles: audit.changedFiles, recovery: { attempted: true, status: recovered ? "restored" : "failed", contentHashVerified: recovered, scopeAuditPassed: audit.ok }, errors: [{ code: recovered ? ErrorCodes.GodotConsumerInstallFailed : ErrorCodes.GodotConsumerRecoveryFailed, message: message(caught) }] }; }
}

function projectErrors(findings: { path?: string; file?: string; message: string }[]): OperationError[] { return findings.map((finding) => ({ code: ErrorCodes.GodotConsumerProjectInvalid, ...((finding.path ?? finding.file) ? { path: finding.path ?? finding.file } : {}), message: finding.message })); }
function installData(plan: SourcePlan): Record<string, unknown> { return { addonRoot: GODOT_ADDON_ROOT, manifestFile: GODOT_MANIFEST_FILE, packageVersion: plan.packageVersion, consumerContractVersion: GODOT_ADAPTER_CONTRACT, managedFileCount: plan.manifest.files.length }; }
function safeManagedPath(root: string, relative: string): string | null { const normalized = normalizeRepositoryPath(relative); if (!normalized.startsWith(`${GODOT_ADDON_ROOT}/`) || normalized.includes("../") || path.isAbsolute(relative)) return null; const absolute = path.resolve(root, ...normalized.split("/")); return absolute.startsWith(`${path.resolve(root)}${path.sep}`) ? absolute : null; }
function stableValue(value: unknown): unknown { if (Array.isArray(value)) return value.map(stableValue); if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)])); return value; }
function stableJson(value: unknown): string { return formatJson(stableValue(value)); }
function sha256(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }
function validJson(value: string): boolean { try { JSON.parse(value); return true; } catch { return false; } }
function message(caught: unknown): string { return caught instanceof Error ? caught.message : String(caught); }
