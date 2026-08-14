import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import {
  mergeToolSetNames,
  resolveDefaultConversationToolSets,
  resolveDefaultConversationToolSetsForMeta,
  resolveToolSetNames,
  toolNamesForToolSets,
} from "@freeanima/habitat/core/tool";
import { getActiveRuntimeConfig, getProfileHopModel } from "@freeanima/habitat/core/config";
import { CST_OFFSET_MS, formatCstIso, omitUndefined } from "@freeanima/habitat/core/util";
import { PROFILE_CHAT } from "@freeanima/habitat/core/provider";
import { buildSystemPrompt } from "@freeanima/habitat/core/hooks/prompt";
import { stripOriginRoutingMeta } from "@freeanima/habitat/core/db/schema";
import { applyConversationToolPolicyFilter } from "@freeanima/habitat/core/tool";
import { isSystemPromptStale } from "./system-prompt-freshness.ts";
import {
  isConversationMeta,
  type StoredMessage,
  type ConversationMetaMessage,
  type ConversationMetaLoadResult,
  type OpenAiToolSchema,
} from "@freeanima/habitat/core/db/domain";
import {
  loadMetaWithRouting,
  loadMessagesForRuntimeWithRouting,
  loadMessagesPageWithRouting,
  loadMessagesBeforePosWithRouting,
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
  pgFindConversationIdByPlatformInfo,
  pgListConversationIdsMatchingPlatformProbe,
  pgWriteDeleteConversation,
  pgArchiveConversation,
  pgUnarchiveConversation,
  pgWriteMessage,
  pgWriteMeta,
  pgWritePatchMeta,
  pgWriteTruncate,
  conversationExistsWithRouting,
  nextMessagePosWithRouting,
  getMaxMessagePosWithRouting,
  findUserMessageByClientOpIdWithRouting,
  getLastMessageRoleWithRouting,
  deleteStaleConversations,
} from "./conversation-store-pg-bridge.ts";
import type { ConversationSummaryRow } from "@freeanima/habitat/core/db/pg/conversation/types";
import { coerceString } from "@freeanima/shared/coerce-string";

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
  } else {
    toolsetNames = await loadConversationToolsWithRouting(conversationId);
  }
  if (toolsetNames.length > 0) {
    const resolved = resolveToolSetNames(tools, toolsetNames);
    const metaForMask =
      cachedMeta != null && isConversationMeta(cachedMeta)
        ? cachedMeta
        : await loadConversationMeta(conversationId);
    let names = toolNamesForToolSets(tools, resolved);
    if (isConversationMeta(metaForMask)) {
      names = applyConversationToolPolicyFilter(names, metaForMask);
    }
    return tools.openaiSchemasFromNames(names);
  }
  const fresh = resolveDefaultConversationToolSets(tools);
  if (fresh.length > 0) {
    await updateConversationMetaField(conversationId, {
      cached_toolsets: fresh,
      staged_toolsets: [],
    });
  }
  let effective = toolNamesForToolSets(tools, fresh);
  const metaForMask =
    cachedMeta != null && isConversationMeta(cachedMeta)
      ? cachedMeta
      : await loadConversationMeta(conversationId);
  if (isConversationMeta(metaForMask)) {
    effective = applyConversationToolPolicyFilter(effective, metaForMask);
  }
  return tools.openaiSchemasFromNames(effective);
}

