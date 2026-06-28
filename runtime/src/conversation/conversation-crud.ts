import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import {
  mergeToolSetNames,
  resolveDefaultConversationToolSets,
  resolveDefaultConversationToolSetsForMeta,
  resolveToolSetNames,
  toolNamesForToolSets,
} from "@freeanima/core/tool";
import { getActiveConfig, getProfileHopModel } from "@freeanima/core/config";
import { CST_OFFSET_MS, formatCstIso } from "@freeanima/core/util";
import { PROFILE_CHAT } from "@freeanima/core/provider";
import { buildSystemPrompt } from "@freeanima/core/hooks/prompt";
import { capabilityMaskSchema, stripOriginRoutingMeta } from "@freeanima/core/db/schema";
import { applyConversationToolMaskFilter } from "@freeanima/core/tool";
import {
  isConversationMeta,
  type StoredMessage,
  type ConversationMetaMessage,
  type ConversationMetaLoadResult,
  type OpenAiToolSchema,
} from "@freeanima/core/db/domain";
import {
  loadMetaWithRouting,
  loadMessagesForRuntimeWithRouting,
  loadMessagesPageWithRouting,
  loadMessagesWithRouting,
  loadConversationToolsWithRouting,
  countMessagesWithRouting,
  countUserMessagesWithRouting,
  listConversationsWithRouting,
  pgCountConversationsByPlatform,
  pgDeleteDebugConversations,
  pgListDebugConversationIds,
  pgListConversationSummaries,
  pgListConversationSummariesPage,
  pgLastMessageTimestamp,
  pgFindConversationIdByPlatformInfo,
  pgListConversationIdsMatchingPlatformProbe,
  pgWriteDeleteConversation,
  pgArchiveConversation,
  pgUnarchiveConversation,
  pgWriteMessage,
  pgWriteMeta,
  pgWritePatchMeta,
  pgWriteTruncate,
  postgresAvailable,
  conversationExistsWithRouting,
  nextMessagePosWithRouting,
} from "./conversation-store-pg-bridge.ts";
import type { PgRepositories } from "@freeanima/core/repos";

export type Message = StoredMessage;

