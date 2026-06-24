import { treaty, type Treaty } from "@elysiajs/eden";
import type { FridgeMagnetsResponse } from "@freeanima/platform/connectors/webui/api";
import type { App } from "@freeanima/platform/connectors/webui/elysia";
import { m } from "./i18n.ts";
import { translateApiErrorValue } from "./api-errors.ts";
import { apiPath } from "./api-path.ts";
import { resolveApiOrigin } from "./hub-origin.ts";

let cachedClient: Treaty.Create<App> | null = null;
let cachedOrigin = "";

export function resolveApiClient(): Treaty.Create<App> {
  const origin = resolveApiOrigin();
  const shell = (typeof window !== "undefined" ? window.satelliteShell : undefined) as
    | { hubFetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> }
    | undefined;
  if (shell?.hubFetch) {
    return treaty<App>(origin, { fetcher: shell.hubFetch as typeof fetch });
  }
  if (cachedClient && cachedOrigin === origin) return cachedClient;
  cachedClient = treaty<App>(origin);
  cachedOrigin = origin;
  return cachedClient;
}

type TreatyResult<T> = { data: T | null; error: unknown };

export async function unwrap<T>(promise: Promise<TreatyResult<T>>): Promise<T> {
  const result = await promise;
  if (result.error) {
    const err = result.error as {
      value?: unknown;
      message?: string;
      code?: string;
      params?: Record<string, string>;
    };
    throw new Error(
      translateApiErrorValue({
        ...(typeof err.value === "object" && err.value !== null ? (err.value as object) : {}),
        error: typeof err.value === "string" ? err.value : undefined,
        message: err.message,
        code: err.code,
        params: err.params,
      }),
    );
  }
  if (result.data === null || result.data === undefined) {
    throw new Error(m.webui_common_empty_response());
  }
  return result.data;
}

export async function listConversations(opts?: {
  platform?: string;
  offset?: number;
  limit?: number;
}) {
  return unwrap(
    resolveApiClient().api.conversations.get({
      query: {
        platform: opts?.platform,
        offset: opts?.offset?.toString(),
        limit: opts?.limit?.toString(),
      },
    }),
  );
}

export async function getConversationInfo(conversationId: string) {
  return unwrap(resolveApiClient().api.conversations({ conversationId }).get());
}

export async function createConversation(platform: string) {
  const p = platform.trim();
  if (!p) throw new Error("platform is required");
  return unwrap(resolveApiClient().api.conversations.post({ platform: p }));
}

export async function getStoredMessages(conversationId: string, offset?: number, limit?: number) {
  return unwrap(
    resolveApiClient()
      .api.conversations({ conversationId })
      .messages.get({
        query: {
          offset: offset?.toString(),
          limit: limit?.toString(),
        },
      }),
  );
}

export type ConversationAcpDockTask = {
  acp_conversation_id: string;
  task_id: string;
  agent_name: string;
  status: string;
  progress_message_id?: string;
};

export type ConversationAcpDockSnapshot = {
  conversation_id: string;
  tasks: ConversationAcpDockTask[];
  progress_text: string;
  task_progress: Record<string, string>;
  highlight_decision: boolean;
};

export async function getConversationAcpDock(
  conversationId: string,
): Promise<ConversationAcpDockSnapshot> {
  const res = await fetch(
    apiPath(`/api/conversations/${encodeURIComponent(conversationId)}/acp-dock`),
  );
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as ConversationAcpDockSnapshot;
}

export function subscribeConversationEvents(
  conversationId: string,
  onUpdate: () => void,
): { unsubscribe: () => void } {
  const url = apiPath(`/api/conversations/${encodeURIComponent(conversationId)}/events`);
  const es = new EventSource(url);
  const handler = () => onUpdate();
  es.addEventListener("conversation_updated", handler);
  es.addEventListener("ready", handler);
  es.addEventListener("error", () => {
    /* EventSource 会自动重连 */
  });
  return {
    unsubscribe: () => {
      es.removeEventListener("conversation_updated", handler);
      es.removeEventListener("ready", handler);
      es.close();
    },
  };
}

export async function setConversationTitle(conversationId: string, title: string) {
  return unwrap(resolveApiClient().api.conversations({ conversationId }).title.patch({ title }));
}

