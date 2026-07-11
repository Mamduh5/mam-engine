import { randomUUID } from "node:crypto";

import type { ErrorCode } from "./errorCodes";

export type OperationStatus = "passed" | "failed" | "dry_run" | "rolled_back";

export interface OperationError {
  code: ErrorCode;
  path?: string;
  message: string;
  actual?: unknown;
  expected?: unknown;
  details?: Record<string, unknown>;
}

export interface OperationWarning {
  code: string;
  message: string;
  path?: string;
}

export interface OperationResult<T = unknown> {
  protocolVersion: 1;
  command: string;
  status: OperationStatus;
  correlationId: string;
  input: Record<string, unknown>;
  data: T | null;
  errors: OperationError[];
  warnings: OperationWarning[];
  changedFiles: string[];
  snapshotId: string | null;
}

export function operationResult<T>(options: {
  command: string;
  status: OperationStatus;
  input?: Record<string, unknown>;
  data?: T | null;
  errors?: OperationError[];
  warnings?: OperationWarning[];
  changedFiles?: string[];
  snapshotId?: string | null;
}): OperationResult<T> {
  return {
    protocolVersion: 1,
    command: options.command,
    status: options.status,
    correlationId: randomUUID(),
    input: options.input ?? {},
    data: options.data ?? null,
    errors: options.errors ?? [],
    warnings: options.warnings ?? [],
    changedFiles: options.changedFiles ?? [],
    snapshotId: options.snapshotId ?? null
  };
}