/** Default working directory for new conversation (matches Python init_conversation; isolated from service start dir) */
export function allocateConversationCwd(sid: string): string {
  for (let attempt = 0; attempt < 8; attempt++) {
    const rand = randomBytes(4).toString("hex");
    const path = join(tmpdir(), `anima-cwd-${sid.slice(0, 8)}-${rand}`);
    try {
      mkdirSync(path, { recursive: false, mode: 0o700 });
      return path;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
  }
  return mkdtempSync(join(tmpdir(), "anima-cwd-"));
}

/** Read cached ToolSets and resolve to OpenAI schema; fallback to defaults and write meta */
export async function loadConversationTools(
  repos: PgRepositories,
  tools: ToolSetRegistry,
  conversationId: string,
  cachedMeta?: ConversationMetaLoadResult,
): Promise<OpenAiToolSchema[]> {
  let toolsetNames: string[] = [];
  if (
    cachedMeta != null &&
    isConversationMeta(cachedMeta) &&
    cachedMeta.cached_toolsets.length > 0
  ) {
    toolsetNames = cachedMeta.cached_toolsets;
  } else if (postgresAvailable(repos)) {
    toolsetNames = await loadConversationToolsWithRouting(repos, conversationId);
  } else {
    const meta = cachedMeta ?? (await loadConversationMeta(repos, conversationId));
    if (isConversationMeta(meta) && meta.cached_toolsets.length > 0) {
      toolsetNames = meta.cached_toolsets;
    }
  }
  if (toolsetNames.length > 0) {
    const resolved = resolveToolSetNames(tools, toolsetNames);
    const metaForMask =
      cachedMeta != null && isConversationMeta(cachedMeta)
        ? cachedMeta
        : await loadConversationMeta(repos, conversationId);
    let names = toolNamesForToolSets(tools, resolved);
    if (isConversationMeta(metaForMask)) {
      names = applyConversationToolMaskFilter(names, metaForMask);
    }
    return tools.openaiSchemasFromNames(names);
  }
  const fresh = resolveDefaultConversationToolSets(tools);
  if (fresh.length > 0) {
    await updateConversationMetaField(repos, conversationId, {
      cached_toolsets: fresh,
      staged_toolsets: [],
    });
  }
  let effective = toolNamesForToolSets(tools, fresh);
  const metaForMask =
    cachedMeta != null && isConversationMeta(cachedMeta)
      ? cachedMeta
      : await loadConversationMeta(repos, conversationId);
  if (isConversationMeta(metaForMask)) {
    effective = applyConversationToolMaskFilter(effective, metaForMask);
  }
  return tools.openaiSchemasFromNames(effective);
}

export async function loadConversationMeta(
  repos: PgRepositories,
  conversationId: string,
): Promise<ConversationMetaLoadResult> {
  return loadMetaWithRouting(repos, conversationId);
}

export function generateConversationId(): string {
  const d = new Date(Date.now() + CST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  const ts = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}_${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
  return `${ts}_${randomBytes(2).toString("hex")}`;
}

export async function countConversationsByPlatform(
  repos: PgRepositories,
): Promise<Record<string, number>> {
  if (postgresAvailable(repos)) {
    return pgCountConversationsByPlatform(repos);
  }
  const byPlatform: Record<string, number> = {};
  for (const sid of await listConversations(repos)) {
    const meta = await loadConversationMeta(repos, sid);
    const raw = isConversationMeta(meta) ? meta.platform : undefined;
    const platform = typeof raw === "string" && raw.trim() ? raw.trim() : "unknown";
    byPlatform[platform] = (byPlatform[platform] ?? 0) + 1;
  }
  return byPlatform;
}

export async function listConversationSummaries(
  repos: PgRepositories,
  platform?: string | null,
  opts?: { includeArchived?: boolean },
): Promise<
  Array<{
    id: string;
    title: string;
    created: string;
    platform: string;
    archived_at?: string | null;
  }>
> {
  if (postgresAvailable(repos)) {
    return pgListConversationSummaries(repos, platform, opts);
  }
  const ids = await listConversations(repos, platform, opts);
  const out: Array<{
    id: string;
    title: string;
    created: string;
    platform: string;
    archived_at?: string | null;
  }> = [];
  for (const sid of ids) {
    const meta = await loadConversationMeta(repos, sid);
    out.push({
      id: sid,
      title: isConversationMeta(meta) ? (meta.title ?? "") : "",
      created: isConversationMeta(meta) ? meta.timestamp : "",
      platform: isConversationMeta(meta) ? (meta.platform ?? "") : "",
    });
  }
  return out;
}

export async function listConversationSummariesPage(
  repos: PgRepositories,
  opts?: { platform?: string | null; offset?: number; limit?: number; includeArchived?: boolean },
): Promise<{
  items: Array<{
    id: string;
    title: string;
    created: string;
    platform: string;
    archived_at?: string | null;
  }>;
  total: number;
}> {
  if (postgresAvailable(repos)) {
    return pgListConversationSummariesPage(repos, opts);
  }
  const all = await listConversationSummaries(repos, opts?.platform, {
    includeArchived: opts?.includeArchived,
  });
  const offset = Math.max(0, opts?.offset ?? 0);
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 20));
  return {
    items: all.slice(offset, offset + limit),
    total: all.length,
  };
}

export async function listConversations(
  repos: PgRepositories,
  platform?: string | null,
  opts?: { includeArchived?: boolean },
): Promise<string[]> {
  return listConversationsWithRouting(repos, platform, opts);
}

/** Whether conversation exists (PostgreSQL) */
export async function conversationExists(
  repos: PgRepositories,
  conversationId: string,
): Promise<boolean> {
  return conversationExistsWithRouting(repos, conversationId);
}

export async function load(repos: PgRepositories, conversationId: string): Promise<Message[]> {
  return loadMessagesWithRouting(repos, conversationId);
}

export async function loadMessagePage(
  repos: PgRepositories,
  conversationId: string,
  offset: number,
  limit: number,
): Promise<Message[]> {
  return loadMessagesPageWithRouting(repos, conversationId, offset, limit);
}

export async function countMessages(
  repos: PgRepositories,
  conversationId: string,
): Promise<number> {
  return countMessagesWithRouting(repos, conversationId);
}

