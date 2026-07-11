import type { OperationResult } from "../shared/operationResult";

export function writeResult(result: OperationResult<unknown>, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  process.stdout.write(`${result.command}: ${result.status}\n`);
  if (result.data !== null) {
    process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
  }
  for (const error of result.errors) {
    process.stderr.write(`${error.code}${error.path ? ` (${error.path})` : ""}: ${error.message}\n`);
  }
  if (result.changedFiles.length > 0) {
    process.stdout.write(`changed files: ${result.changedFiles.join(", ")}\n`);
  }
  if (result.snapshotId) {
    process.stdout.write(`snapshot: ${result.snapshotId}\n`);
  }
}