export async function listConversationCommands(opts?: { all?: boolean; platform?: string }) {
  return unwrap(
    resolveApiClient().api.conversations.commands.get({
      query: {
        all: opts?.all ? "true" : undefined,
        platform: opts?.platform,
      },
    }),
  );
}

export async function getStatus() {
  return unwrap(resolveApiClient().api.status.get());
}

export async function getStatusConfig() {
  return unwrap(resolveApiClient().api.status.config.get());
}

export async function getToolsStatus(scope?: "default" | "all") {
  return unwrap(
    resolveApiClient().api.status.tools.get({
      query: scope === "default" ? { scope: "default" } : {},
    }),
  );
}

export async function getPromptDebug(conversationId?: string) {
  return unwrap(
    resolveApiClient().api.prompt.debug.get({
      query: conversationId ? { conversation_id: conversationId } : {},
    }),
  );
}

export async function getCronJobs() {
  return unwrap(resolveApiClient().api.status["cron-jobs"].get());
}

export async function pauseCronJob(id: string) {
  return unwrap(resolveApiClient().api.status["cron-jobs"]({ id }).pause.post());
}

export async function resumeCronJob(id: string) {
  return unwrap(resolveApiClient().api.status["cron-jobs"]({ id }).resume.post());
}

export async function runCronJob(id: string) {
  return unwrap(resolveApiClient().api.status["cron-jobs"]({ id }).run.post());
}

export async function getSleepSummary() {
  return unwrap(resolveApiClient().api.sleep.summary.get());
}

export async function listPipelineStepRuns(opts?: {
  step_id?: string;
  run_id?: string;
  limit?: number;
  offset?: number;
}) {
  return unwrap(
    resolveApiClient().api.sleep["pipeline-runs"].get({
      query: {
        step_id: opts?.step_id,
        run_id: opts?.run_id,
        limit: opts?.limit,
        offset: opts?.offset,
      },
    }),
  );
}

export async function getDeepSleepRounds(day: string) {
  return unwrap(resolveApiClient().api.sleep["deep-sleep"]({ day }).rounds.get());
}

export async function getSleepPipelineStatus() {
  return unwrap(resolveApiClient().api.sleep.pipeline.status.get());
}

export async function startSleepCycle(body?: {
  day?: string;
  deep_sleep_mode?: "full" | "incremental";
}) {
  return unwrap(resolveApiClient().api.sleep.pipeline.run.post(body ?? {}));
}

export async function startSleepPipelineStep(body: {
  step_id: string;
  day?: string;
  force?: boolean;
  deep_sleep_mode?: "full" | "incremental";
}) {
  return unwrap(resolveApiClient().api.sleep.pipeline["run-step"].post(body));
}

export async function listCronLogs(opts?: {
  job_id?: string;
  limit?: number;
  offset?: number;
  ok?: boolean;
}) {
  return unwrap(
    resolveApiClient().api["cron-logs"].get({
      query: {
        job_id: opts?.job_id,
        limit: opts?.limit,
        offset: opts?.offset,
        ok: opts?.ok,
      },
    }),
  );
}

export async function listAutoLlmRuns(opts?: {
  run_kind?: string;
  status?: "ok" | "error";
  limit?: number;
  offset?: number;
}) {
  return unwrap(
    resolveApiClient().api["auto-llm-runs"].get({
      query: {
        run_kind: opts?.run_kind,
        status: opts?.status,
        limit: opts?.limit,
        offset: opts?.offset,
      },
    }),
  );
}

export async function restartService() {
  return unwrap(resolveApiClient().api.status.restart.post());
}

export async function getEmailOverview() {
  return unwrap(resolveApiClient().api.email.get());
}

export async function fetchEmailAccount(accountId: string) {
  return unwrap(resolveApiClient().api.email({ accountId }).fetch.post());
}

export async function listAccountMessages(accountId: string, limit = 50) {
  return unwrap(resolveApiClient().api.email({ accountId }).messages.get({ query: { limit } }));
}

export async function getEmailMessage(accountId: string, uid: number) {
  return unwrap(
    resolveApiClient()
      .api.email({ accountId })
      .messages({ uid: String(uid) })
      .get(),
  );
}