export async function countUserMessages(
  repos: PgRepositories,
  conversationId: string,
): Promise<number> {
  return countUserMessagesWithRouting(repos, conversationId);
}

export async function loadForRuntime(
  repos: PgRepositories,
  conversationId: string,
  meta?: ConversationMetaLoadResult,
): Promise<Message[]> {
  const m = meta ?? (await loadConversationMeta(repos, conversationId));
  return loadMessagesForRuntimeWithRouting(repos, conversationId, m);
}

export async function appendMessage(
  repos: PgRepositories,
  msg: StoredMessage,
  conversationId: string,
): Promise<void> {
  const out: StoredMessage & { timestamp?: string; id?: number } = { ...msg };
  if (!out.timestamp) out.timestamp = formatCstIso();
  if (out.pos === undefined && out.role !== "conversation_meta") {
    out.pos = await nextMessagePosWithRouting(repos, conversationId);
  }
  if (out.role !== "conversation_meta") {
    await pgWriteMessage(repos, conversationId, out);
  }
}

export async function appendConversationMeta(
  repos: PgRepositories,
  conversationId: string,
  tools: string[],
  model: string,
  opts?: { platform?: string; functions?: string[] },
): Promise<void> {
  const meta: ConversationMetaMessage = {
    role: "conversation_meta",
    model,
    cached_toolsets: tools,
    staged_toolsets: [],
    functions: opts?.functions ?? [],
    timestamp: formatCstIso(),
  };
  if (opts?.platform) meta.platform = opts.platform;
  await pgWriteMeta(repos, conversationId, meta);
}

export async function initConversation(
  repos: PgRepositories,
  tools: ToolSetRegistry,
  sid: string,
  model: string,
  opts: { platform: string; functions?: string[]; platform_extra?: Record<string, unknown> },
): Promise<void> {
  const cwd = allocateConversationCwd(sid);
  const capabilityMaskRaw = opts.platform_extra?.capability_mask;
  const capability_mask =
    capabilityMaskRaw !== undefined ? capabilityMaskSchema.parse(capabilityMaskRaw) : undefined;
  const platform_extra = opts.platform_extra ? { ...opts.platform_extra } : undefined;
  if (platform_extra) delete platform_extra.capability_mask;

  const metaDraft: ConversationMetaMessage = {
    role: "conversation_meta",
    model,
    cached_toolsets: resolveDefaultConversationToolSets(tools),
    staged_toolsets: [],
    functions: opts.functions ?? [],
    timestamp: formatCstIso(),
    platform: opts.platform,
    cwd,
    capability_mask,
    platform_extra:
      platform_extra && Object.keys(platform_extra).length > 0 ? platform_extra : undefined,
  };
  const systemPrompt = await buildSystemPrompt(opts.functions ?? [], cwd, metaDraft);
  const meta: ConversationMetaMessage = { ...metaDraft, system_prompt: systemPrompt };
  await pgWriteMeta(repos, sid, meta);
}

export async function newConversation(
  repos: PgRepositories,
  tools: ToolSetRegistry,
  platform: string,
  model?: string,
  platformExtra?: Record<string, unknown>,
): Promise<string> {
  const cfg = getActiveConfig().data;
  const sid = generateConversationId();
  await initConversation(repos, tools, sid, model ?? getProfileHopModel(cfg, PROFILE_CHAT), {
    platform,
    platform_extra: platformExtra,
  });
  return sid;
}

function originExtraMatches(
  stored: Record<string, unknown>,
  platformExtra: Record<string, unknown>,
): boolean {
  const identity = stripOriginRoutingMeta(platformExtra);
  for (const [key, val] of Object.entries(identity)) {
    if (String(stored[key] ?? "") !== String(val ?? "")) {
      return false;
    }
  }
  return true;
}

async function resolveFoundOriginConversation(
  repos: PgRepositories,
  conversationId: string,
): Promise<string | null> {
  const meta = await loadConversationMeta(repos, conversationId);
  if (!isConversationMeta(meta)) return null;
  if (meta.platform_extra?.origin_active === false) return null;
  if (meta.platform_extra?.origin_active !== true) {
    await activateConversationOrigin(repos, conversationId);
  }
  return conversationId;
}

