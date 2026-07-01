import { omitUndefined } from "./omit-undefined.ts";
import { treaty, type Treaty } from "@elysiajs/eden";
import type { ServiceStatus } from "@freeanima/admin-contract/api";
import {
  readOfflineCache,
  resolveCacheScope,
  writeOfflineCache,
} from "@freeanima/shell-sdk/offline-cache";
import type { App } from "@freeanima/admin-contract/elysia";
import { shouldAttachRemoteAuth } from "@freeanima/shell-sdk/remote-auth";
import { reviveDates } from "@freeanima/admin-contract/date-json";
import { m } from "./i18n.ts";
import { translateApiErrorValue } from "./api-errors.ts";
import { apiPath } from "./api-path.ts";
import {
  hubApiFetch,
  resetHubFetchCache,
  resolveHubFetch,
  subscribeHubSse,
  type HubFetchFn,
} from "./hub-fetch.ts";
import { resolveApiOrigin } from "./hub-origin.ts";

let cachedClient: Treaty.Create<App> | null = null;
let cachedOrigin = "";
let cachedHubFetch: HubFetchFn | undefined;

export function resetApiClientCache(): void {
  cachedClient = null;
  cachedOrigin = "";
  cachedHubFetch = undefined;
  resetHubFetchCache();
}

export function resolveApiClient(): Treaty.Create<App> {
  const origin = resolveApiOrigin();
  const hubFetch = resolveHubFetch();
  if (cachedClient && cachedOrigin === origin && cachedHubFetch === hubFetch) {
    return cachedClient;
  }
  cachedClient = treaty<App>(origin, { fetcher: hubFetch as typeof fetch });
  cachedOrigin = origin;
  cachedHubFetch = hubFetch;
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
        ...(typeof err.value === "object" && err.value != null ? (err.value as object) : {}),
        error: typeof err.value === "string" ? err.value : undefined,
        message: err.message,
        code: err.code,
        params: err.params,
      }),
    );
  }
  if (result.data == null || result.data === undefined) {
    throw new Error(m.admin_common_empty_response());
  }
  return reviveDates(result.data);
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
  const res = await hubApiFetch(
    `/api/conversations/${encodeURIComponent(conversationId)}/acp-dock`,
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
  const path = `/api/conversations/${encodeURIComponent(conversationId)}/events`;
  const shell = (typeof window !== "undefined" ? window.satelliteShell : undefined) as
    | { hubFetch?: typeof fetch; remoteAuth?: { token?: string } }
    | undefined;
  const origin = resolveApiOrigin();
  const token = shell?.remoteAuth?.token?.trim() ?? "";
  const useAuthFetch = Boolean(shell?.hubFetch || (token && shouldAttachRemoteAuth(origin, token)));

  if (useAuthFetch) {
    return subscribeHubSse(path, {
      conversation_updated: onUpdate,
      ready: onUpdate,
    });
  }

  const url = apiPath(path);
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

const ADMIN_STATUS_CACHE_NS = "admin-status";
const ADMIN_STATUS_CACHE_KEY = "dashboard";
const ADMIN_CONFIG_CACHE_NS = "admin-config";
const ADMIN_CONFIG_CACHE_KEY = "status";
const ADMIN_MEMORY_CACHE_NS = "admin-memory";

export async function getStatus(): Promise<ServiceStatus> {
  const scope = resolveCacheScope(resolveApiOrigin());
  const cached = await readOfflineCache<ServiceStatus>(
    scope,
    ADMIN_STATUS_CACHE_NS,
    ADMIN_STATUS_CACHE_KEY,
  );
  try {
    const status = (await unwrap(resolveApiClient().api.status.get())) as ServiceStatus;
    void writeOfflineCache(scope, ADMIN_STATUS_CACHE_NS, ADMIN_STATUS_CACHE_KEY, status);
    return status;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

export async function getStatusConfig() {
  const scope = resolveCacheScope(resolveApiOrigin());
  const cached = await readOfflineCache(scope, ADMIN_CONFIG_CACHE_NS, ADMIN_CONFIG_CACHE_KEY);
  try {
    const config = await unwrap(resolveApiClient().api.status.config.get());
    void writeOfflineCache(scope, ADMIN_CONFIG_CACHE_NS, ADMIN_CONFIG_CACHE_KEY, config);
    return config;
  } catch (err) {
    if (cached != null) return reviveDates(cached) as Awaited<ReturnType<typeof unwrap>>;
    throw err;
  }
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
      query: omitUndefined({
        step_id: opts?.step_id,
        run_id: opts?.run_id,
        limit: opts?.limit,
        offset: opts?.offset,
      }),
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
      query: omitUndefined({
        job_id: opts?.job_id,
        limit: opts?.limit,
        offset: opts?.offset,
        ok: opts?.ok,
      }),
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
      query: omitUndefined({
        run_kind: opts?.run_kind,
        status: opts?.status,
        limit: opts?.limit,
        offset: opts?.offset,
      }),
    }),
  );
}

