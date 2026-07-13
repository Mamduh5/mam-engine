import path from "node:path";

import { startEditorServer } from "../../infrastructure/editor/editorServer";
import { operationResult, type OperationResult } from "../../shared/operationResult";

export async function serveEditor(workspaceRoot: string, host: string, port: number, selectedWorkspace?: string): Promise<OperationResult> {
  const resolvedWorkspace = path.resolve(workspaceRoot, selectedWorkspace ?? ".");
  const server = await startEditorServer({ workspaceRoot: resolvedWorkspace, host, port });
  const shutdown = (): void => { void server.close(); };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  void server.closed.finally(() => {
    process.off("SIGINT", shutdown);
    process.off("SIGTERM", shutdown);
  });
  return operationResult({ command: "editor.serve", status: "passed", input: { host, port, workspace: resolvedWorkspace }, data: { url: server.url, host: server.host, port: server.port, workspaceRoot: server.workspaceRoot, readOnly: true } });
}
