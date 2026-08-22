import type {
  ConversationSummary,
  ServiceSnapshot,
} from "@freeanima/shared/rpc-contract/frames/snapshot.ts";
import type { LlmUsageTotals } from "@freeanima/shared/llm-usage";
import type { ServiceApiTokenAuthorization } from "@freeanima/shared/service-api-auth";
import { resetBundledHabitatClientForTests } from "@freeanima/shared/habitat-client/bundled-browser.ts";
import {
  semanticMemoryListBodySchema,
  subjectEntityCreateBodySchema,
  worldEntityCreateBodySchema,
  worldEntityPatchInputSchema,
} from "@freeanima/shared/habitat-contract";
import { isRecord } from "@freeanima/shared/util";
import { resolveCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import type { HabitatMethodInputs } from "@freeanima/client/portal-sdk/habitat-typed-client";
import { getUserSubjectId } from "@freeanima/client/portal-sdk/world-context.ts";
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

function readAdminConversationRow(value: unknown): {
  conversation_id: string;
  title?: string;
  platform?: string;
  updated_at?: string;
  archived_at?: string | null;
} | null {
  if (!isRecord(value) || typeof value.conversation_id !== "string") return null;
  return {
    conversation_id: value.conversation_id,
    ...(typeof value.title === "string" ? { title: value.title } : {}),
    ...(typeof value.platform === "string" ? { platform: value.platform } : {}),
    ...(typeof value.updated_at === "string" ? { updated_at: value.updated_at } : {}),
    ...(value.archived_at === null || typeof value.archived_at === "string"
      ? { archived_at: value.archived_at }
      : {}),
  };
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
  if (!isRecord(raw) || !Array.isArray(raw.conversations)) {
    throw new Error("conversation.adminListAll: invalid payload");
  }
  const rows = raw.conversations
    .map(readAdminConversationRow)
    .filter((row): row is NonNullable<typeof row> => row != null);
  const total = typeof raw.total === "number" ? raw.total : undefined;
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
    fetch: async () => {
      const raw = await hubCall(habitat().call("status.get", {}));
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- status.get 契约为 unknownOutputSchema，收窄到 ServiceSnapshot
      return raw as ServiceSnapshot;
    },
    offlineError: "status.get unavailable offline",
  });
}

export type UsageTodayResult = {
  day: string;
  conversation: LlmUsageTotals;
  auto_llm: LlmUsageTotals;
  total: LlmUsageTotals;
};

export async function getUsageToday(): Promise<UsageTodayResult> {
  const raw = await hubCall(habitat().call("usage.today", {}));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- usage.today 契约为 unknownOutputSchema，收窄到 UsageTodayResult
  return raw as UsageTodayResult;
}

export async function getToolsStatus(scope?: "default" | "all") {
  return hubCall(habitat().call("status.tools", scope === "default" ? { scope: "default" } : {}));
}