export async function loadConversationMeta(
  conversationId: string,
): Promise<ConversationMetaLoadResult> {
  return loadMetaWithRouting(conversationId);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function generateConversationId(): string {
  const d = new Date(Date.now() + CST_OFFSET_MS);
  const ts = `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}_${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}`;
  return `${ts}_${randomBytes(2).toString("hex")}`;
}

export async function countConversationsByPlatform(): Promise<Record<string, number>> {
  return pgCountConversationsByPlatform();
}

export async function listConversationSummaries(
  platform?: string | null,
  opts?: { includeArchived?: boolean },
): Promise<ConversationSummaryRow[]> {
  return pgListConversationSummaries(platform, opts);
}

export async function listConversationSummariesPage(opts?: {
  platform?: string | null;
  offset?: number;
  limit?: number;
  includeArchived?: boolean;
  user_subject_id?: string;
}): Promise<{
  items: ConversationSummaryRow[];
  total: number;
}> {
  return pgListConversationSummariesPage(opts);
}

export async function listConversations(
  platform?: string | null,
  opts?: { includeArchived?: boolean },
): Promise<string[]> {
  return listConversationsWithRouting(platform, opts);
}

/** Whether conversation exists (PostgreSQL) */
export async function conversationExists(conversationId: string): Promise<boolean> {
  return conversationExistsWithRouting(conversationId);
}

export async function load(conversationId: string): Promise<Message[]> {
  return loadMessagesWithRouting(conversationId);
}

export async function loadMessagePage(
  conversationId: string,
  offset: number,
  limit: number,
): Promise<Message[]> {
  return loadMessagesPageWithRouting(conversationId, offset, limit);
}

export async function loadMessagesBeforePos(
  conversationId: string,
  beforePos: number,
  limit: number,
): Promise<Message[]> {
  return loadMessagesBeforePosWithRouting(conversationId, beforePos, limit);
}

export async function countMessages(conversationId: string): Promise<number> {
  return countMessagesWithRouting(conversationId);
}

export async function countUserMessages(conversationId: string): Promise<number> {
  return countUserMessagesWithRouting(conversationId);
}

export async function loadForRuntime(
  conversationId: string,
  meta?: ConversationMetaLoadResult,
): Promise<Message[]> {
  const m = meta ?? (await loadConversationMeta(conversationId));
  return loadMessagesForRuntimeWithRouting(conversationId, m);
}

export async function appendMessage(msg: StoredMessage, conversationId: string): Promise<void> {
  const { content_media: _dropMedia, ...rest } = msg as StoredMessage & {
    content_media?: unknown;
  };
  const out: StoredMessage & { timestamp?: string; id?: number } = omitUndefined({
    ...rest,
  });
  if (!out.timestamp) out.timestamp = formatCstIso();
  if (out.pos === undefined) {
    out.pos = await nextMessagePosWithRouting(conversationId);
  }
  await pgWriteMessage(conversationId, out);
}

export async function appendConversationMeta(
  conversationId: string,
  tools: string[],
  model: string,
  opts?: { platform?: string; functions?: string[] },
): Promise<void> {
  const meta: ConversationMetaMessage = {
    model,
    cached_toolsets: tools,
    staged_toolsets: [],
    functions: opts?.functions ?? [],
    timestamp: formatCstIso(),
  };
  if (opts?.platform) meta.platform = opts.platform;
  await pgWriteMeta(conversationId, meta);
}

export async function initConversation(
  tools: ToolSetRegistry,
  sid: string,
  model: string,
  opts: {
    platform: string;
    functions?: string[];
    platform_extra?: Record<string, unknown>;
    scenario?: "digital_human" | "coding_agent";
  },
): Promise<void> {
  const cwd = allocateConversationCwd(sid);
  const platform_extra = opts.platform_extra ? { ...opts.platform_extra } : undefined;
  if (platform_extra) delete platform_extra.capability_mask; // legacy drop

  const metaDraft: ConversationMetaMessage = {
    model,
    cached_toolsets: resolveDefaultConversationToolSets(tools),
    staged_toolsets: [],
    functions: opts.functions ?? [],
    timestamp: formatCstIso(),
    platform: opts.platform,
    cwd,
    ...(opts.scenario ? { scenario: opts.scenario } : {}),
    platform_extra:
      platform_extra && Object.keys(platform_extra).length > 0 ? platform_extra : undefined,
  };
  const systemPrompt = await buildSystemPrompt(opts.functions ?? [], cwd, {
    ...metaDraft,
    conversation_id: sid,
  });
  const meta: ConversationMetaMessage = {
    ...metaDraft,
    system_prompt: systemPrompt,
    system_prompt_built_at: new Date().toISOString(),
  };
  await pgWriteMeta(sid, meta);
}

export async function newConversation(
  tools: ToolSetRegistry,
  platform: string,
  model?: string,
  platformExtra?: Record<string, unknown>,
  scenario?: "digital_human" | "coding_agent",
): Promise<string> {
  const cfg = getActiveRuntimeConfig().data;
  const sid = generateConversationId();
  await initConversation(
    tools,
    sid,
    model ?? getProfileHopModel(cfg, PROFILE_CHAT),
    omitUndefined({
      platform,
      platform_extra: platformExtra,
      scenario,
    }),
  );
  return sid;
}

function originExtraMatches(
  stored: Record<string, unknown>,
  platformExtra: Record<string, unknown>,
): boolean {
  const identity = stripOriginRoutingMeta(platformExtra);
  for (const [key, val] of Object.entries(identity)) {
    if (coerceString(stored[key] ?? "") !== coerceString(val ?? "")) {
      return false;
    }
  }
  return true;
}

async function resolveFoundOriginConversation(conversationId: string): Promise<string | null> {
  const meta = await loadConversationMeta(conversationId);
  if (!isConversationMeta(meta)) return null;
  if (meta.platform_extra?.origin_active === false) return null;
  if (meta.platform_extra?.origin_active !== true) {
    await activateConversationOrigin(conversationId);
  }
  return conversationId;
}

/** Mark conversation as the sole active origin; siblings with same identity become inactive. */
export async function activateConversationOrigin(conversationId: string): Promise<void> {
  const meta = await loadConversationMeta(conversationId);
  if (!isConversationMeta(meta)) return;
  const platform = meta.platform ?? "";
  if (!platform) return;
  const identityExtra = stripOriginRoutingMeta(meta.platform_extra ?? {});

  let siblingIds: string[] = [];
  if (Object.keys(identityExtra).length > 0) {
    siblingIds = await pgListConversationIdsMatchingPlatformProbe(platform, identityExtra);
  }
  for (const sid of await listConversationsWithRouting(platform)) {
    if (siblingIds.includes(sid)) continue;
    try {
      const siblingMeta = await loadConversationMeta(sid);
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
    const siblingMeta = await loadConversationMeta(sid);
    if (!isConversationMeta(siblingMeta)) continue;
    const active = sid === conversationId;
    const nextExtra = { ...siblingMeta.platform_extra, origin_active: active };
    await updateConversationMetaField(sid, { platform_extra: nextExtra });
  }
}

/** Match existing conversation by platform + platform_extra (each extra item must match meta) */
export async function findConversationByOrigin(
  platform: string,
  platformExtra: Record<string, unknown> = {},
): Promise<string | null> {
  if (Object.keys(platformExtra).length > 0) {
    try {
      const sid = await pgFindConversationIdByPlatformInfo(platform, platformExtra);
      if (sid) return resolveFoundOriginConversation(sid);
    } catch {
      /* fallback scan */
    }
  }

  try {
    let bestInactive: string | null = null;
    for (const sid of await listConversationsWithRouting(platform)) {
      try {
        const meta = await loadConversationMeta(sid);
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
    if (bestInactive) return resolveFoundOriginConversation(bestInactive);
  } catch {
    /* empty */
  }
  return null;
}

export async function updateConversationMetaField(
  conversationId: string,
  patch: Partial<ConversationMetaMessage> & Record<string, unknown>,
): Promise<void> {
  const parsed = await loadConversationMeta(conversationId);
  if (!isConversationMeta(parsed)) return;
  await pgWritePatchMeta(conversationId, patch);
}

export async function patchConversationOrigin(
  conversationId: string,
  platform: string,
  platformExtra?: Record<string, unknown>,
): Promise<void> {
  const parsed = await loadConversationMeta(conversationId);
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
  await pgWriteMeta(conversationId, meta);
}

export async function rebuildConversationSystemPrompt(conversationId: string): Promise<void> {
  const meta = await loadConversationMeta(conversationId);
  if (!isConversationMeta(meta)) return;
  const functions = meta.functions ?? [];
  const cwd = meta.cwd;
  const systemPrompt = await buildSystemPrompt(functions, cwd, {
    ...meta,
    conversation_id: conversationId,
  });
  await updateConversationMetaField(conversationId, {
    system_prompt: systemPrompt,
    system_prompt_built_at: new Date().toISOString(),
  });
}

/** Promote staged ToolSets to cached and rebuild system_prompt */
export async function rebuildConversationCache(
  registry: ToolSetRegistry,
  conversationId: string,
): Promise<{
  cachedCount: number;
  promoted: string[];
  systemPromptLength: number;
}> {
  const meta = await loadConversationMeta(conversationId);
  if (!isConversationMeta(meta)) {
    throw new Error("conversation does not exist");
  }
  let cached = resolveToolSetNames(registry, meta.cached_toolsets ?? []);
  if (cached.length === 0) {
    cached = resolveDefaultConversationToolSetsForMeta(registry, meta);
  }
  const staged = [...(meta.staged_toolsets ?? [])];
  cached = mergeToolSetNames(cached, staged);
  await updateConversationMetaField(conversationId, {
    cached_toolsets: cached,
    staged_toolsets: [],
    timestamp: formatCstIso(),
  });
  await rebuildConversationSystemPrompt(conversationId);
  const after = await loadConversationMeta(conversationId);
  const systemPromptLength = isConversationMeta(after) ? (after.system_prompt ?? "").length : 0;
  return {
    cachedCount: cached.length,
    promoted: staged,
    systemPromptLength,
  };
}

/** 空 prompt 或越过 CST 02:00 日界则全量重建；返回是否发生了重建 */
export async function ensureSystemPromptFresh(conversationId: string): Promise<boolean> {
  const meta = await loadConversationMeta(conversationId);
  if (!isConversationMeta(meta)) return false;
  const cached = (meta.system_prompt ?? "").trim();
  if (!cached || isSystemPromptStale(meta.system_prompt_built_at)) {
    await rebuildConversationSystemPrompt(conversationId);
    return true;
  }
  return false;
}

/** Conditionally refresh system_prompt when resuming conversation */
export async function refreshSystemPromptOnResume(conversationId: string): Promise<boolean> {
  return ensureSystemPromptFresh(conversationId);
}

export async function assertConversationPlatform(
  conversationId: string,
  expected: string,
): Promise<void> {
  const meta = await loadConversationMeta(conversationId);
  const p = isConversationMeta(meta) ? meta.platform : undefined;
  if (p && p !== expected) {
    throw new Error(`Conversation platform mismatch: expected ${expected}, got ${p}`);
  }
}

export async function appendUserTurn(
  conversationId: string,
  userText: string,
  opts?: {
    client_op_id?: string;
    attachments?: Array<{ filename: string; mime_type: string; size: number }>;
  },
): Promise<string> {
  const content = userText;
  if (opts?.client_op_id) {
    const existing = await findUserMessageByClientOpIdWithRouting(
      conversationId,
      opts.client_op_id,
    );
    if (existing?.role === "user" && typeof existing.content === "string") {
      return existing.content;
    }
  }
  await appendMessage(
    omitUndefined({
      role: "user",
      content,
      client_op_id: opts?.client_op_id,
      attachments: opts?.attachments?.length ? opts.attachments : undefined,
    }) as StoredMessage,
    conversationId,
  );
  return content;
}

export async function getMaxMessagePos(conversationId: string): Promise<number> {
  return getMaxMessagePosWithRouting(conversationId);
}

export async function findUserMessageByClientOpId(conversationId: string, client_op_id: string) {
  return findUserMessageByClientOpIdWithRouting(conversationId, client_op_id);
}

export async function getLastMessageRole(conversationId: string): Promise<string | null> {
  return getLastMessageRoleWithRouting(conversationId);
}

export async function updateConversationMeta(
  registry: ToolSetRegistry,
  conversationId: string,
  model: string,
  opts?: { functions?: string[]; cached_toolsets?: string[] },
): Promise<void> {
  const parsed = await loadConversationMeta(conversationId);
  if (!isConversationMeta(parsed)) return;
  const meta: ConversationMetaMessage = parsed;
  meta.model = model;
  meta.timestamp = formatCstIso();
  if (opts?.functions) meta.functions = opts.functions;
  if (opts?.cached_toolsets !== undefined) {
    meta.cached_toolsets = opts.cached_toolsets;
  } else if (meta.cached_toolsets.length === 0) {
    meta.cached_toolsets = resolveDefaultConversationToolSets(registry);
    meta.staged_toolsets = meta.staged_toolsets ?? [];
  }
  await pgWriteMeta(conversationId, meta);
}

export async function setConversationTitle(conversationId: string, title: string): Promise<void> {
  await updateConversationMetaField(conversationId, { title });
}

export async function archiveConversation(conversationId: string): Promise<void> {
  await pgArchiveConversation(conversationId);
}

export async function unarchiveConversation(conversationId: string): Promise<void> {
  await pgUnarchiveConversation(conversationId);
}

export async function deleteUserConversation(conversationId: string): Promise<void> {
  await pgWriteDeleteConversation(conversationId);
}

export async function getConversationTitle(conversationId: string): Promise<string> {
  const meta = await loadConversationMeta(conversationId);
  return isConversationMeta(meta) && typeof meta.title === "string" ? meta.title : "";
}

export async function getConversationCwd(conversationId: string): Promise<string | null> {
  const meta = await loadConversationMeta(conversationId);
  const cwd = isConversationMeta(meta) ? meta.cwd : undefined;
  return typeof cwd === "string" && cwd ? cwd : null;
}

function expandUserPath(cwd: string): string {
  if (cwd.startsWith("~/")) return join(homedir(), cwd.slice(2));
  if (cwd === "~") return homedir();
  return cwd;
}

export async function setConversationCwd(conversationId: string, cwd: string): Promise<string> {
  const expanded = expandUserPath(cwd.trim());
  const resolved = resolve(expanded);
  if (!existsSync(resolved)) {
    throw new Error(`Path does not exist: ${cwd}`);
  }
  await updateConversationMetaField(conversationId, { cwd: resolved });
  await rebuildConversationSystemPrompt(conversationId);
  return resolved;
}

/** Delete assistant/tool messages after last user turn; return that user body */
export async function rollbackToLastUser(conversationId: string): Promise<string> {
  const parsed = await load(conversationId);
  if (parsed.length === 0) throw new Error("No partner message to retry");

  let lastUserIdx = -1;
  for (let i = parsed.length - 1; i >= 0; i--) {
    if (parsed[i]?.role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx < 0) throw new Error("No partner message to retry");

  const kept = parsed.slice(0, lastUserIdx + 1);
  const lastUser = kept[lastUserIdx];
  if (!lastUser) throw new Error("No partner message to retry");
  const keepThroughPos = lastUser.pos;
  if (keepThroughPos === undefined) {
    throw new Error("No partner message to retry");
  }
  await pgWriteTruncate(conversationId, keepThroughPos);

  return lastUser.role === "user" ? lastUser.content : "";
}

/** Delete last user message and everything after it (re-edit resend). */
export async function rollbackBeforeLastUser(conversationId: string): Promise<void> {
  const parsed = await load(conversationId);
  if (parsed.length === 0) throw new Error("No user message to edit");

  let lastUserIdx = -1;
  for (let i = parsed.length - 1; i >= 0; i--) {
    if (parsed[i]?.role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx < 0) throw new Error("No user message to edit");

  if (lastUserIdx === 0) {
    await pgWriteTruncate(conversationId, 0);
    return;
  }

  const beforeLastUser = parsed[lastUserIdx - 1];
  if (!beforeLastUser) throw new Error("No user message to edit");
  const keepThroughPos = beforeLastUser.pos;
  if (keepThroughPos === undefined) {
    throw new Error("No user message to edit");
  }
  await pgWriteTruncate(conversationId, keepThroughPos);
}

/** Default minimum age before a stale conversation may be deleted by sleep-cycle cleanup */
export const STALE_SESSION_MIN_AGE_MS = 24 * 60 * 60 * 1000;

export type CleanupStaleConversationsResult = {
  deleted: number;
  ids: string[];
};

export async function cleanupStaleConversations(opts?: {
  olderThan?: Date;
  minAgeMs?: number;
}): Promise<CleanupStaleConversationsResult> {
  const minAgeMs = opts?.minAgeMs ?? STALE_SESSION_MIN_AGE_MS;
  const olderThan = opts?.olderThan ?? new Date(Date.now() - minAgeMs);
  return await deleteStaleConversations({ olderThan });
}

export async function cleanupDebugConversations(_maxAgeHours = 1): Promise<number> {
  try {
    return await pgDeleteDebugConversations();
  } catch {
    let removed = 0;
    for (const sid of await pgListDebugConversationIds()) {
      try {
        await pgWriteDeleteConversation(sid);
        removed++;
      } catch {
        /* skip */
      }
    }
    return removed;
  }
}
