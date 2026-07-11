#!/usr/bin/env node

import { inspectMovement } from "../application/movement/inspectMovement";
import { setMovementValue } from "../application/movement/setMovementValue";
import { simulateMovementFile } from "../application/movement/simulateMovement";
import { validateMovementFile } from "../application/movement/validateMovement";
import { createSnapshot } from "../application/snapshots/createSnapshot";
import { listSnapshots } from "../application/snapshots/listSnapshots";
import { rollbackSnapshot } from "../application/snapshots/rollbackSnapshot";
import { ErrorCodes } from "../shared/errorCodes";
import { operationResult, type OperationResult } from "../shared/operationResult";
import { CliParseError, parseCommand, type ParsedCommand } from "./commandParser";
import { writeResult } from "./output";

export async function runCli(argv: string[], workspaceRoot = process.cwd()): Promise<number> {
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
    writeResult(result, argv.includes("--json"));
    return 2;
  }

  let result: OperationResult;
  try {
    result = await dispatch(command, workspaceRoot);
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
  writeResult(result, command.json);
  return result.status === "failed" ? 1 : 0;
}

async function dispatch(command: ParsedCommand, workspaceRoot: string): Promise<OperationResult> {
  switch (command.kind) {
    case "movement.inspect":
      return inspectMovement(workspaceRoot, command.file);
    case "movement.validate":
      return validateMovementFile(workspaceRoot, command.file);
    case "movement.simulate":
      return simulateMovementFile(workspaceRoot, command.file, command.scenario, command.seconds);
    case "movement.set":
      return setMovementValue(workspaceRoot, command.file, command.propertyPath, command.value, command.dryRun);
    case "snapshot.list":
      return listSnapshots(workspaceRoot);
    case "snapshot.create":
      return createSnapshot(workspaceRoot, command.file);
    case "snapshot.rollback":
      return rollbackSnapshot(workspaceRoot, command.snapshotId);
  }
}

if (require.main === module) {
  void runCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
