#!/usr/bin/env node

import { inspectMovement } from "../application/movement/inspectMovement";
import { inspectCamera } from "../application/camera/inspectCamera";
import { setCameraValue } from "../application/camera/setCameraValue";
import { simulateCameraFile } from "../application/camera/simulateCamera";
import { validateCameraFile } from "../application/camera/validateCamera";
import { setMovementValue } from "../application/movement/setMovementValue";
import { simulateMovementFile } from "../application/movement/simulateMovement";
import { validateMovementFile } from "../application/movement/validateMovement";
import { createSnapshot } from "../application/snapshots/createSnapshot";
import { listSnapshots } from "../application/snapshots/listSnapshots";
import { rollbackSnapshot } from "../application/snapshots/rollbackSnapshot";
import { checkRuntime } from "../application/runtime/checkRuntime";
import { runMovementRuntimeTest } from "../application/runtime/runMovementRuntimeTest";
import { runCameraRuntimeTest } from "../application/runtime/runCameraRuntimeTest";
import { ErrorCodes } from "../shared/errorCodes";
import { operationResult, type OperationResult } from "../shared/operationResult";
import { CliParseError, parseCommand, type ParsedCommand } from "./commandParser";
import { writeResult } from "./output";

export interface CliApplicationDependencies {
  setMovementValue: typeof setMovementValue;
  setCameraValue: typeof setCameraValue;
  rollbackSnapshot: typeof rollbackSnapshot;
}

export interface CliExecution {
  result: OperationResult;
  json: boolean;
  exitCode: number;
}

const productionDependencies: CliApplicationDependencies = { setMovementValue, setCameraValue, rollbackSnapshot };

export async function executeCli(
  argv: string[],
  workspaceRoot = process.cwd(),
  injectedDependencies: Partial<CliApplicationDependencies> = {}
): Promise<CliExecution> {
  const dependencies = { ...productionDependencies, ...injectedDependencies };
  let command: ParsedCommand;
  try {
    command = parseCommand(argv);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    const result = operationResult({
      command: "cli.parse",
      status: "failed",
      input: { arguments: argv },
      errors: [{
        code: caught instanceof CliParseError ? caught.code : ErrorCodes.CliArgumentInvalid,
        message
      }]
    });
    return { result, json: argv.includes("--json"), exitCode: 2 };
  }

  let result: OperationResult;
  try {
    result = await dispatch(command, workspaceRoot, dependencies);
  } catch (caught) {
    result = operationResult({
      command: command.kind,
      status: "failed",
      errors: [{
        code: ErrorCodes.InternalError,
        message: caught instanceof Error ? caught.message : String(caught)
      }]
    });
  }
  return { result, json: command.json, exitCode: result.status === "failed" ? 1 : 0 };
}

export async function runCli(argv: string[], workspaceRoot = process.cwd()): Promise<number> {
  const execution = await executeCli(argv, workspaceRoot);
  writeResult(execution.result, execution.json);
  return execution.exitCode;
}

async function dispatch(
  command: ParsedCommand,
  workspaceRoot: string,
  dependencies: CliApplicationDependencies
): Promise<OperationResult> {
  switch (command.kind) {
    case "camera.inspect": return inspectCamera(workspaceRoot, command.file);
    case "camera.validate": return validateCameraFile(workspaceRoot, command.file);
    case "camera.simulate": return simulateCameraFile(workspaceRoot, command.file, command.scenario, command.seconds, command.fixedDelta);
    case "camera.runtime-test": return runCameraRuntimeTest(workspaceRoot, command.file, command.scenario, command.seconds, command.fixedDelta, { godot: command.godot, keepSession: command.keepSession });
    case "camera.set": return dependencies.setCameraValue(workspaceRoot, command.file, command.propertyPath, command.value, command.dryRun);
    case "movement.inspect":
      return inspectMovement(workspaceRoot, command.file);
    case "movement.validate":
      return validateMovementFile(workspaceRoot, command.file);
    case "movement.simulate":
      return simulateMovementFile(workspaceRoot, command.file, command.scenario, command.seconds);
    case "movement.runtime-test":
      return runMovementRuntimeTest(workspaceRoot, command.file, command.scenario, command.seconds, command.cameraYawDegrees, { godot: command.godot, keepSession: command.keepSession });
    case "movement.set":
      return dependencies.setMovementValue(workspaceRoot, command.file, command.propertyPath, command.value, command.dryRun);
    case "snapshot.list":
      return listSnapshots(workspaceRoot);
    case "snapshot.create":
      return createSnapshot(workspaceRoot, command.file);
    case "snapshot.rollback":
      return dependencies.rollbackSnapshot(workspaceRoot, command.snapshotId);
    case "runtime.check":
      return checkRuntime(workspaceRoot, command.godot);
  }
}

if (require.main === module) {
  void runCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
