import { treaty, type Treaty } from "@elysiajs/eden";
import type { FridgeMagnetsResponse } from "@freeanima/platform/connectors/webui/api";
import type { App } from "@freeanima/platform/connectors/webui/elysia";
import { m } from "./i18n.ts";
import { translateApiErrorValue } from "./api-errors.ts";
import { apiPath } from "./api-path.ts";
import { resolveApiOrigin } from "./hub-origin.ts";

export const apiClient: Treaty.Create<App> = treaty<App>(resolveApiOrigin());

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
    apiClient.api.conversations.get({
      query: {
        platform: opts?.platform,
        offset: opts?.offset?.toString(),
        limit: opts?.limit?.toString(),
      },
    }),
  );
}

/** @deprecated 使用 listConversations({ offset, limit }) */
export async function listAllConversations() {
  return listConversations({ offset: 0, limit: 10_000 });
}

export async function getConversationInfo(conversationId: string) {
  return unwrap(apiClient.api.conversations({ conversationId }).get());
}

export async function createConversation(platform: string) {
  const p = platform.trim();
  if (!p) throw new Error("platform is required");
  return unwrap(apiClient.api.conversations.post({ platform: p }));
}

export async function getStoredMessages(conversationId: string, offset?: number, limit?: number) {
  return unwrap(
    apiClient.api.conversations({ conversationId }).messages.get({
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
  return unwrap(apiClient.api.conversations({ conversationId }).title.patch({ title }));
}

export async function listConversationCommands(opts?: { all?: boolean; platform?: string }) {
  return unwrap(
    apiClient.api.conversations.commands.get({
      query: {
        all: opts?.all ? "true" : undefined,
        platform: opts?.platform,
      },
    }),
  );
}

export async function getStatus() {
  return unwrap(apiClient.api.status.get());
}

export async function getStatusConfig() {
  return unwrap(apiClient.api.status.config.get());
}

export async function getToolsStatus(scope?: "default" | "all") {
  return unwrap(
    apiClient.api.status.tools.get({
      query: scope === "default" ? { scope: "default" } : {},
    }),
  );
}

export async function getPromptDebug(conversationId?: string) {
  return unwrap(
    apiClient.api.prompt.debug.get({
      query: conversationId ? { conversation_id: conversationId } : {},
    }),
  );
}

export async function getCronJobs() {
  return unwrap(apiClient.api.status["cron-jobs"].get());
}

export async function pauseCronJob(id: string) {
  return unwrap(apiClient.api.status["cron-jobs"]({ id }).pause.post());
}

export async function resumeCronJob(id: string) {
  return unwrap(apiClient.api.status["cron-jobs"]({ id }).resume.post());
}

export async function runCronJob(id: string) {
  return unwrap(apiClient.api.status["cron-jobs"]({ id }).run.post());
}

export async function getSleepSummary() {
  return unwrap(apiClient.api.sleep.summary.get());
}

export async function listPipelineStepRuns(opts?: {
  step_id?: string;
  run_id?: string;
  limit?: number;
  offset?: number;
}) {
  return unwrap(
    apiClient.api.sleep["pipeline-runs"].get({
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
  return unwrap(apiClient.api.sleep["deep-sleep"]({ day }).rounds.get());
}

export async function getSleepPipelineStatus() {
  return unwrap(apiClient.api.sleep.pipeline.status.get());
}

export async function startSleepCycle(body?: {
  day?: string;
  deep_sleep_mode?: "full" | "incremental";
}) {
  return unwrap(apiClient.api.sleep.pipeline.run.post(body ?? {}));
}

export async function startSleepPipelineStep(body: {
  step_id: string;
  day?: string;
  force?: boolean;
  deep_sleep_mode?: "full" | "incremental";
}) {
  return unwrap(apiClient.api.sleep.pipeline["run-step"].post(body));
}

export async function listCronLogs(opts?: {
  job_id?: string;
  limit?: number;
  offset?: number;
  ok?: boolean;
}) {
  return unwrap(
    apiClient.api["cron-logs"].get({
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
    apiClient.api["auto-llm-runs"].get({
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
  return unwrap(apiClient.api.status.restart.post());
}

export async function getEmailOverview() {
  return unwrap(apiClient.api.email.get());
}

export async function fetchEmailAccount(accountId: string) {
  return unwrap(apiClient.api.email({ accountId }).fetch.post());
}

export async function listAccountMessages(accountId: string, limit = 50) {
  return unwrap(apiClient.api.email({ accountId }).messages.get({ query: { limit } }));
}

export async function getEmailMessage(accountId: string, uid: number) {
  return unwrap(
    apiClient.api
      .email({ accountId })
      .messages({ uid: String(uid) })
      .get(),
  );
}

export async function markEmailRead(accountId: string, uid: number) {
  return unwrap(
    apiClient.api
      .email({ accountId })
      .messages({ uid: String(uid) })
      .read.post(),
  );
}

export async function searchMemory(input: { query: string; limit?: number }) {
  return unwrap(apiClient.api.memory.search.post(input));
}

export async function countSemanticMemory() {
  return unwrap(apiClient.api.memory["semantic-memory"].count.post());
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
  return unwrap(apiClient.api.memory.semantic.list.post(input));
}

export async function updateSemanticMemoryPinned(input: { id: string; pinned: boolean }) {
  return unwrap(apiClient.api.memory.semantic.pinned.patch(input));
}

export async function listLimbicMemories(input: {
  query?: string;
  offset?: number;
  limit?: number;
  conversation_id?: string;
  kind?: string;
}) {
  return unwrap(apiClient.api.memory.limbic.list.post(input));
}

export async function listAutobiographicalMemories(input: {
  query?: string;
  offset?: number;
  limit?: number;
  status?: string;
  significance?: string;
  source_conversation?: string;
}) {
  return unwrap(apiClient.api.memory.autobiographical.list.post(input));
}

export async function listDreamMemories(input: { offset?: number; limit?: number }) {
  return unwrap(apiClient.api.memory.dream.list.post(input));
}

export async function getDreamMemory(day: string) {
  return unwrap(apiClient.api.memory.dream({ day }).get());
}

export async function listTasks(input: {
  query?: string;
  offset?: number;
  limit?: number;
  status?: "all" | string | string[];
  priority?: string;
}) {
  return unwrap(apiClient.api.tasks.list.post(input));
}

export async function getFtsStatus() {
  return unwrap(apiClient.api.fts.status.get());
}

export async function startRebuildFtsIndex(opts?: { only_missing?: boolean }) {
  return unwrap(
    apiClient.api.fts.rebuild.post({
      only_missing: opts?.only_missing ?? true,
    }),
  );
}

export async function getRebuildFtsJobStatus() {
  return unwrap(apiClient.api.fts.rebuild.status.get());
}

export async function getSelfBlocks() {
  return unwrap(apiClient.api.self.blocks.get());
}

export async function getFridgeMagnets(): Promise<FridgeMagnetsResponse> {
  return unwrap<FridgeMagnetsResponse>(apiClient.api["fridge-magnet"].magnets.get());
}

export async function getMcpStatus() {
  return unwrap(apiClient.api.mcp.status.get());
}

export async function getSatellitesStatus() {
  return unwrap(apiClient.api.satellites.status.get());
}

export async function startMcp(name: string) {
  return unwrap(apiClient.api.mcp({ name }).start.post());
}

export async function stopMcp(name: string) {
  return unwrap(apiClient.api.mcp({ name }).stop.post());
}

export async function startAllMcp() {
  return unwrap(apiClient.api.mcp["start-all"].post());
}

export async function stopAllMcp() {
  return unwrap(apiClient.api.mcp["stop-all"].post());
}

export async function getAcpStatus() {
  return unwrap(apiClient.api.acp.status.get());
}

export async function startAcp(name: string) {
  return unwrap(apiClient.api.acp({ name }).start.post());
}

export async function stopAcp(name: string) {
  return unwrap(apiClient.api.acp({ name }).stop.post());
}

export async function startAllAcp() {
  return unwrap(apiClient.api.acp["start-all"].post());
}

export async function stopAllAcp() {
  return unwrap(apiClient.api.acp["stop-all"].post());
}

export async function listCredentials() {
  return unwrap(apiClient.api.credentials.get());
}

export async function getCredentialDetail(path: string) {
  return unwrap(apiClient.api.credentials.detail.get({ query: { path } }));
}
