import { access, readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";

import { discoverEditorDefinitions, EDITOR_PROTOCOL_VERSION, EditorInspectionError, inspectEditorDefinition } from "../../application/editor/editorDefinitionExplorer";
import { SUPPORTED_DEFINITION_KINDS } from "../../application/definitions/definitionValidationRegistry";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4310;
const loopbackHosts = new Set(["127.0.0.1", "::1", "localhost"]);
const staticFiles = new Map<string, { file: string; contentType: string }>([
  ["/", { file: "index.html", contentType: "text/html; charset=utf-8" }],
  ["/index.html", { file: "index.html", contentType: "text/html; charset=utf-8" }],
  ["/styles.css", { file: "styles.css", contentType: "text/css; charset=utf-8" }],
  ["/client.js", { file: "client.js", contentType: "text/javascript; charset=utf-8" }]
]);

export interface EditorServerOptions { workspaceRoot?: string; host?: string; port?: number; assetRoot?: string }
export interface EditorServerHandle { url: string; host: string; port: number; workspaceRoot: string; close: () => Promise<void>; closed: Promise<void> }

export async function startEditorServer(options: EditorServerOptions = {}): Promise<EditorServerHandle> {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  if (!loopbackHosts.has(host)) throw new Error("Editor server host must be loopback-only");
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error("Editor server port must be an integer from 0 through 65535");
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const assetRoot = options.assetRoot === undefined ? await resolveEditorAssetRoot() : path.resolve(options.assetRoot);
  const server = createServer((request, response) => { void routeRequest(request, response, workspaceRoot, assetRoot); });
  const closed = new Promise<void>((resolve) => server.once("close", resolve));
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => { server.off("listening", onListening); reject(error); };
    const onListening = (): void => { server.off("error", onError); resolve(); };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Editor server did not expose a TCP address");
  const resolvedHost = address.address.includes(":") ? `[${address.address}]` : address.address;
  let closing: Promise<void> | null = null;
  return {
    url: `http://${resolvedHost}:${address.port}`,
    host: address.address,
    port: address.port,
    workspaceRoot,
    closed,
    close: () => {
      if (closing !== null) return closing;
      closing = new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)));
      return closing;
    }
  };
}

async function routeRequest(request: IncomingMessage, response: ServerResponse, workspaceRoot: string, assetRoot: string): Promise<void> {
  applySecurityHeaders(response);
  const method = request.method ?? "";
  if (method !== "GET" && method !== "HEAD") { response.setHeader("Allow", "GET, HEAD"); sendJson(response, method, 405, errorBody("EDITOR_METHOD_NOT_ALLOWED", "Only GET and HEAD are supported"), true); return; }
  let url: URL;
  try { url = new URL(request.url ?? "/", "http://localhost"); }
  catch { sendJson(response, method, 400, errorBody("EDITOR_REQUEST_INVALID", "Request URL is invalid"), true); return; }
  try {
    if (url.pathname === "/api/health") {
      sendJson(response, method, 200, { status: "ok", protocolVersion: EDITOR_PROTOCOL_VERSION, workspaceAvailable: await workspaceAvailable(workspaceRoot) }, true); return;
    }
    if (url.pathname === "/api/workspace") {
      const definitions = await discoverEditorDefinitions(workspaceRoot);
      sendJson(response, method, 200, { workspaceRoot, displayName: path.basename(workspaceRoot), supportedDefinitionKinds: SUPPORTED_DEFINITION_KINDS, totalDiscoveredDefinitions: definitions.length, validCount: definitions.filter((item) => item.valid).length, invalidCount: definitions.filter((item) => !item.valid).length }, true); return;
    }
    if (url.pathname === "/api/definitions") { sendJson(response, method, 200, { definitions: await discoverEditorDefinitions(workspaceRoot) }, true); return; }
    if (url.pathname === "/api/definitions/inspect") {
      const file = url.searchParams.get("file");
      if (file === null || file.length === 0) { sendJson(response, method, 400, errorBody("EDITOR_FILE_REQUIRED", "A workspace-relative definition file is required"), true); return; }
      sendJson(response, method, 200, await inspectEditorDefinition(workspaceRoot, file), true); return;
    }
    const asset = staticFiles.get(url.pathname);
    if (asset !== undefined) { await sendStatic(response, method, path.join(assetRoot, asset.file), asset.contentType); return; }
    sendJson(response, method, 404, errorBody("EDITOR_ROUTE_NOT_FOUND", "Route was not found"), url.pathname.startsWith("/api/"));
  } catch (caught) {
    if (caught instanceof EditorInspectionError) { sendJson(response, method, inspectionStatus(caught.code), errorBody(caught.code, caught.message), true); return; }
    sendJson(response, method, 500, errorBody("EDITOR_INTERNAL_ERROR", "Editor request could not be completed"), url.pathname.startsWith("/api/"));
  }
}

async function sendStatic(response: ServerResponse, method: string, file: string, contentType: string): Promise<void> {
  const body = await readFile(file);
  response.statusCode = 200;
  response.setHeader("Content-Type", contentType);
  response.setHeader("Content-Length", String(body.length));
  response.end(method === "HEAD" ? undefined : body);
}

function sendJson(response: ServerResponse, method: string, status: number, value: unknown, noStore: boolean): void {
  const body = Buffer.from(JSON.stringify(value));
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", String(body.length));
  if (noStore) response.setHeader("Cache-Control", "no-store");
  response.end(method === "HEAD" ? undefined : body);
}

function applySecurityHeaders(response: ServerResponse): void {
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
}

async function workspaceAvailable(workspaceRoot: string): Promise<boolean> {
  try { return (await stat(workspaceRoot)).isDirectory(); }
  catch { return false; }
}

async function resolveEditorAssetRoot(): Promise<string> {
  const candidates = [path.resolve(__dirname, "../../../../editor"), path.resolve(__dirname, "../../../editor")];
  for (const candidate of candidates) {
    try { await access(path.join(candidate, "index.html")); return candidate; }
    catch { continue; }
  }
  throw new Error("Editor static assets could not be located");
}

function inspectionStatus(code: string): number { return code === "EDITOR_DEFINITION_NOT_FOUND" ? 404 : code === "EDITOR_DEFINITION_INVALID_JSON" ? 422 : 400; }
function errorBody(code: string, message: string): { error: { code: string; message: string } } { return { error: { code, message } }; }
