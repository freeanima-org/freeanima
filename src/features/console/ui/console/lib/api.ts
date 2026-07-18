import type {
  ConversationSummary,
  ServiceSnapshot,
} from "@freeanima/platform/ports/schemas/snapshot";
import { resetBundledHubClientForTests } from "@freeanima/shared/hub-client";
import {
  readOfflineCache,
  resolveCacheScope,
  writeOfflineCache,
} from "@freeanima/frontend/shell-sdk/offline-cache";
import { reviveDates } from "@freeanima/features/console/protocol/console-contract/date-json.ts";

import { getConsoleHubClient } from "./hub-client.ts";
import { omitUndefined } from "./omit-undefined.ts";
import { resetHubFetchCache } from "./hub-fetch.ts";
import { resolveApiOrigin } from "./hub-origin.ts";

function hub() {
  return getConsoleHubClient();
}

async function hubCall<T>(promise: Promise<T>): Promise<T> {
  return reviveDates(await promise) as T;
}

export function resetApiClientCache(): void {
  resetBundledHubClientForTests();
  resetHubFetchCache();
}

export async function listConversations(opts?: { offset?: number; limit?: number }) {
  // 运维面必须走 adminListAll：conversation.list 会按 SAP 上下文默认 platform，
  // Console HTTP REST 的 app_id/instance_id 为空时会落到 "sap::" 过滤，列表恒为空。
  const raw = await hub().call(
    "conversation.adminListAll",
    omitUndefined({
      offset: opts?.offset,
      limit: opts?.limit,
    }),
  );
  const rows = (
    raw as {
      conversations: Array<{
        conversation_id: string;
        title?: string;
        platform?: string;
        updated_at?: string;
        archived_at?: string | null;
      }>;
      total?: number;
    }
  ).conversations;
  const total = (raw as { total?: number }).total;
  return reviveDates({
    conversations: rows.map(
      (s): ConversationSummary => ({
        id: s.conversation_id,
        title: s.title ?? "",
        platform: s.platform ?? "",
        created_at: new Date(s.updated_at ?? 0),
        updated_at: new Date(s.updated_at ?? 0),
        ...(s.archived_at !== undefined && s.archived_at !== null
          ? { archived_at: new Date(s.archived_at) }
          : {}),
      }),
    ),
    ...(total !== undefined ? { total } : {}),
  });
}

export async function getConversationInfo(conversationId: string) {
  return hubCall(hub().call("conversation.adminGet", { conversationId }));
}

export async function createConversation(platform: string) {
  const p = platform.trim();
  if (!p) throw new Error("platform is required");
  return hubCall(hub().call("conversation.adminCreate", { platform: p }));
}

