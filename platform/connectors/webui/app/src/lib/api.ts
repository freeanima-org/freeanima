import { treaty } from "@elysiajs/eden";
import type { FridgeMagnetsResponse } from "@freeanima/platform/connectors/webui/api";
import type { App } from "@freeanima/platform/connectors/webui/elysia";
import { m } from "./i18n.ts";
import { translateApiErrorValue } from "./api-errors.ts";
import { apiPath } from "./api-path.ts";

export const apiClient = treaty<App>(
  typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:2658",
);

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

export async function listSessions(platform?: string) {
  return unwrap(apiClient.api.sessions.get({ query: { platform } }));
}

export async function listAllSessions() {
  return unwrap(apiClient.api.sessions.all.get());
}

export async function createSession(platform?: string) {
  return unwrap(apiClient.api.sessions.post(platform ? { platform } : {}));
}

export async function getSessionMessages(sessionId: string, offset?: number, limit?: number) {
  return unwrap(
    apiClient.api.sessions({ sessionId }).messages.get({
      query: {
        offset: offset?.toString(),
        limit: limit?.toString(),
      },
    }),
  );
}

export type SessionAcpDockTask = {
  acp_session_id: string;
  task_id: string;
  agent_name: string;
  status: string;
  progress_message_id?: string;
};

export type SessionAcpDockSnapshot = {
  session_id: string;
  tasks: SessionAcpDockTask[];
  progress_text: string;
  task_progress: Record<string, string>;
  highlight_decision: boolean;
};

export async function getSessionAcpDock(sessionId: string): Promise<SessionAcpDockSnapshot> {
  const res = await fetch(apiPath(`/api/sessions/${encodeURIComponent(sessionId)}/acp-dock`));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as SessionAcpDockSnapshot;
}

export async function setSessionTitle(sessionId: string, title: string) {
  return unwrap(apiClient.api.sessions({ sessionId }).title.patch({ title }));
}

export async function listSessionCommands(opts?: { all?: boolean; platform?: string }) {
  return unwrap(
    apiClient.api.sessions.commands.get({
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

export async function getToolsStatus() {
  return unwrap(apiClient.api.status.tools.get());
}

export async function getPromptDebug(sessionId?: string) {
  return unwrap(
    apiClient.api.prompt.debug.get({
      query: sessionId ? { session_id: sessionId } : {},
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
  source_session?: string;
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
  session_id?: string;
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
  source_session?: string;
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