export async function listHabitatSkills() {
  const raw = await hubCall(habitat().call("skill.list", {}));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- skill.list 契约为 unknownOutputSchema，收窄到技能列表形
  return raw as {
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
  };
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

export async function listHabitatSubagents(subjectId?: number) {
  const subject_id = subjectId ?? (await getUserSubjectId());
  return hubCall(habitat().call("subagent.list", { subject_id })) as Promise<{
    items: HabitatSubagentRow[];
  }>;
}

export async function createHabitatSubagent(input: {
  subject_id?: number;
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
  const subject_id = input.subject_id ?? (await getUserSubjectId());
  return hubCall(habitat().call("subagent.create", { ...input, subject_id })) as Promise<{
    item: HabitatSubagentRow;
  }>;
}

export async function patchHabitatSubagent(input: {
  subject_id?: number;
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
  const subject_id = input.subject_id ?? (await getUserSubjectId());
  return hubCall(habitat().call("subagent.patch", { ...input, subject_id })) as Promise<{
    item: HabitatSubagentRow;
  }>;
}

export async function deleteHabitatSubagent(id: number, subjectId?: number) {
  const subject_id = subjectId ?? (await getUserSubjectId());
  return hubCall(habitat().call("subagent.delete", { subject_id, id })) as Promise<{
    ok: true;
  }>;
}

export async function getHabitatSkill(name: string) {
  const raw = await hubCall(habitat().call("skill.get", { name }));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- skill.get 契约为 unknownOutputSchema，收窄到技能详情形
  return raw as {
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
  };
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
  subject_id: number;
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
  agent_subject_id?: number;
}) {
  return hubCall(habitat().call("memoryMaintenance.runStep", body));
}

export async function startMemoryMaintenanceCatchUp(body?: { agent_subject_id?: number }) {
  return hubCall(habitat().call("memoryMaintenance.startCatchUp", body ?? {}));
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
  status?: "running" | "ok" | "error";
  limit?: number;
  offset?: number;
}) {
  return hubCall(habitat().call("autoLlmRuns.list", omitUndefined(opts ?? {})));
}

export async function getAutoLlmRun(id: string) {
  return hubCall(habitat().call("autoLlmRuns.get", { id }));
}

export async function listConversationShares() {
  return hubCall(habitat().call("conversation.share.list", {}));
}

export async function deleteConversationShare(id: string) {
  return hubCall(habitat().call("conversation.share.delete", { id })) as Promise<{ ok: true }>;
}

export async function restartService() {
  return hubCall(habitat().call("status.restart", {}));
}

export async function passiveRecallDebug(input: HabitatMethodInputs["memory.passiveRecallDebug"]) {
  return hubCall(habitat().call("memory.passiveRecallDebug", input));
}

export async function listTemporalSummaries(input: HabitatMethodInputs["memory.temporalList"]) {
  return hubCall(habitat().call("memory.temporalList", input));
}

export async function regenerateTemporalSummary(
  input: HabitatMethodInputs["memory.temporalRegenerate"],
) {
  return hubCall(habitat().call("memory.temporalRegenerate", input));
}

export async function backfillMissingTemporalSummaries(
  input: HabitatMethodInputs["memory.temporalBackfillMissing"],
) {
  return hubCall(habitat().call("memory.temporalBackfillMissing", input));
}

export async function rebuildTemporalSummariesInRange(
  input: HabitatMethodInputs["memory.temporalRebuildRange"],
) {
  return hubCall(habitat().call("memory.temporalRebuildRange", input));
}

export async function getTemporalBatchJobStatus() {
  return hubCall(habitat().call("memory.temporalBatchStatus", {}));
}

export async function listTemporalSystemRolls(input: { agent_subject_id: number }) {
  return hubCall(habitat().call("memory.temporalSystemRollList", input));
}

export async function regenerateTemporalSystemRoll(
  input: HabitatMethodInputs["memory.temporalSystemRollRegenerate"],
) {
  return hubCall(habitat().call("memory.temporalSystemRollRegenerate", input));
}

export async function startTemporalSystemRollBatch(
  input: HabitatMethodInputs["memory.temporalSystemRollBatchStart"],
) {
  return hubCall(habitat().call("memory.temporalSystemRollBatchStart", input));
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
  agent_subject_id?: number;
}) {
  const payload = semanticMemoryListBodySchema.parse(input);
  const scope = resolveCacheScope(resolveApiOrigin());
  const cacheId = JSON.stringify(payload);
  return withOfflineCache({
    scope,
    namespace: HABITAT_MEMORY_CACHE_NS,
    id: cacheId,
    fetch: async () => hubCall(habitat().call("memory.semanticList", payload)),
    reconcile: (result) => reviveDates(result),
    offlineError: "memory.semanticList unavailable offline",
  });
}

export async function listSemanticMemoryClusters() {
  const raw = await hubCall(habitat().call("memory.semanticClusters", {}));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- memory.semanticClusters 契约为 unknownOutputSchema，收窄到聚类列表形
  return raw as {
    items: Array<{ cluster_id: number | null; count: number; title: string | null }>;
  };
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
  const raw = await hubCall(habitat().call("redisLocks.list", {}));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- redisLocks.list 契约为 unknownOutputSchema，收窄到 HabitatRedisLocksSnapshot
  return raw as HabitatRedisLocksSnapshot;
}

export async function deleteRedisLock(key: string) {
  const raw = await hubCall(habitat().call("redisLocks.delete", { key }));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- redisLocks.delete 契约为 unknownOutputSchema，收窄到 { deleted }
  return raw as { deleted: boolean };
}

export type DataIntegrityIssue = {
  code: string;
  message: string;
  entity_id?: number;
};

export type DataIntegrityReport = {
  ok: boolean;
  entity_count: number;
  issue_count: number;
  truncated: boolean;
  issues: DataIntegrityIssue[];
};

export async function runDataIntegrityCheck() {
  const raw = await hubCall(habitat().call("dataIntegrity.run", {}));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- dataIntegrity.run 契约为 unknownOutputSchema，收窄到 DataIntegrityReport
  return raw as DataIntegrityReport;
}