export async function getStoredMessages(conversationId: string, offset?: number, limit?: number) {
  return hubCall(
    hub().call(
      "conversation.messages",
      omitUndefined({
        conversation_id: conversationId,
        offset,
        limit,
      }),
    ),
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
  return hubCall(
    hub().call("conversation.acpDock", { conversation_id: conversationId }),
  ) as Promise<ConversationAcpDockSnapshot>;
}

export function subscribeConversationEvents(
  conversationId: string,
  onUpdate: () => void,
): { unsubscribe: () => void } {
  const client = getConsoleHubClient() as ReturnType<typeof getConsoleHubClient> & {
    subscribe?: (
      method: "conversation.subscribe",
      input: { conversation_id: string },
      callbacks: { onData?: (data: unknown) => void },
    ) => { unsubscribe: () => void };
  };
  if (typeof client.subscribe !== "function") {
    return { unsubscribe: () => {} };
  }
  return client.subscribe(
    "conversation.subscribe",
    { conversation_id: conversationId },
    { onData: () => onUpdate() },
  );
}

export async function setConversationTitle(conversationId: string, title: string) {
  return hubCall(hub().call("conversation.patchTitle", { conversation_id: conversationId, title }));
}

export async function listConversationCommands(opts?: { all?: boolean; platform?: string }) {
  return hubCall(
    hub().call(
      "conversation.commands",
      omitUndefined({ all: opts?.all, platform: opts?.platform }),
    ),
  );
}

const CONSOLE_STATUS_CACHE_NS = "console-status";
const CONSOLE_STATUS_CACHE_KEY = "dashboard";
const CONSOLE_MEMORY_CACHE_NS = "console-memory";

export async function getStatus(): Promise<ServiceSnapshot> {
  const scope = resolveCacheScope(resolveApiOrigin());
  const cached = await readOfflineCache<ServiceSnapshot>(
    scope,
    CONSOLE_STATUS_CACHE_NS,
    CONSOLE_STATUS_CACHE_KEY,
  );
  try {
    const status = (await hubCall(hub().call("status.get", {}))) as ServiceSnapshot;
    void writeOfflineCache(scope, CONSOLE_STATUS_CACHE_NS, CONSOLE_STATUS_CACHE_KEY, status);
    return status;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

export async function getToolsStatus(scope?: "default" | "all") {
  return hubCall(hub().call("status.tools", scope === "default" ? { scope: "default" } : {}));
}

export async function getPromptDebug(conversationId?: string) {
  return hubCall(hub().call("prompt.debug", omitUndefined({ conversation_id: conversationId })));
}

export async function getCronJobs() {
  return hubCall(hub().call("status.cronJobs", {}));
}

export async function pauseCronJob(id: string) {
  return hubCall(hub().call("status.cronJobPause", { id }));
}

export async function resumeCronJob(id: string) {
  return hubCall(hub().call("status.cronJobResume", { id }));
}

export async function runCronJob(id: string) {
  return hubCall(hub().call("status.cronJobRun", { id }));
}

export async function getSleepSummary() {
  return hubCall(hub().call("sleep.summary", {}));
}

export async function listPipelineStepRuns(opts?: {
  step_id?: string;
  run_id?: string;
  limit?: number;
  offset?: number;
}) {
  return hubCall(hub().call("sleep.pipelineRuns", omitUndefined(opts ?? {})));
}

export async function getDeepSleepRounds(day: string) {
  return hubCall(hub().call("sleep.deepSleepRounds", { day }));
}

export async function getSleepPipelineStatus() {
  return hubCall(hub().call("sleep.pipelineStatus", {}));
}

export async function startSleepCycle(body?: {
  day?: string;
  deep_sleep_mode?: "full" | "incremental";
}) {
  return hubCall(hub().call("sleep.startCycle", body ?? {}));
}

export async function startSleepPipelineStep(body: {
  step_id: string;
  day?: string;
  force?: boolean;
  deep_sleep_mode?: "full" | "incremental";
}) {
  return hubCall(hub().call("sleep.runPipelineStep", body));
}

export async function listCronLogs(opts?: {
  job_id?: string;
  limit?: number;
  offset?: number;
  ok?: boolean;
}) {
  return hubCall(hub().call("cronLogs.list", omitUndefined(opts ?? {})));
}

export async function listAutoLlmRuns(opts?: {
  run_kind?: string;
  status?: "ok" | "error";
  limit?: number;
  offset?: number;
}) {
  return hubCall(hub().call("autoLlmRuns.list", omitUndefined(opts ?? {})));
}

export async function restartService() {
  return hubCall(hub().call("status.restart", {}));
}

export async function searchMemory(input: { query: string; limit?: number }) {
  return hubCall(hub().call("memory.search", input));
}

export async function countSemanticMemory() {
  return hubCall(hub().call("memory.semanticCount", {}));
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
  const cached = await readOfflineCache(scope, CONSOLE_MEMORY_CACHE_NS, cacheId);
  try {
    const result = await hubCall(hub().call("memory.semanticList", input as never));
    void writeOfflineCache(scope, CONSOLE_MEMORY_CACHE_NS, cacheId, result);
    return result;
  } catch (err) {
    if (cached != null) return reviveDates(cached);
    throw err;
  }
}

export async function updateSemanticMemoryPinned(input: { id: number; pinned: boolean }) {
  return hubCall(hub().call("memory.semanticPin", input));
}

export async function listLimbicMemories(input: {
  query?: string;
  offset?: number;
  limit?: number;
  conversation_id?: string;
  kind?: string;
}) {
  return hubCall(hub().call("memory.limbicList", input as never));
}

export async function listAutobiographicalMemories(input: {
  query?: string;
  offset?: number;
  limit?: number;
  status?: string;
  significance?: string;
  source_conversation?: string;
}) {
  return hubCall(hub().call("memory.autobiographicalList", input as never));
}

export async function getFtsStatus() {
  return hubCall(hub().call("fts.status", {}));
}

export async function startRebuildFtsIndex(opts?: { only_missing?: boolean }) {
  return hubCall(hub().call("fts.rebuild", { only_missing: opts?.only_missing ?? true }));
}

export async function getRebuildFtsJobStatus() {
  return hubCall(hub().call("fts.rebuildStatus", {}));
}

export async function getSelfBlocks() {
  return hubCall(hub().call("self.blocks", {}));
}

export async function getMcpStatus() {
  return hubCall(hub().call("mcp.status", {}));
}

export async function getSatellitesStatus() {
  return hubCall(hub().call("src/satellites.status", {}));
}

export async function startMcp(name: string) {
  return hubCall(hub().call("mcp.startServer", { name }));
}

export async function stopMcp(name: string) {
  return hubCall(hub().call("mcp.stopServer", { name }));
}

export async function startAllMcp() {
  return hubCall(hub().call("mcp.startAll", {}));
}

export async function stopAllMcp() {
  return hubCall(hub().call("mcp.stopAll", {}));
}

export async function getAcpStatus() {
  return hubCall(hub().call("acp.status", {}));
}

export async function startAcp(name: string) {
  return hubCall(hub().call("acp.startAgent", { name }));
}

export async function stopAcp(name: string) {
  return hubCall(hub().call("acp.stopAgent", { name }));
}

export async function startAllAcp() {
  return hubCall(hub().call("acp.startAll", {}));
}

export async function stopAllAcp() {
  return hubCall(hub().call("acp.stopAll", {}));
}

export type EntityRow = import("@freeanima/core/db/pg/entity/types").EntityRow;

type EntityListResponse = { items: EntityRow[]; total: number };

export async function listWorldEntities(opts?: { offset?: number; limit?: number }) {
  return hubCall(
    hub().call("entity.worldsList", omitUndefined(opts ?? {})),
  ) as Promise<EntityListResponse>;
}

export type WorldGrantInput = {
  subject_id: number;
  permission: "read" | "write";
};

export async function createWorldEntity(body: {
  title: string;
  summary?: string;
  content?: string;
  private?: boolean;
  owner_subject_id?: number;
  grants?: WorldGrantInput[];
}) {
  return hubCall(hub().call("entity.worldsCreate", body as never)) as Promise<EntityRow>;
}

export async function updateWorldEntity(
  id: number,
  body: {
    title?: string;
    summary?: string;
    content?: string;
    private?: boolean;
    owner_subject_id?: number | null;
    grants?: WorldGrantInput[];
  },
) {
  return hubCall(
    hub().call("entity.worldsPatch", { id: String(id), ...body }),
  ) as Promise<EntityRow>;
}

export async function listSubjectEntities(opts?: { offset?: number; limit?: number }) {
  return hubCall(
    hub().call("entity.subjectsList", omitUndefined(opts ?? {})),
  ) as Promise<EntityListResponse>;
}

export async function createSubjectEntity(body: {
  type: "agent" | "user";
  title: string;
  summary?: string;
  content?: string;
}) {
  return hubCall(hub().call("entity.subjectsCreate", body as never)) as Promise<EntityRow>;
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
  return hubCall(
    hub().call("entity.subjectsPatch", { id: String(id), ...body }),
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
  return hubCall(hub().call("tokens.listForSubject", { id: subjectId })) as Promise<{
    items: ServiceApiTokenPublic[];
  }>;
}

export async function createSubjectApiToken(subjectId: number, body: { name: string }) {
  return hubCall(
    hub().call("tokens.createForSubject", { id: subjectId, name: body.name }),
  ) as Promise<{ token: ServiceApiTokenPublic; plaintext: string }>;
}

export async function revokeSubjectApiToken(tokenId: number) {
  return hubCall(hub().call("tokens.revoke", { id: tokenId })) as Promise<{ ok: true }>;
}
