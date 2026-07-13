import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { DefinitionKind } from "../../domain/definitions/definitionTypes";
import { atomicWriteText, fileExists, formatJson } from "../files/jsonFileStore";
import { normalizeRepositoryPath, resolveWorkspacePath } from "../files/changedFileAudit";

export interface SnapshotRecord {
  metadataVersion: 1;
  snapshotId: string;
  timestamp: string;
  operation: string;
  targetPath: string;
  contentHash: string;
  previousContent: string;
  definitionKind?: DefinitionKind;
}

export interface SnapshotSummary {
  metadataVersion: 1;
  snapshotId: string;
  timestamp: string;
  operation: string;
  targetPath: string;
  contentHash: string;
  definitionKind?: DefinitionKind;
}

export interface CreatedSnapshot {
  record: SnapshotRecord;
  relativePath: string;
  absolutePath: string;
}

export function snapshotDirectory(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), ".mam-engine", "snapshots");
}

export function contentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function createFileSnapshot(
  workspaceRoot: string,
  targetRelativePath: string,
  previousContent: string,
  operation: string,
  definitionKind?: DefinitionKind
): Promise<CreatedSnapshot> {
  const normalizedTarget = resolveWorkspacePath(workspaceRoot, targetRelativePath).relativePath;
  const timestamp = new Date().toISOString();
  const snapshotId = `${timestamp.replaceAll(":", "-").replaceAll(".", "-")}-${randomUUID()}`;
  const record: SnapshotRecord = {
    metadataVersion: 1,
    snapshotId,
    timestamp,
    operation,
    targetPath: normalizedTarget,
    contentHash: contentHash(previousContent),
    previousContent,
    ...(definitionKind === undefined ? {} : { definitionKind })
  };
  const relativePath = normalizeRepositoryPath(path.join(".mam-engine", "snapshots", `${snapshotId}.json`));
  const absolutePath = path.join(path.resolve(workspaceRoot), ...relativePath.split("/"));
  await atomicWriteText(absolutePath, formatJson(record));
  return { record, relativePath, absolutePath };
}

export async function readSnapshot(workspaceRoot: string, snapshotId: string): Promise<SnapshotRecord | null> {
  if (!/^[A-Za-z0-9._-]+$/.test(snapshotId)) {
    return null;
  }
  const filePath = path.join(snapshotDirectory(workspaceRoot), `${snapshotId}.json`);
  if (!(await fileExists(filePath))) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
  return isSnapshotRecord(parsed) ? parsed : null;
}

export async function listSnapshotSummaries(workspaceRoot: string): Promise<SnapshotSummary[]> {
  const directory = snapshotDirectory(workspaceRoot);
  if (!(await fileExists(directory))) {
    return [];
  }
  const names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  const records = await Promise.all(names.map((name) => readSnapshot(workspaceRoot, name.slice(0, -5))));
  return records.filter((record): record is SnapshotRecord => record !== null).map(({ previousContent: _content, ...summary }) => summary);
}

export function verifySnapshot(record: SnapshotRecord): boolean {
  return record.metadataVersion === 1
    && contentHash(record.previousContent) === record.contentHash;
}

function isSnapshotRecord(value: unknown): value is SnapshotRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.metadataVersion === 1
    && typeof record.snapshotId === "string"
    && typeof record.timestamp === "string"
    && typeof record.operation === "string"
    && typeof record.targetPath === "string"
    && typeof record.contentHash === "string"
    && typeof record.previousContent === "string"
    && (record.definitionKind === undefined || record.definitionKind === "movement-profile" || record.definitionKind === "camera-profile" || record.definitionKind === "targeting-profile" || record.definitionKind === "defensive-action-profile" || record.definitionKind === "offensive-action-profile" || record.definitionKind === "health-profile" || record.definitionKind === "stamina-profile" || record.definitionKind === "action-timeline-profile" || record.definitionKind === "contact-volume-profile");
}
