import type { ContactVolumeRuntimeScenario } from "../../domain/runtime/runtimeProtocol";
import { removeRuntimeSession } from "../../infrastructure/runtime/runtimeSessionStore";
import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedContactVolume, loadValidContactVolume } from "../contactVolume/contactVolumeOperationSupport";
import { runtimeFailure } from "./checkRuntime";
import { compareContactVolumeRuntime } from "./compareContactVolumeRuntime";
import { runContactVolumeFixture, type RunContactVolumeFixtureOptions } from "./runContactVolumeFixture";

export async function runContactVolumeRuntimeTest(workspaceRoot: string, hitboxFile: string, hurtboxFile: string, scenario: ContactVolumeRuntimeScenario, fixedDelta?: number, options: RunContactVolumeFixtureOptions = {}): Promise<OperationResult> {
  const command = "contact-volume.runtime-test"; const input = { hitboxFile, hurtboxFile, scenario, ...(fixedDelta === undefined ? {} : { fixedDelta }) };
  const hitbox = await loadValidContactVolume(workspaceRoot, hitboxFile); if (!isLoadedContactVolume(hitbox)) return operationResult({ command, status: "failed", input, errors: hitbox.errors });
  const hurtbox = await loadValidContactVolume(workspaceRoot, hurtboxFile); if (!isLoadedContactVolume(hurtbox)) return operationResult({ command, status: "failed", input: { ...input, hitboxFile: hitbox.relativePath }, errors: hurtbox.errors });
  if (hitbox.profile.role !== "hitbox") return roleFailure(command, input, hitbox.relativePath, "hitbox", hitbox.profile.role);
  if (hurtbox.profile.role !== "hurtbox") return roleFailure(command, input, hurtbox.relativePath, "hurtbox", hurtbox.profile.role);
  try { const run = await runContactVolumeFixture(workspaceRoot, hitbox.profile, hurtbox.profile, scenario, fixedDelta, { ...options, keepSession: true }); const comparison = compareContactVolumeRuntime(run.simulation, run.response.metrics); if (comparison.passed && options.keepSession !== true) { await removeRuntimeSession(run.runtimeSession); run.session = { retained: false, path: null }; } const data = { runtime: { fixtureId: run.request.fixtureId, scenarioId: scenario, godotVersion: run.executable.version.reportedVersion, metrics: run.response.metrics, evidence: run.response.evidence, process: run.process }, simulation: run.simulation, comparison, session: run.session, internalArtifacts: run.internalArtifacts }; if (!comparison.passed) return operationResult({ command, status: "failed", input: { ...input, hitboxFile: hitbox.relativePath, hurtboxFile: hurtbox.relativePath }, data, errors: [{ code: ErrorCodes.RuntimeMetricToleranceExceeded, message: "Contact volume runtime metrics differ from the TypeScript simulation", details: { failedMetrics: comparison.metrics.filter((metric) => !metric.passed) } }] }); return operationResult({ command, status: "passed", input: { ...input, hitboxFile: hitbox.relativePath, hurtboxFile: hurtbox.relativePath }, data }); } catch (caught) { return runtimeFailure(command, caught, input); }
}

function roleFailure(command: string, input: Record<string, unknown>, path: string, expected: string, actual: string): OperationResult { return operationResult({ command, status: "failed", input, errors: [{ code: ErrorCodes.ContactVolumeRoleInvalid, path, message: `Contact volume must have role ${expected}`, expected, actual }] }); }