/** Mark conversation as the sole active origin; siblings with same identity become inactive. */
export async function activateConversationOrigin(
  repos: PgRepositories,
  conversationId: string,
): Promise<void> {
  const meta = await loadConversationMeta(repos, conversationId);
  if (!isConversationMeta(meta)) return;
  const platform = meta.platform ?? "";
  if (!platform) return;
  const identityExtra = stripOriginRoutingMeta(meta.platform_extra ?? {});

  let siblingIds: string[] = [];
  if (postgresAvailable(repos) && Object.keys(identityExtra).length > 0) {
    siblingIds = await pgListConversationIdsMatchingPlatformProbe(repos, platform, identityExtra);
  }
  for (const sid of await listConversationsWithRouting(repos, platform)) {
    if (siblingIds.includes(sid)) continue;
    try {
      const siblingMeta = await loadConversationMeta(repos, sid);
      if (!isConversationMeta(siblingMeta)) continue;
      if (Object.keys(identityExtra).length > 0) {
        if (!originExtraMatches(siblingMeta.platform_extra ?? {}, identityExtra)) continue;
      }
      siblingIds.push(sid);
    } catch {
      continue;
    }
  }

  if (!siblingIds.includes(conversationId)) siblingIds.push(conversationId);

  for (const sid of siblingIds) {
    const siblingMeta = await loadConversationMeta(repos, sid);
    if (!isConversationMeta(siblingMeta)) continue;
    const active = sid === conversationId;
    const nextExtra = { ...siblingMeta.platform_extra, origin_active: active };
    await updateConversationMetaField(repos, sid, { platform_extra: nextExtra });
  }
}

/** Match existing conversation by platform + platform_extra (each extra item must match meta) */
export async function findConversationByOrigin(
  repos: PgRepositories,
  platform: string,
  platformExtra: Record<string, unknown> = {},
): Promise<string | null> {
  if (postgresAvailable(repos) && Object.keys(platformExtra).length > 0) {
    try {
      const sid = await pgFindConversationIdByPlatformInfo(repos, platform, platformExtra);
      if (sid) return resolveFoundOriginConversation(repos, sid);
    } catch {
      /* fallback scan */
    }
  }

  try {
    let bestInactive: string | null = null;
    for (const sid of await listConversationsWithRouting(repos, platform)) {
      try {
        const meta = await loadConversationMeta(repos, sid);
        if (!isConversationMeta(meta)) continue;
        if (Object.keys(platformExtra).length > 0) {
          const stored = meta.platform_extra ?? {};
          if (!originExtraMatches(stored, platformExtra)) continue;
        }
        if (meta.platform_extra?.origin_active === true) {
          return sid;
        }
        if (meta.platform_extra?.origin_active !== false && !bestInactive) {
          bestInactive = sid;
        }
      } catch {
        continue;
      }
    }
    if (bestInactive) return resolveFoundOriginConversation(repos, bestInactive);
  } catch {
    /* empty */
  }
  return null;
}

export async function updateConversationMetaField(
  repos: PgRepositories,
  conversationId: string,
  patch: Partial<ConversationMetaMessage> & Record<string, unknown>,
): Promise<void> {
  const parsed = await loadConversationMeta(repos, conversationId);
  if (!isConversationMeta(parsed)) return;
  await pgWritePatchMeta(repos, conversationId, patch);
}

export async function patchConversationOrigin(
  repos: PgRepositories,
  conversationId: string,
  platform: string,
  platformExtra?: Record<string, unknown>,
): Promise<void> {
  const parsed = await loadConversationMeta(repos, conversationId);
  if (!isConversationMeta(parsed)) return;
  const meta: ConversationMetaMessage = parsed;
  const existing = meta.platform ?? "";
  if (existing && existing !== platform) {
    throw new Error(
      `conversation ${conversationId.slice(0, 16)}... platform cannot be changed: ${existing} -> ${platform}`,
    );
  }
  if (!existing) meta.platform = platform;
  if (platformExtra !== undefined) meta.platform_extra = platformExtra;
  await pgWriteMeta(repos, conversationId, meta);
}