export async function markEmailRead(accountId: string, uid: number) {
  return unwrap(
    resolveApiClient()
      .api.email({ accountId })
      .messages({ uid: String(uid) })
      .read.post(),
  );
}

export async function searchMemory(input: { query: string; limit?: number }) {
  return unwrap(resolveApiClient().api.memory.search.post(input));
}

export async function countSemanticMemory() {
  return unwrap(resolveApiClient().api.memory["semantic-memory"].count.post());
}

export async function listSemanticMemories(input: {
  query?: string;
  offset?: number;
  limit?: number;
  types?: string[];
  status?: string;
  source_conversation?: string;
  sort_by?: "created" | "updated" | "reference_count" | "rank";
}) {
  return unwrap(resolveApiClient().api.memory.semantic.list.post(input));
}

export async function updateSemanticMemoryPinned(input: { id: string; pinned: boolean }) {
  return unwrap(resolveApiClient().api.memory.semantic.pinned.patch(input));
}

export async function listLimbicMemories(input: {
  query?: string;
  offset?: number;
  limit?: number;
  conversation_id?: string;
  kind?: string;
}) {
  return unwrap(resolveApiClient().api.memory.limbic.list.post(input));
}

export async function listAutobiographicalMemories(input: {
  query?: string;
  offset?: number;
  limit?: number;
  status?: string;
  significance?: string;
  source_conversation?: string;
}) {
  return unwrap(resolveApiClient().api.memory.autobiographical.list.post(input));
}

export async function listDreamMemories(input: { offset?: number; limit?: number }) {
  return unwrap(resolveApiClient().api.memory.dream.list.post(input));
}

export async function getDreamMemory(day: string) {
  return unwrap(resolveApiClient().api.memory.dream({ day }).get());
}

export async function listTasks(input: {
  query?: string;
  offset?: number;
  limit?: number;
  status?: "all" | string | string[];
  priority?: string;
}) {
  return unwrap(resolveApiClient().api.tasks.list.post(input));
}

export async function getFtsStatus() {
  return unwrap(resolveApiClient().api.fts.status.get());
}

export async function startRebuildFtsIndex(opts?: { only_missing?: boolean }) {
  return unwrap(
    resolveApiClient().api.fts.rebuild.post({
      only_missing: opts?.only_missing ?? true,
    }),
  );
}

export async function getRebuildFtsJobStatus() {
  return unwrap(resolveApiClient().api.fts.rebuild.status.get());
}

export async function getSelfBlocks() {
  return unwrap(resolveApiClient().api.self.blocks.get());
}

export async function getFridgeMagnets(): Promise<FridgeMagnetsResponse> {
  return unwrap<FridgeMagnetsResponse>(resolveApiClient().api["fridge-magnet"].magnets.get());
}

export async function getMcpStatus() {
  return unwrap(resolveApiClient().api.mcp.status.get());
}

export async function getSatellitesStatus() {
  return unwrap(resolveApiClient().api.satellites.status.get());
}

export async function startMcp(name: string) {
  return unwrap(resolveApiClient().api.mcp({ name }).start.post());
}

export async function stopMcp(name: string) {
  return unwrap(resolveApiClient().api.mcp({ name }).stop.post());
}

export async function startAllMcp() {
  return unwrap(resolveApiClient().api.mcp["start-all"].post());
}

export async function stopAllMcp() {
  return unwrap(resolveApiClient().api.mcp["stop-all"].post());
}

export async function getAcpStatus() {
  return unwrap(resolveApiClient().api.acp.status.get());
}

export async function startAcp(name: string) {
  return unwrap(resolveApiClient().api.acp({ name }).start.post());
}

export async function stopAcp(name: string) {
  return unwrap(resolveApiClient().api.acp({ name }).stop.post());
}

export async function startAllAcp() {
  return unwrap(resolveApiClient().api.acp["start-all"].post());
}

export async function stopAllAcp() {
  return unwrap(resolveApiClient().api.acp["stop-all"].post());
}

export async function listCredentials() {
  return unwrap(resolveApiClient().api.credentials.get());
}

export async function getCredentialDetail(path: string) {
  return unwrap(resolveApiClient().api.credentials.detail.get({ query: { path } }));
}
