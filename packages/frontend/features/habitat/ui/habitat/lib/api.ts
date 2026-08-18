import type {
  ConversationSummary,
  ServiceSnapshot,
} from "@freeanima/shared/rpc-contract/frames/snapshot.ts";
import { resetBundledHabitatClientForTests } from "@freeanima/shared/habitat-client/bundled-browser.ts";
import { resolveCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { reviveDates } from "@freeanima/features/habitat/protocol/habitat-contract/date-json.ts";

import { getHabitatRpcClient } from "./habitat-client.ts";
import { omitUndefined } from "./omit-undefined.ts";
import { resetHabitatFetchCache } from "./habitat-fetch.ts";
import { resolveApiOrigin } from "./habitat-origin.ts";

function habitat() {
  return getHabitatRpcClient();
}

async function hubCall<T>(promise: Promise<T>): Promise<T> {
  return reviveDates(await promise);
}

export function resetApiClientCache(): void {
  resetBundledHabitatClientForTests();
  resetHabitatFetchCache();
}

export async function listConversations(opts?: { offset?: number; limit?: number }) {
  // 运维面必须走 adminListAll：conversation.list 会按 SAP 上下文默认 platform，
  // Habitat HTTP REST 的 app_id/instance_id 为空时会落到 "remote::" 过滤，列表恒为空。
  const raw = await habitat().call(
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
    conversations: rows.map((s): ConversationSummary => ({
      id: s.conversation_id,
      title: s.title ?? "",
      platform: s.platform ?? "",
      created_at: new Date(s.updated_at ?? 0),
      updated_at: new Date(s.updated_at ?? 0),
      ...(s.archived_at !== undefined && s.archived_at !== null
        ? { archived_at: new Date(s.archived_at) }
        : {}),
    })),
    ...(total !== undefined ? { total } : {}),
  });
}

export async function getConversationInfo(conversationId: string) {
  return hubCall(habitat().call("conversation.adminGet", { conversationId }));
}

export async function createConversation(platform: string) {
  const p = platform.trim();
  if (!p) throw new Error("platform is required");
  return hubCall(habitat().call("conversation.adminCreate", { platform: p }));
}

export async function getStoredMessages(conversationId: string, offset?: number, limit?: number) {
  return hubCall(
    habitat().call(
      "conversation.messages",
      omitUndefined({
        conversation_id: conversationId,
        offset,
        limit,
      }),
    ),
  );
}

export function subscribeConversationEvents(
  conversationId: string,
  onUpdate: () => void,
): { unsubscribe: () => void } {
  const client = getHabitatRpcClient() as ReturnType<typeof getHabitatRpcClient> & {
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
  return hubCall(
    habitat().call("conversation.patchTitle", { conversation_id: conversationId, title }),
  );
}

export async function listConversationCommands(opts?: { all?: boolean; platform?: string }) {
  return hubCall(
    habitat().call(
      "conversation.commands",
      omitUndefined({ all: opts?.all, platform: opts?.platform }),
    ),
  );
}

const HABITAT_STATUS_CACHE_NS = "habitat-status";
const HABITAT_STATUS_CACHE_KEY = "dashboard";
const HABITAT_MEMORY_CACHE_NS = "habitat-memory";

export async function getStatus(): Promise<ServiceSnapshot> {
  const scope = resolveCacheScope(resolveApiOrigin());
  return withOfflineCache({
    scope,
    namespace: HABITAT_STATUS_CACHE_NS,
    id: HABITAT_STATUS_CACHE_KEY,
    fetch: async () => (await hubCall(habitat().call("status.get", {}))) as ServiceSnapshot,
    offlineError: "status.get unavailable offline",
  });
}

export async function getToolsStatus(scope?: "default" | "all") {
  return hubCall(habitat().call("status.tools", scope === "default" ? { scope: "default" } : {}));
}

export async function listHabitatSkills() {
  return hubCall(habitat().call("skill.list", {})) as Promise<{
    skills: Array<{
      name: string;
      description: string;
      origin: string;
      status: string;
      entity_id: number;
      world_id: number;
      allowed_tools: string[];
      denied_tools: string[];
    }>;
  }>;
}

export type HabitatSubagentRow = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  content: string;
  skills: string[];
  max_loop_iterations: number | null;
  temperature_tier: "focused" | "balanced" | "creative" | null;
  allowed_tools: string[];
  denied_tools: string[];
  prompt_includes: Array<"self" | "world" | "time">;
  world_id: number;
  created_at: string;
  updated_at: string;
};