export async function rebuildConversationSystemPrompt(
  repos: PgRepositories,
  conversationId: string,
): Promise<void> {
  const meta = await loadConversationMeta(repos, conversationId);
  if (!isConversationMeta(meta)) return;
  const functions = meta.functions ?? [];
  const cwd = meta.cwd;
  const systemPrompt = await buildSystemPrompt(functions, cwd, meta);
  await updateConversationMetaField(repos, conversationId, { system_prompt: systemPrompt });
}

/** Promote staged ToolSets to cached and rebuild system_prompt */
export async function rebuildConversationCache(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  conversationId: string,
): Promise<{
  cachedCount: number;
  promoted: string[];
  systemPromptLength: number;
}> {
  const meta = await loadConversationMeta(repos, conversationId);
  if (!isConversationMeta(meta)) {
    throw new Error("conversation does not exist");
  }
  let cached = resolveToolSetNames(registry, meta.cached_toolsets ?? []);
  if (cached.length === 0) {
    cached = resolveDefaultConversationToolSetsForMeta(registry, meta);
  }
  const staged = [...(meta.staged_toolsets ?? [])];
  cached = mergeToolSetNames(cached, staged);
  await updateConversationMetaField(repos, conversationId, {
    cached_toolsets: cached,
    staged_toolsets: [],
    timestamp: formatCstIso(),
  });
  await rebuildConversationSystemPrompt(repos, conversationId);
  const after = await loadConversationMeta(repos, conversationId);
  const systemPromptLength = isConversationMeta(after) ? (after.system_prompt ?? "").length : 0;
  return {
    cachedCount: cached.length,
    promoted: staged,
    systemPromptLength,
  };
}

const RESUME_STALE_MS = 7 * 24 * 60 * 60 * 1000;

async function conversationLastActivityMs(
  repos: PgRepositories,
  conversationId: string,
): Promise<number | null> {
  const meta = await loadConversationMeta(repos, conversationId);
  const metaTs = isConversationMeta(meta) ? meta.timestamp : undefined;
  let last: number | null = metaTs ? Date.parse(metaTs) : null;
  const ts = await pgLastMessageTimestamp(repos, conversationId);
  if (ts) {
    const t = Date.parse(ts);
    if (!Number.isNaN(t) && (last === null || t > last)) last = t;
  }
  return last;
}

/** Conditionally refresh system_prompt when resuming conversation */
export async function refreshSystemPromptOnResume(
  repos: PgRepositories,
  conversationId: string,
): Promise<boolean> {
  const meta = await loadConversationMeta(repos, conversationId);
  if (!isConversationMeta(meta)) return false;
  const cached = (meta.system_prompt ?? "").trim();
  if (!cached) {
    await rebuildConversationSystemPrompt(repos, conversationId);
    return true;
  }
  const last = await conversationLastActivityMs(repos, conversationId);
  if (last === null) return false;
  if (Date.now() - last > RESUME_STALE_MS) {
    await rebuildConversationSystemPrompt(repos, conversationId);
    return true;
  }
  return false;
}

export async function assertConversationPlatform(
  repos: PgRepositories,
  conversationId: string,
  expected: string,
): Promise<void> {
  const meta = await loadConversationMeta(repos, conversationId);
  const p = isConversationMeta(meta) ? meta.platform : undefined;
  if (p && p !== expected) {
    throw new Error(`Conversation platform mismatch: expected ${expected}, got ${p}`);
  }
}

export async function appendUserTurn(
  repos: PgRepositories,
  conversationId: string,
  userText: string,
): Promise<string> {
  const content = userText;
  await appendMessage(repos, { role: "user", content }, conversationId);
  return content;
}

export async function updateConversationMeta(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  conversationId: string,
  model: string,
  opts?: { functions?: string[]; cached_toolsets?: string[] },
): Promise<void> {
  const parsed = await loadConversationMeta(repos, conversationId);
  if (!isConversationMeta(parsed)) return;
  const meta: ConversationMetaMessage = parsed;
  meta.model = model;
  meta.timestamp = formatCstIso();
  if (opts?.functions) meta.functions = opts.functions;
  if (opts?.cached_toolsets !== undefined) {
    meta.cached_toolsets = opts.cached_toolsets;
  } else if (!meta.cached_toolsets.length) {
    meta.cached_toolsets = resolveDefaultConversationToolSets(registry);
    meta.staged_toolsets = meta.staged_toolsets ?? [];
  }
  await pgWriteMeta(repos, conversationId, meta);
}

