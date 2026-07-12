import { deriveTargetingMetrics } from "../../domain/targeting/targetingMetrics";
import { auditChangedFiles, captureWorkspaceState } from "../../infrastructure/files/changedFileAudit";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedTargeting, loadValidTargeting } from "./targetingOperationSupport";

export async function inspectTargeting(workspaceRoot: string, inputFile: string): Promise<OperationResult> { const command = "targeting.inspect"; const input = { file: inputFile }; const before = await captureWorkspaceState(workspaceRoot); const loaded = await loadValidTargeting(workspaceRoot, inputFile); const audit = auditChangedFiles(before, await captureWorkspaceState(workspaceRoot), []); if (!audit.ok) return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.TargetingWriteBlocked, message: "Read-only targeting inspection changed unexpected files", details: { unexpectedFiles: audit.unexpectedFiles } }], changedFiles: audit.changedFiles }); if (!isLoadedTargeting(loaded)) return operationResult({ command, status: "failed", input, errors: loaded.errors }); return operationResult({ command, status: "passed", input: { file: loaded.relativePath }, data: { profile: loaded.profile, derivedMetrics: deriveTargetingMetrics(loaded.profile) } }); }