export async function listHabitatSubagents(subjectKind: "user" | "agent" = "agent") {
  return hubCall(habitat().call("subagent.list", { subject_kind: subjectKind })) as Promise<{
    items: HabitatSubagentRow[];
  }>;
}

export async function createHabitatSubagent(input: {
  subject_kind: "user" | "agent";
  slug: string;
  title: string;
  summary?: string;
  content?: string;
  skills?: string[];
  max_loop_iterations?: number | null;
  temperature_tier?: "focused" | "balanced" | "creative" | null;
  allowed_tools?: string[];
  denied_tools?: string[];
  prompt_includes?: Array<"self" | "world" | "time">;
}) {
  return hubCall(habitat().call("subagent.create", input)) as Promise<{
    item: HabitatSubagentRow;
  }>;
}

export async function patchHabitatSubagent(input: {
  subject_kind: "user" | "agent";
  id: number;
  slug?: string;
  title?: string;
  summary?: string;
  content?: string;
  skills?: string[];
  max_loop_iterations?: number | null;
  temperature_tier?: "focused" | "balanced" | "creative" | null;
  allowed_tools?: string[];
  denied_tools?: string[];
  prompt_includes?: Array<"self" | "world" | "time">;
}) {
  return hubCall(habitat().call("subagent.patch", input)) as Promise<{
    item: HabitatSubagentRow;
  }>;
}

export async function deleteHabitatSubagent(subjectKind: "user" | "agent", id: number) {
  return hubCall(habitat().call("subagent.delete", { subject_kind: subjectKind, id })) as Promise<{
    ok: true;
  }>;
}

export async function getHabitatSkill(name: string) {
  return hubCall(habitat().call("skill.get", { name })) as Promise<{
    name: string;
    description: string;
    origin: string;
    status: string;
    entity_id: number;
    world_id: number;
    allowed_tools: string[];
    denied_tools: string[];
    license?: string;
    compatibility?: string;
    content: string;
    resources: Array<{ path: string; entity_id: number; kind: string }>;
  }>;
}

export async function getPromptDebug(conversationId?: string) {
  return hubCall(
    habitat().call("prompt.debug", omitUndefined({ conversation_id: conversationId })),
  );
}

export async function getCronJobs() {
  return hubCall(habitat().call("status.cronJobs", {}));
}

export async function pauseCronJob(id: string) {
  return hubCall(habitat().call("status.cronJobPause", { id }));
}

export async function resumeCronJob(id: string) {
  return hubCall(habitat().call("status.cronJobResume", { id }));
}

export async function runCronJob(id: string) {
  return hubCall(habitat().call("status.cronJobRun", { id }));
}

export async function createCronJob(body: {
  name: string;
  schedule: string;
  prompt: string;
  notify_on_success?: boolean;
}) {
  return hubCall(habitat().call("status.cronJobCreate", body));
}

export async function deleteCronJob(id: string) {
  return hubCall(habitat().call("status.cronJobDelete", { id }));
}

export async function getMemoryMaintenanceSummary() {
  return hubCall(habitat().call("memoryMaintenance.summary", {}));
}

export async function getMemoryMaintenanceStatus() {
  return hubCall(habitat().call("memoryMaintenance.status", {}));
}

export async function startMemoryMaintenanceCycle(body?: {
  day?: string;
  reflect_mode?: "full" | "incremental";
}) {
  return hubCall(habitat().call("memoryMaintenance.startCycle", body ?? {}));
}

export async function startMemoryMaintenanceStep(body: {
  step_id: string;
  day?: string;
  force?: boolean;
  reflect_mode?: "full" | "incremental";
}) {
  return hubCall(habitat().call("memoryMaintenance.runStep", body));
}

