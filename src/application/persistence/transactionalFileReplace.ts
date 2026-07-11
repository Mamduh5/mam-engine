import { readFile } from "node:fs/promises";

import {
  auditChangedFiles,
  captureWorkspaceState,
  type ChangedFileAudit,
  type FileState
} from "../../infrastructure/files/changedFileAudit";
import { atomicWriteText } from "../../infrastructure/files/jsonFileStore";
import { contentHash } from "../../infrastructure/snapshots/fileSnapshotStore";
import type { OperationError } from "../../shared/operationResult";

export type TransactionFailureStage =
  | "atomic_write"
  | "post_write_read"
  | "post_write_hash"
  | "post_write_validation"
  | "scope_audit";

export type RecoveryStatus = "not_required" | "restored" | "failed";

export interface ContentVerification<T = unknown> {
  validationPassed: boolean;
  value?: T;
  errors?: OperationError[];
}

export interface RecoveryEvidence {
  attempted: boolean;
  status: RecoveryStatus;
  restoredFile: string;
  contentHashVerified: boolean;
  validationPassed: boolean;
  scopeAuditPassed: boolean;
}

export interface TransactionalReplaceSuccess<T> {
  ok: true;
  value: T;
  contentHashVerified: true;
  validationPassed: true;
  changedFiles: string[];
}

export interface TransactionalReplaceFailure {
  ok: false;
  failureStage: TransactionFailureStage;
  failureMessage: string;
  verificationErrors: OperationError[];
  changedFiles: string[];
  unexpectedFiles: string[];
  recovery: RecoveryEvidence;
}

export type TransactionalReplaceResult<T> = TransactionalReplaceSuccess<T> | TransactionalReplaceFailure;

export interface TransactionalFileReplaceDependencies {
  writeText: (filePath: string, content: string) => Promise<void>;
  readText: (filePath: string) => Promise<string>;
  captureState: (workspaceRoot: string) => Promise<FileState>;
  audit: (before: FileState, after: FileState, allowedPaths: string[]) => ChangedFileAudit;
}

export interface TransactionalFileReplaceOptions<T> {
  workspaceRoot: string;
  operationStartState: FileState;
  targetAbsolutePath: string;
  targetRelativePath: string;
  replacementContent: string;
  originalContent: string;
  allowedPaths: string[];
  verifyContent: (content: string) => Promise<ContentVerification<T>> | ContentVerification<T>;
  dependencies?: Partial<TransactionalFileReplaceDependencies>;
}

const productionDependencies: TransactionalFileReplaceDependencies = {
  writeText: atomicWriteText,
  readText: (filePath) => readFile(filePath, "utf8"),
  captureState: captureWorkspaceState,
  audit: auditChangedFiles
};

export async function transactionalFileReplace<T>(
  options: TransactionalFileReplaceOptions<T>
): Promise<TransactionalReplaceResult<T>> {
  const dependencies = { ...productionDependencies, ...options.dependencies };
  const replacementHash = contentHash(options.replacementContent);
  const originalHash = contentHash(options.originalContent);

  try {
    await dependencies.writeText(options.targetAbsolutePath, options.replacementContent);
  } catch (caught) {
    const message = `Atomic replacement write failed: ${errorMessage(caught)}`;
    const unchanged = await verifyCurrentContent(options, dependencies, originalHash);
    if (unchanged.hashVerified && unchanged.verification.validationPassed && unchanged.verification.value !== undefined) {
      const audit = await safeFinalAudit(options, dependencies);
      return {
        ok: false,
        failureStage: "atomic_write",
        failureMessage: message,
        verificationErrors: [],
        changedFiles: audit.changedFiles,
        unexpectedFiles: audit.unexpectedFiles,
        recovery: {
          attempted: false,
          status: "not_required",
          restoredFile: options.targetRelativePath,
          contentHashVerified: true,
          validationPassed: true,
          scopeAuditPassed: audit.ok
        }
      };
    }
    return recover(options, dependencies, "atomic_write", message, []);
  }

  let persistedContent: string;
  try {
    persistedContent = await dependencies.readText(options.targetAbsolutePath);
  } catch (caught) {
    return recover(
      options,
      dependencies,
      "post_write_read",
      `Persisted target could not be re-read: ${errorMessage(caught)}`,
      []
    );
  }

  if (contentHash(persistedContent) !== replacementHash) {
    return recover(
      options,
      dependencies,
      "post_write_hash",
      "Persisted target hash does not match the validated replacement content",
      []
    );
  }

  const verification = await safeVerify(options.verifyContent, persistedContent);
  if (!verification.validationPassed || verification.value === undefined) {
    return recover(
      options,
      dependencies,
      "post_write_validation",
      "Persisted target failed post-write movement validation",
      verification.errors ?? []
    );
  }

  let audit: ChangedFileAudit;
  try {
    audit = await finalAudit(options, dependencies);
  } catch (caught) {
    return recover(
      options,
      dependencies,
      "scope_audit",
      `Changed-file scope audit could not complete: ${errorMessage(caught)}`,
      []
    );
  }
  if (!audit.ok) {
    return recover(
      options,
      dependencies,
      "scope_audit",
      "Persisted operation changed files outside its declared scope",
      []
    );
  }

  return {
    ok: true,
    value: verification.value,
    contentHashVerified: true,
    validationPassed: true,
    changedFiles: audit.changedFiles
  };
}

