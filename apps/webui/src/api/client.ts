// @ts-nocheck — Hono RPC 路由类型由 server 包 typecheck；避免 vue-tsc 拉全图
import { hc } from "hono/client";
import type {
  MemorySearchBody,
  MessagesResponse,
  SessionListItem,
  StudioConfigPatch,
  StudioSearchBody,
} from "@freeanima/legacy-api";

/** 业务 API 统一前缀，与 WebUI 静态路径 /webui 分离 */
const BASE = "/api";

export const PARLOR_PLATFORM = "parlor";
export const STUDIO_PAIR_PLATFORM = "studio-pair-programming";

const raw = hc(BASE);

type ApiErrorBody = { error?: string };

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function unwrapOptional<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

// ── Sessions ────────────────────────────────────────────────────────────────

export async function listSessions(platform = PARLOR_PLATFORM) {
  const res = await raw.sessions.$get({
    query: platform ? { platform } : {},
  });
  const data = await unwrap<{ sessions?: SessionListItem[] }>(res);
  return data.sessions ?? [];
}

/** 拉取全部 platform 的会话（卧室用） */
export async function listAllSessions() {
  return listSessions("");
}

export async function createSession(platform = PARLOR_PLATFORM) {
  const res = await raw.sessions.$post({ json: { platform } });
  return unwrap<{ session_id: string }>(res);
}

export async function getMessages(
  sessionId: string,
  opts?: { offset?: number; limit?: number },
) {
  const params = new URLSearchParams();
  if (opts?.offset !== undefined) params.set("offset", String(opts.offset));
  if (opts?.limit !== undefined) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const url = `${BASE}/sessions/${encodeURIComponent(sessionId)}/messages${qs ? `?${qs}` : ""}`;
  const res = await fetch(url);
  const data = await unwrap<MessagesResponse>(res);
  return data;
}

export async function getSessionStats(sessionId: string) {
  const res = await raw.sessions[":sessionId"].$get({
    param: { sessionId },
  });
  return unwrap(res);
}

export async function setSessionTitle(sessionId: string, title: string) {
  const res = await raw.sessions[":sessionId"].title.$patch({
    param: { sessionId },
    json: { title },
  });
  return unwrap(res);
}

// ── Commands ────────────────────────────────────────────────────────────────

export async function listCommands(opts: { all?: boolean; platform?: string } = {}) {
  const query: Record<string, string> = {};
  if (opts.all) query.all = "1";
  if (opts.platform) query.platform = opts.platform;
  const res = await raw.commands.$get({ query });
  const data = await unwrap<{ commands?: unknown[] }>(res);
  return data.commands ?? [];
}

// ── Health / Status ─────────────────────────────────────────────────────────

export async function health() {
  const res = await raw.health.$get();
  return unwrap(res);
}

export async function getStatus() {
  const res = await raw.status.$get();
  return unwrapOptional(res);
}

// ── Studio ──────────────────────────────────────────────────────────────────

export async function getStudioConfig() {
  const res = await raw.studio.config.$get();
  return unwrap(res);
}

export async function putStudioConfig(patch: StudioConfigPatch) {
  const res = await raw.studio.config.$put({ json: patch });
  return unwrap(res);
}

export async function getStudioTree() {
  const res = await raw.studio.tree.$get();
  return unwrap<{ tree?: unknown[]; workspace?: string }>(res);
}

export async function getStudioFile(path: string) {
  const res = await raw.studio.file.$get({ query: { path } });
  return unwrap(res);
}

export async function studioSearch(query: string) {
  const body: StudioSearchBody = { query };
  const res = await raw.studio.search.$post({ json: body });
  return unwrap<{ results?: unknown[] }>(res);
}

/** WebSocket URL for studio terminal */
export function studioTerminalWsUrl(): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}${BASE}/studio/terminal`;
}

// ── Messages (SSE) ──────────────────────────────────────────────────────────

export function sendMessageStream(
  sessionId: string,
  text: string,
  signal?: AbortSignal,
): Promise<Response> {
  return raw.sessions[":sessionId"].messages.stream.$post(
    {
      param: { sessionId },
      json: { message: text },
    },
    signal ? { init: { signal } } : undefined,
  );
}

// ── Chamber: Config / Tools ─────────────────────────────────────────────────

export async function getConfig() {
  const res = await raw.config.$get();
  return unwrap<Record<string, unknown>>(res);
}

export async function getTools() {
  const res = await raw.tools.$get();
  const data = await unwrap<{ tools?: unknown[] }>(res);
  return data.tools ?? [];
}

// ── Chamber: MCP ────────────────────────────────────────────────────────────

export async function getMcpStatus() {
  const res = await raw.mcp.$get();
  return unwrap(res);
}

export async function mcpServerAction(name: string, action: "start" | "stop") {
  const res = await raw.mcp[":name"][action].$post({ param: { name } });
  return unwrap(res);
}

export async function mcpBulkAction(action: "start-all" | "stop-all") {
  const res = await raw.mcp[action].$post();
  return unwrap(res);
}

// ── Chamber: ACP ────────────────────────────────────────────────────────────

const ACP_START_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

export async function getAcpStatus() {
  const res = await raw.acp.$get();
  return unwrap(res);
}

export async function acpAgentAction(name: string, action: "start" | "stop") {
  const req = raw.acp[":name"][action].$post({ param: { name } });
  const result =
    action === "start"
      ? withTimeout(
          req.then((res) => unwrap(res)),
          ACP_START_TIMEOUT_MS,
          "连接超时（30s），请检查 agent 是否已 login、command 路径是否正确",
        )
      : req.then((res) => unwrap(res));
  return result;
}

export async function acpBulkAction(action: "start-all" | "stop-all") {
  const req = raw.acp[action].$post();
  const result =
    action === "start-all"
      ? withTimeout(
          req.then((res) => unwrap(res)),
          ACP_START_TIMEOUT_MS,
          "全部连接超时（30s），请检查各 agent 配置与 login 状态",
        )
      : req.then((res) => unwrap(res));
  return result;
}

// ── Chamber: Cron ─────────────────────────────────────────────────────────────

export async function listCronJobs() {
  const res = await raw.cron.$get();
  const data = await unwrap<{ jobs?: unknown[] }>(res);
  return data.jobs ?? [];
}

export async function cronJobAction(id: string, action: "pause" | "resume" | "run") {
  const res = await raw.cron[":id"][action].$post({ param: { id } });
  return unwrap<{ ok: boolean; job?: Record<string, unknown>; message?: string }>(res);
}

// ── Chamber: Memory ───────────────────────────────────────────────────────────

export async function listMemoryFiles() {
  const res = await raw.memory.$get();
  return unwrapOptional<{ files?: { name: string; size: number }[] }>(res);
}

export async function memorySearch(body: MemorySearchBody) {
  const res = await raw.memory.search.$post({ json: body });
  return unwrap(res);
}

export type MemoryAction = "l2-distill" | "l2-reindex" | "l3-reindex";

export async function memoryAction(action: MemoryAction) {
  const res = await raw.memory[action].$post();
  return unwrap<{ ok: boolean; message?: string }>(res);
}

// ── Service ───────────────────────────────────────────────────────────────────

export async function restartService(): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${BASE}/service/restart`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ ok: boolean; message: string }>;
}

// ── Platforms ─────────────────────────────────────────────────────────────────

export async function getPlatforms() {
  const res = await raw.platforms.$get();
  return unwrap<{ ok: boolean; data?: Record<string, unknown> }>(res);
}