export async function startMemoryMaintenanceCatchUp() {
  return hubCall(habitat().call("memoryMaintenance.startCatchUp", {}));
}

export async function listCronLogs(opts?: {
  job_id?: string;
  limit?: number;
  offset?: number;
  ok?: boolean;
}) {
  return hubCall(habitat().call("cronLogs.list", omitUndefined(opts ?? {})));
}

export async function listAutoLlmRuns(opts?: {
  run_kind?: string;
  status?: "ok" | "error";
  limit?: number;
  offset?: number;
}) {
  return hubCall(habitat().call("autoLlmRuns.list", omitUndefined(opts ?? {})));
}

export async function getAutoLlmRun(id: string) {
  return hubCall(habitat().call("autoLlmRuns.get", { id }));
}

export async function restartService() {
  return hubCall(habitat().call("status.restart", {}));
}

export async function passiveRecallDebug(input: { user_text: string; limit?: number }) {
  return hubCall(habitat().call("memory.passiveRecallDebug", input as never));
}

export async function listTemporalSummaries(input: {
  window?: "day" | "month" | "year";
  period_start_from?: string;
  period_start_to?: string;
  offset?: number;
  limit?: number;
}) {
  return hubCall(habitat().call("memory.temporalList", input as never));
}

export async function regenerateTemporalSummary(input: {
  window: "day" | "month" | "year";
  period_start: string;
}) {
  return hubCall(habitat().call("memory.temporalRegenerate", input as never));
}

export async function backfillMissingTemporalSummaries(input: {
  window: "day" | "month" | "year";
  period_start_from: string;
  period_start_to: string;
}) {
  return hubCall(habitat().call("memory.temporalBackfillMissing", input as never));
}

export async function rebuildTemporalSummariesInRange(input: {
  window: "day" | "month" | "year";
  period_start_from: string;
  period_start_to: string;
}) {
  return hubCall(habitat().call("memory.temporalRebuildRange", input as never));
}

export async function getTemporalBatchJobStatus() {
  return hubCall(habitat().call("memory.temporalBatchStatus", {}));
}

export async function listTemporalSystemRolls() {
  return hubCall(habitat().call("memory.temporalSystemRollList", {}));
}

export async function regenerateTemporalSystemRoll(input: {
  kind: "past_days" | "past_months" | "past_years";
}) {
  return hubCall(habitat().call("memory.temporalSystemRollRegenerate", input as never));
}

export async function startTemporalSystemRollBatch(input?: {
  kinds?: Array<"past_days" | "past_months" | "past_years">;
}) {
  return hubCall(habitat().call("memory.temporalSystemRollBatchStart", (input ?? {}) as never));
}

export async function getTemporalSystemRollBatchStatus() {
  return hubCall(habitat().call("memory.temporalSystemRollBatchStatus", {}));
}

export async function countSemanticMemory() {
  return hubCall(habitat().call("memory.semanticCount", {}));
}

export async function listSemanticMemories(input: {
  query?: string;
  offset?: number;
  limit?: number;
  types?: string[];
  status?: string;
  source_conversation?: string;
  sort_by?: "created_at" | "updated_at" | "reference_count" | "rank";
  cluster_id?: number | null;
}) {
  const scope = resolveCacheScope(resolveApiOrigin());
  const cacheId = JSON.stringify(input);
  return withOfflineCache({
    scope,
    namespace: HABITAT_MEMORY_CACHE_NS,
    id: cacheId,
    fetch: async () => hubCall(habitat().call("memory.semanticList", input as never)),
    reconcile: (result) => reviveDates(result),
    offlineError: "memory.semanticList unavailable offline",
  });
}

export async function listSemanticMemoryClusters() {
  return hubCall(habitat().call("memory.semanticClusters", {})) as Promise<{
    items: Array<{ cluster_id: number | null; count: number; title: string | null }>;
  }>;
}

export async function updateSemanticMemoryPinned(input: { id: number; pinned: boolean }) {
  return hubCall(habitat().call("memory.semanticPin", input));
}