export async function getSelfBlocks(input: { agent_subject_id: number }) {
  return hubCall(habitat().call("self.blocks", { agent_subject_id: input.agent_subject_id }));
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
  const raw = await hubCall(habitat().call("entity.worldsList", omitUndefined(opts ?? {})));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- entity.worldsList 契约为 unknownOutputSchema，收窄到 EntityListResponse
  return raw as EntityListResponse;
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
  const input = worldEntityCreateBodySchema.parse(body);
  const raw = await hubCall(habitat().call("entity.worldsCreate", input));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- entity.worldsCreate 契约为 unknownOutputSchema，收窄到 EntityRow
  return raw as EntityRow;
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
  const input = worldEntityPatchInputSchema.parse({ id: String(id), ...body });
  const raw = await hubCall(habitat().call("entity.worldsPatch", input));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- entity.worldsPatch 契约为 unknownOutputSchema，收窄到 EntityRow
  return raw as EntityRow;
}

export async function listSubjectEntities(opts?: { offset?: number; limit?: number }) {
  const raw = await hubCall(habitat().call("entity.subjectsList", omitUndefined(opts ?? {})));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- entity.subjectsList 契约为 unknownOutputSchema，收窄到 EntityListResponse
  return raw as EntityListResponse;
}

export async function createSubjectEntity(body: {
  type: "agent" | "user";
  title: string;
  summary?: string;
  content?: string;
}) {
  const input = subjectEntityCreateBodySchema.parse(body);
  const raw = await hubCall(habitat().call("entity.subjectsCreate", input));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- entity.subjectsCreate 契约为 unknownOutputSchema，收窄到 EntityRow
  return raw as EntityRow;
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
  const raw = await hubCall(habitat().call("entity.subjectsPatch", { id: String(id), ...body }));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- entity.subjectsPatch 契约为 unknownOutputSchema，收窄到 EntityRow
  return raw as EntityRow;
}

export type ServiceApiTokenPublic = {
  id: number;
  subject_id: number;
  name: string;
  prefix: string;
  authorization: ServiceApiTokenAuthorization;
  created_at: Date;
  expires_at: Date | null;
  last_used_at: Date | null;
  revoked_at: Date | null;
  revealable: boolean;
};

export async function listSubjectApiTokens(subjectId: number) {
  const raw = await hubCall(habitat().call("tokens.listForSubject", { id: subjectId }));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- tokens.listForSubject 契约为 unknownOutputSchema，收窄到 token 列表形
  return raw as { items: ServiceApiTokenPublic[] };
}

export async function getSubjectEntity(id: number) {
  const raw = await hubCall(habitat().call("entity.subjectsGet", { id: String(id) }));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- entity.subjectsGet 契约为 unknownOutputSchema，收窄到 EntityRow
  return raw as EntityRow;
}

export async function createSubjectApiToken(
  subjectId: number,
  body: {
    name: string;
    preset?: "full" | "app" | "extension" | "mcp";
    world_ids?: number[];
    authorization?: ServiceApiTokenAuthorization;
  },
) {
  const raw = await hubCall(
    habitat().call("tokens.createForSubject", {
      id: subjectId,
      name: body.name,
      ...(body.preset ? { preset: body.preset } : {}),
      ...(body.world_ids && body.world_ids.length > 0 ? { world_ids: body.world_ids } : {}),
      ...(body.authorization ? { authorization: body.authorization } : {}),
    }),
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- tokens.createForSubject 契约为 unknownOutputSchema，收窄到创建结果形
  return raw as { token: ServiceApiTokenPublic; plaintext: string };
}

export async function revokeSubjectApiToken(tokenId: number) {
  const raw = await hubCall(habitat().call("tokens.revoke", { id: tokenId }));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- tokens.revoke 契约为 unknownOutputSchema，收窄到 { ok: true }
  return raw as { ok: true };
}

export async function revealSubjectApiToken(tokenId: number) {
  const raw = await hubCall(habitat().call("tokens.reveal", { id: tokenId }));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- tokens.reveal 契约为 unknownOutputSchema，收窄到 { plaintext }
  return raw as { plaintext: string };
}

export async function updateSubjectApiTokenName(tokenId: number, name: string) {
  const raw = await hubCall(habitat().call("tokens.updateName", { id: tokenId, name }));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- tokens.updateName 契约为 unknownOutputSchema，收窄到 { token }
  return raw as { token: ServiceApiTokenPublic };
}

export type HabitatIdentityPublic = {
  habitat_instance_id: string;
  public_key: string;
};

/** 栖息地实例公开身份（无私钥） */
export async function getHabitatIdentityPublic(): Promise<HabitatIdentityPublic | null> {
  const raw = await hubCall(habitat().call("config.getSection", { section: "identity" }));
  const habitat_instance_id =
    typeof raw.habitat_instance_id === "string" ? raw.habitat_instance_id.trim() : "";
  const public_key = typeof raw.public_key === "string" ? raw.public_key.trim() : "";
  if (!habitat_instance_id || !public_key) return null;
  return { habitat_instance_id, public_key };
}
