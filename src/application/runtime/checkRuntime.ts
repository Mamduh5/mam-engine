import { ErrorCodes } from "../../shared/errorCodes";
import { operationResult, type OperationResult } from "../../shared/operationResult";
import { isLoadedMovement, loadErrors, loadValidMovement } from "../movement/movementOperationSupport";
import { runMovementFixture, RuntimeFixtureError } from "./runMovementFixture";

export async function checkRuntime(workspaceRoot: string, godot?: string): Promise<OperationResult> {
  const command = "runtime.check";
  const loaded = await loadValidMovement(workspaceRoot, "examples/movement/default.json");
  if (!isLoadedMovement(loaded)) return operationResult({ command, status: "failed", errors: loadErrors(loaded) });
  try {
    const run = await runMovementFixture(workspaceRoot, loaded.profile, "accelerate", 1 / 60, 0, { godot });
    return operationResult({ command, status: "passed", input: {}, data: {
      available: true, executableSource: run.executable.source, reportedVersion: run.executable.version.reportedVersion,
      compatible: run.executable.version.compatible, projectPath: "runtime/godot", headlessSmokePassed: true
    } });
  } catch (caught) { return runtimeFailure(command, caught); }
}

export async function runtimeFailure(command: string, caught: unknown, input: Record<string, unknown> = {}): Promise<OperationResult> {
  const runtimeError = caught instanceof RuntimeFixtureError ? caught : new RuntimeFixtureError(ErrorCodes.RuntimeExecutionFailed, caught instanceof Error ? caught.message : String(caught));
  return operationResult({ command, status: "failed", input, data: runtimeError.session ? { session: { retained: true, path: runtimeError.session.relativeDirectory }, details: runtimeError.details } : { details: runtimeError.details }, errors: [{ code: runtimeError.code, message: runtimeError.message, details: runtimeError.details }] });
}