async function recover<T>(
  options: TransactionalFileReplaceOptions<T>,
  dependencies: TransactionalFileReplaceDependencies,
  failureStage: TransactionFailureStage,
  failureMessage: string,
  verificationErrors: OperationError[]
): Promise<TransactionalReplaceFailure> {
  const originalHash = contentHash(options.originalContent);
  let contentHashVerified = false;
  let validationPassed = false;

  try {
    await dependencies.writeText(options.targetAbsolutePath, options.originalContent);
    const restoredContent = await dependencies.readText(options.targetAbsolutePath);
    contentHashVerified = contentHash(restoredContent) === originalHash;
    const verification = await safeVerify(options.verifyContent, restoredContent);
    validationPassed = verification.validationPassed && verification.value !== undefined;
  } catch {
    // The structured evidence below records the failed recovery without hiding the original failure.
  }

  let audit: ChangedFileAudit;
  try {
    audit = await finalAudit(options, dependencies);
  } catch {
    audit = { ok: false, changedFiles: [], unexpectedFiles: [] };
  }
  const restored = contentHashVerified && validationPassed && audit.ok;
  return {
    ok: false,
    failureStage,
    failureMessage,
    verificationErrors,
    changedFiles: audit.changedFiles,
    unexpectedFiles: audit.unexpectedFiles,
    recovery: {
      attempted: true,
      status: restored ? "restored" : "failed",
      restoredFile: options.targetRelativePath,
      contentHashVerified,
      validationPassed,
      scopeAuditPassed: audit.ok
    }
  };
}

async function verifyCurrentContent<T>(
  options: TransactionalFileReplaceOptions<T>,
  dependencies: TransactionalFileReplaceDependencies,
  expectedHash: string
): Promise<{ hashVerified: boolean; verification: ContentVerification<T> }> {
  try {
    const content = await dependencies.readText(options.targetAbsolutePath);
    return {
      hashVerified: contentHash(content) === expectedHash,
      verification: await safeVerify(options.verifyContent, content)
    };
  } catch {
    return { hashVerified: false, verification: { validationPassed: false } };
  }
}

async function finalAudit<T>(
  options: TransactionalFileReplaceOptions<T>,
  dependencies: TransactionalFileReplaceDependencies
): Promise<ChangedFileAudit> {
  return dependencies.audit(
    options.operationStartState,
    await dependencies.captureState(options.workspaceRoot),
    options.allowedPaths
  );
}

async function safeFinalAudit<T>(
  options: TransactionalFileReplaceOptions<T>,
  dependencies: TransactionalFileReplaceDependencies
): Promise<ChangedFileAudit> {
  try {
    return await finalAudit(options, dependencies);
  } catch {
    return { ok: false, changedFiles: [], unexpectedFiles: [] };
  }
}

async function safeVerify<T>(
  verify: TransactionalFileReplaceOptions<T>["verifyContent"],
  content: string
): Promise<ContentVerification<T>> {
  try {
    return await verify(content);
  } catch {
    return { validationPassed: false };
  }
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}