export async function getFtsStatus() {
  return hubCall(habitat().call("fts.status", {}));
}

export async function startRebuildFtsIndex(opts?: { only_missing?: boolean }) {
  return hubCall(habitat().call("fts.rebuild", { only_missing: opts?.only_missing ?? true }));
}

export async function getRebuildFtsJobStatus() {
  return hubCall(habitat().call("fts.rebuildStatus", {}));
}

export type HabitatRedisLockInfo = {
  key: string;
  logicalKey: string;
  ttlMs: number;
};

export type HabitatRedisLocksSnapshot = {
  configured: boolean;
  locks: HabitatRedisLockInfo[];
};

export async function listRedisLocks() {
  return hubCall(habitat().call("redisLocks.list", {})) as Promise<HabitatRedisLocksSnapshot>;
}

export async function deleteRedisLock(key: string) {
  return hubCall(habitat().call("redisLocks.delete", { key })) as Promise<{ deleted: boolean }>;
}

export async function getSelfBlocks() {
  return hubCall(habitat().call("self.blocks", {}));
}

export async function getMcpStatus() {
  return hubCall(habitat().call("mcp.status", {}));
}

export async function getOutpostsStatus() {
  return hubCall(habitat().call("outposts.status", {}));
}

export async function startMcp(name: string) {
  return hubCall(habitat().call("mcp.startServer", { name }));
}

export async function stopMcp(name: string) {
  return hubCall(habitat().call("mcp.stopServer", { name }));
}

export async function startAllMcp() {
  return hubCall(habitat().call("mcp.startAll", {}));
}

export async function stopAllMcp() {
  return hubCall(habitat().call("mcp.stopAll", {}));
}

export type EntityRow = import("@freeanima/shared/pg-shapes/rows/entity-row.ts").EntityRow;

type EntityListResponse = { items: EntityRow[]; total: number };

export async function listWorldEntities(opts?: { offset?: number; limit?: number }) {
  return hubCall(
    habitat().call("entity.worldsList", omitUndefined(opts ?? {})),
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
  stable_key?: string;
}) {
  return hubCall(habitat().call("entity.worldsCreate", body as never)) as Promise<EntityRow>;
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
    stable_key?: string;
  },
) {
  const payload = { id: String(id), ...body };
  return hubCall(habitat().call("entity.worldsPatch", payload as never)) as Promise<EntityRow>;
}

export async function listSubjectEntities(opts?: { offset?: number; limit?: number }) {
  return hubCall(
    habitat().call("entity.subjectsList", omitUndefined(opts ?? {})),
  ) as Promise<EntityListResponse>;
}

export async function createSubjectEntity(body: {
  type: "agent" | "user";
  title: string;
  summary?: string;
  content?: string;
}) {
  return hubCall(habitat().call("entity.subjectsCreate", body as never)) as Promise<EntityRow>;
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
    habitat().call("entity.subjectsPatch", { id: String(id), ...body }),
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
  revealable: boolean;
};

export async function listSubjectApiTokens(subjectId: number) {
  return hubCall(habitat().call("tokens.listForSubject", { id: subjectId })) as Promise<{
    items: ServiceApiTokenPublic[];
  }>;
}

export async function createSubjectApiToken(subjectId: number, body: { name: string }) {
  return hubCall(
    habitat().call("tokens.createForSubject", { id: subjectId, name: body.name }),
  ) as Promise<{ token: ServiceApiTokenPublic; plaintext: string }>;
}

export async function revokeSubjectApiToken(tokenId: number) {
  return hubCall(habitat().call("tokens.revoke", { id: tokenId })) as Promise<{ ok: true }>;
}

export async function revealSubjectApiToken(tokenId: number) {
  return hubCall(habitat().call("tokens.reveal", { id: tokenId })) as Promise<{
    plaintext: string;
  }>;
}

export async function updateSubjectApiTokenName(tokenId: number, name: string) {
  return hubCall(habitat().call("tokens.updateName", { id: tokenId, name })) as Promise<{
    token: ServiceApiTokenPublic;
  }>;
}
