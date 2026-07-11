import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";

export class JsonFileReadError extends Error {
  constructor(public readonly kind: "not_found" | "invalid_json" | "read_failed", message: string) {
    super(message);
  }
}

export async function readJsonFile(filePath: string): Promise<{ value: unknown; content: string }> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch (caught) {
    const error = caught as NodeJS.ErrnoException;
    throw new JsonFileReadError(
      error.code === "ENOENT" ? "not_found" : "read_failed",
      error.code === "ENOENT" ? "Movement file was not found" : `Movement file could not be read: ${error.message}`
    );
  }

  try {
    return { value: JSON.parse(content) as unknown, content };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    throw new JsonFileReadError("invalid_json", `Movement file contains invalid JSON: ${message}`);
  }
}

export function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function atomicWriteText(filePath: string, content: string): Promise<void> {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
  const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(temporaryPath, "wx");
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, filePath);
  } catch (caught) {
    await handle?.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw caught;
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