export async function setConversationTitle(
  repos: PgRepositories,
  conversationId: string,
  title: string,
): Promise<void> {
  await updateConversationMetaField(repos, conversationId, { title });
}

export async function archiveConversation(
  repos: PgRepositories,
  conversationId: string,
): Promise<void> {
  await pgArchiveConversation(repos, conversationId);
}

export async function unarchiveConversation(
  repos: PgRepositories,
  conversationId: string,
): Promise<void> {
  await pgUnarchiveConversation(repos, conversationId);
}

export async function deleteUserConversation(
  repos: PgRepositories,
  conversationId: string,
): Promise<void> {
  await pgWriteDeleteConversation(repos, conversationId);
}

export async function getConversationTitle(
  repos: PgRepositories,
  conversationId: string,
): Promise<string> {
  const meta = await loadConversationMeta(repos, conversationId);
  return isConversationMeta(meta) && typeof meta.title === "string" ? meta.title : "";
}

export async function getConversationCwd(
  repos: PgRepositories,
  conversationId: string,
): Promise<string | null> {
  const meta = await loadConversationMeta(repos, conversationId);
  const cwd = isConversationMeta(meta) ? meta.cwd : undefined;
  return typeof cwd === "string" && cwd ? cwd : null;
}

function expandUserPath(cwd: string): string {
  if (cwd.startsWith("~/")) return join(homedir(), cwd.slice(2));
  if (cwd === "~") return homedir();
  return cwd;
}

export async function setConversationCwd(
  repos: PgRepositories,
  conversationId: string,
  cwd: string,
): Promise<string> {
  const expanded = expandUserPath(cwd.trim());
  const resolved = resolve(expanded);
  if (!existsSync(resolved)) {
    throw new Error(`Path does not exist: ${cwd}`);
  }
  await updateConversationMetaField(repos, conversationId, { cwd: resolved });
  await rebuildConversationSystemPrompt(repos, conversationId);
  return resolved;
}

/** Delete assistant/tool messages after last user turn; return that user body */
export async function rollbackToLastUser(
  repos: PgRepositories,
  conversationId: string,
): Promise<string> {
  const parsed = await load(repos, conversationId);
  if (!parsed.length) throw new Error("No partner message to retry");

  let lastUserIdx = -1;
  for (let i = parsed.length - 1; i >= 0; i--) {
    if (parsed[i]?.role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx < 0) throw new Error("No partner message to retry");

  const kept = parsed.slice(0, lastUserIdx + 1);
  const lastUser = kept[lastUserIdx]!;
  const keepThroughPos = lastUser.pos;
  if (keepThroughPos === undefined) {
    throw new Error("No partner message to retry");
  }
  await pgWriteTruncate(repos, conversationId, Number(keepThroughPos));

  return lastUser.role === "user" ? lastUser.content : "";
}

/** Default minimum age before a stale conversation may be deleted by sleep-cycle cleanup */
export const STALE_SESSION_MIN_AGE_MS = 24 * 60 * 60 * 1000;

export type CleanupStaleConversationsResult = {
  deleted: number;
  ids: string[];
};

export async function cleanupStaleConversations(
  repos: PgRepositories,
  opts?: { olderThan?: Date; minAgeMs?: number },
): Promise<CleanupStaleConversationsResult> {
  if (!postgresAvailable(repos)) return { deleted: 0, ids: [] };
  const minAgeMs = opts?.minAgeMs ?? STALE_SESSION_MIN_AGE_MS;
  const olderThan = opts?.olderThan ?? new Date(Date.now() - minAgeMs);
  return await repos.conversation.deleteStaleConversations({ olderThan });
}

export async function cleanupDebugConversations(
  repos: PgRepositories,
  _maxAgeHours = 1,
): Promise<number> {
  if (!postgresAvailable(repos)) return 0;
  try {
    return await pgDeleteDebugConversations(repos);
  } catch {
    let removed = 0;
    for (const sid of await pgListDebugConversationIds(repos)) {
      try {
        await pgWriteDeleteConversation(repos, sid);
        removed++;
      } catch {
        /* skip */
      }
    }
    return removed;
  }
}
