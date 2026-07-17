import path from "node:path";

import type { MamProjectManifest, ProjectValidationFinding } from "./projectTypes";

const keys = ["schemaVersion", "kind", "id", "displayName", "definitionRoot", "entryMovementFile", "entryCameraFile", "entryTargetingFile"] as const;

export function validateProjectManifest(value: unknown): { valid: boolean; manifest: MamProjectManifest | null; findings: ProjectValidationFinding[] } {
  const findings: ProjectValidationFinding[] = [];
  if (!isRecord(value)) return { valid: false, manifest: null, findings: [{ code: "PROJECT_SCHEMA_INVALID", message: "Project manifest must be an object" }] };
  for (const key of Object.keys(value)) if (!(keys as readonly string[]).includes(key)) findings.push({ code: "PROJECT_SCHEMA_INVALID", path: key, message: "Unsupported project manifest field" });
  if (value.schemaVersion !== 1) findings.push({ code: "PROJECT_SCHEMA_INVALID", path: "schemaVersion", message: "schemaVersion must be 1" });
  if (value.kind !== "mam-project") findings.push({ code: "PROJECT_SCHEMA_INVALID", path: "kind", message: "kind must be mam-project" });
  if (!nonEmpty(value.id)) findings.push({ code: "PROJECT_SCHEMA_INVALID", path: "id", message: "id must be a non-empty string" });
  if (!nonEmpty(value.displayName)) findings.push({ code: "PROJECT_SCHEMA_INVALID", path: "displayName", message: "displayName must be a non-empty string" });
  if (!safeRelativeDirectory(value.definitionRoot)) findings.push({ code: "PROJECT_DEFINITION_ROOT_INVALID", path: "definitionRoot", message: "definitionRoot must be a safe workspace-relative directory" });
  if (value.entryMovementFile !== null && !safeRelativeJson(value.entryMovementFile)) findings.push({ code: "PROJECT_ENTRY_MOVEMENT_INVALID", path: "entryMovementFile", message: "entryMovementFile must be null or a safe workspace-relative JSON path" });
  if (value.entryCameraFile !== undefined && value.entryCameraFile !== null && !safeRelativeJson(value.entryCameraFile)) findings.push({ code: "PROJECT_ENTRY_CAMERA_INVALID", path: "entryCameraFile", message: "entryCameraFile must be null or a safe workspace-relative JSON path" });
  if (value.entryTargetingFile !== undefined && value.entryTargetingFile !== null && !safeRelativeJson(value.entryTargetingFile)) findings.push({ code: "PROJECT_ENTRY_TARGETING_INVALID", path: "entryTargetingFile", message: "entryTargetingFile must be null or a safe workspace-relative JSON path" });
  return findings.length === 0 ? { valid: true, manifest: value as unknown as MamProjectManifest, findings } : { valid: false, manifest: null, findings };
}

export function safeRelativeDirectory(value: unknown): value is string {
  return nonEmpty(value) && !path.isAbsolute(value) && !value.includes("\\") && !value.split("/").some((part) => part === "" || part === "." || part === "..");
}

export function safeRelativeJson(value: unknown): value is string {
  return safeRelativeDirectory(value) && path.posix.extname(value).toLowerCase() === ".json";
}

function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