export async function restartService() {
  return unwrap(resolveApiClient().api.status.restart.post());
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
  sort_by?: "created_at" | "updated_at" | "reference_count" | "rank";
}) {
  const scope = resolveCacheScope(resolveApiOrigin());
  const cacheId = JSON.stringify(input);
  const cached = await readOfflineCache(scope, ADMIN_MEMORY_CACHE_NS, cacheId);
  try {
    const result = await unwrap(resolveApiClient().api.memory.semantic.list.post(input));
    void writeOfflineCache(scope, ADMIN_MEMORY_CACHE_NS, cacheId, result);
    return result;
  } catch (err) {
    if (cached != null) return reviveDates(cached) as Awaited<ReturnType<typeof unwrap>>;
    throw err;
  }
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

export type EntityRow = import("@freeanima/admin-contract/api").EntityRow;

type EntityListResponse = { items: EntityRow[]; total: number };

export async function listWorldEntities(opts?: { offset?: number; limit?: number }) {
  return unwrap(
    resolveApiClient().api.entities.worlds.get({
      query: {
        offset: opts?.offset?.toString(),
        limit: opts?.limit?.toString(),
      },
    }),
  ) as Promise<EntityListResponse>;
}

export async function createWorldEntity(body: {
  title: string;
  summary?: string;
  content?: string;
  private?: boolean;
  owner_subject_id?: number;
}) {
  return unwrap(resolveApiClient().api.entities.worlds.post(body)) as Promise<EntityRow>;
}

export async function updateWorldEntity(
  id: number,
  body: {
    title?: string;
    summary?: string;
    content?: string;
    private?: boolean;
    owner_subject_id?: number | null;
  },
) {
  return unwrap(
    resolveApiClient()
      .api.entities.worlds({ id: String(id) })
      .patch(body),
  ) as Promise<EntityRow>;
}

export async function listSubjectEntities(opts?: { offset?: number; limit?: number }) {
  return unwrap(
    resolveApiClient().api.entities.subjects.get({
      query: {
        offset: opts?.offset?.toString(),
        limit: opts?.limit?.toString(),
      },
    }),
  ) as Promise<EntityListResponse>;
}

export async function createSubjectEntity(body: {
  type: "agent" | "user";
  title: string;
  summary?: string;
  content?: string;
}) {
  return unwrap(resolveApiClient().api.entities.subjects.post(body)) as Promise<EntityRow>;
}

export async function updateSubjectEntity(
  id: number,
  body: {
    title?: string;
    summary?: string;
    content?: string;
    default_private_world_id?: number;
  },
) {
  return unwrap(
    resolveApiClient()
      .api.entities.subjects({ id: String(id) })
      .patch(body),
  ) as Promise<EntityRow>;
}

export type ServiceApiTokenPublic = {
  id: number;
  subject_id: number;
  name: string;
  prefix: string;
  scopes: string[];
  created_at: Date;
  expires_at: Date | null;
  last_used_at: Date | null;
  revoked_at: Date | null;
};

export async function listSubjectApiTokens(subjectId: number) {
  return unwrap(
    resolveApiClient()
      .api.subjects({ id: String(subjectId) })
      .tokens.get(),
  ) as Promise<{ items: ServiceApiTokenPublic[] }>;
}

export async function createSubjectApiToken(subjectId: number, body: { name: string }) {
  return unwrap(
    resolveApiClient()
      .api.subjects({ id: String(subjectId) })
      .tokens.post(body),
  ) as Promise<{ token: ServiceApiTokenPublic; plaintext: string }>;
}

export async function revokeSubjectApiToken(tokenId: number) {
  return unwrap(
    resolveApiClient()
      .api.tokens({ id: String(tokenId) })
      .delete(),
  ) as Promise<{ ok: true }>;
}
