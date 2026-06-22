import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import {
  mergeToolSetNames,
  resolveDefaultSessionToolSets,
  resolveDefaultSessionToolSetsForMeta,
  resolveToolSetNames,
  toolNamesForToolSets,
} from "@freeanima/core/tool";
import { getActiveConfig, getProfileHopModel } from "@freeanima/core/config";
import { CST_OFFSET_MS, formatCstIso } from "@freeanima/core/util";
import { PROFILE_CHAT } from "@freeanima/core/provider";
import { buildSystemPrompt } from "@freeanima/core/hooks/prompt";
import { capabilityMaskSchema, stripOriginRoutingMeta } from "@freeanima/core/db/schema";
import { applySessionToolMaskFilter } from "./mask-port.ts";
import {
  isSessionMeta,
  type SessionMessage,
  type SessionMetaMessage,
  type SessionMetaLoadResult,
  type OpenAiToolSchema,
} from "./message.ts";
import {
  loadMetaWithRouting,
  loadMessagesForRuntimeWithRouting,
  loadMessagesPageWithRouting,
  loadMessagesWithRouting,
  loadSessionToolsWithRouting,
  countMessagesWithRouting,
  countUserMessagesWithRouting,
  listSessionsWithRouting,
  pgCountSessionsByPlatform,
  pgDeleteDebugSessions,
  pgListDebugSessionIds,
  pgListSessionSummaries,
  pgLastMessageTimestamp,
  pgFindSessionIdByPlatformInfo,
  pgListSessionIdsMatchingPlatformProbe,
  pgWriteDeleteSession,
  pgWriteMessage,
  pgWriteMeta,
  pgWritePatchMeta,
  pgWriteTruncate,
  postgresAvailable,
  sessionExistsWithRouting,
  nextMessagePosWithRouting,
} from "./session-store-pg-bridge.ts";
import type { PgRepositories } from "@freeanima/core/repos";

export type Message = SessionMessage;

/** Default working directory for new session (matches Python init_session; isolated from service start dir) */
export function allocateSessionCwd(sid: string): string {
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
export async function loadSessionTools(
  repos: PgRepositories,
  tools: ToolSetRegistry,
  session: string,
  cachedMeta?: SessionMetaLoadResult,
): Promise<OpenAiToolSchema[]> {
  let toolsetNames: string[] = [];
  if (cachedMeta != null && isSessionMeta(cachedMeta) && cachedMeta.cached_toolsets.length > 0) {
    toolsetNames = cachedMeta.cached_toolsets;
  } else if (postgresAvailable(repos)) {
    toolsetNames = await loadSessionToolsWithRouting(repos, session);
  } else {
    const meta = cachedMeta ?? (await loadSessionMeta(repos, session));
    if (isSessionMeta(meta) && meta.cached_toolsets.length > 0) {
      toolsetNames = meta.cached_toolsets;
    }
  }
  if (toolsetNames.length > 0) {
    const resolved = resolveToolSetNames(tools, toolsetNames);
    const metaForMask =
      cachedMeta != null && isSessionMeta(cachedMeta)
        ? cachedMeta
        : await loadSessionMeta(repos, session);
    let names = toolNamesForToolSets(tools, resolved);
    if (isSessionMeta(metaForMask)) {
      names = applySessionToolMaskFilter(names, metaForMask);
    }
    return tools.openaiSchemasFromNames(names);
  }
  const fresh = resolveDefaultSessionToolSets(tools);
  if (fresh.length > 0) {
    await updateSessionMetaField(repos, session, {
      cached_toolsets: fresh,
      staged_toolsets: [],
    });
  }
  let effective = toolNamesForToolSets(tools, fresh);
  const metaForMask =
    cachedMeta != null && isSessionMeta(cachedMeta)
      ? cachedMeta
      : await loadSessionMeta(repos, session);
  if (isSessionMeta(metaForMask)) {
    effective = applySessionToolMaskFilter(effective, metaForMask);
  }
  return tools.openaiSchemasFromNames(effective);
}

export async function loadSessionMeta(
  repos: PgRepositories,
  session: string,
): Promise<SessionMetaLoadResult> {
  return loadMetaWithRouting(repos, session);
}

export function generateSessionId(): string {
  const d = new Date(Date.now() + CST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  const ts = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}_${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
  return `${ts}_${randomBytes(2).toString("hex")}`;
}

export async function countSessionsByPlatform(
  repos: PgRepositories,
): Promise<Record<string, number>> {
  if (postgresAvailable(repos)) {
    return pgCountSessionsByPlatform(repos);
  }
  const byPlatform: Record<string, number> = {};
  for (const sid of await listSessions(repos)) {
    const meta = await loadSessionMeta(repos, sid);
    const raw = isSessionMeta(meta) ? meta.platform : undefined;
    const platform = typeof raw === "string" && raw.trim() ? raw.trim() : "unknown";
    byPlatform[platform] = (byPlatform[platform] ?? 0) + 1;
  }
  return byPlatform;
}

export async function listSessionSummaries(
  repos: PgRepositories,
  platform?: string | null,
): Promise<
  Array<{
    id: string;
    title: string;
    created: string;
    platform: string;
  }>
> {
  if (postgresAvailable(repos)) {
    return pgListSessionSummaries(repos, platform);
  }
  const ids = await listSessions(repos, platform);
  const out: Array<{ id: string; title: string; created: string; platform: string }> = [];
  for (const sid of ids) {
    const meta = await loadSessionMeta(repos, sid);
    out.push({
      id: sid,
      title: isSessionMeta(meta) ? (meta.title ?? "") : "",
      created: isSessionMeta(meta) ? meta.timestamp : "",
      platform: isSessionMeta(meta) ? (meta.platform ?? "") : "",
    });
  }
  return out;
}

export async function listSessions(
  repos: PgRepositories,
  platform?: string | null,
): Promise<string[]> {
  return listSessionsWithRouting(repos, platform);
}

/** Whether session exists (PostgreSQL) */
export async function sessionExists(repos: PgRepositories, session: string): Promise<boolean> {
  return sessionExistsWithRouting(repos, session);
}

export async function load(repos: PgRepositories, session: string): Promise<Message[]> {
  return loadMessagesWithRouting(repos, session);
}

export async function loadMessagePage(
  repos: PgRepositories,
  session: string,
  offset: number,
  limit: number,
): Promise<Message[]> {
  return loadMessagesPageWithRouting(repos, session, offset, limit);
}

export async function countMessages(repos: PgRepositories, session: string): Promise<number> {
  return countMessagesWithRouting(repos, session);
}

export async function countUserMessages(repos: PgRepositories, session: string): Promise<number> {
  return countUserMessagesWithRouting(repos, session);
}

export async function loadForRuntime(
  repos: PgRepositories,
  session: string,
  meta?: SessionMetaLoadResult,
): Promise<Message[]> {
  const m = meta ?? (await loadSessionMeta(repos, session));
  return loadMessagesForRuntimeWithRouting(repos, session, m);
}

export async function appendMessage(
  repos: PgRepositories,
  msg: SessionMessage,
  session: string,
): Promise<void> {
  const out: SessionMessage & { timestamp?: string; id?: number } = { ...msg };
  if (!out.timestamp) out.timestamp = formatCstIso();
  if (out.pos === undefined && out.role !== "session_meta") {
    out.pos = await nextMessagePosWithRouting(repos, session);
  }
  if (out.role !== "session_meta") {
    await pgWriteMessage(repos, session, out);
  }
}

export async function appendSessionMeta(
  repos: PgRepositories,
  session: string,
  tools: string[],
  model: string,
  opts?: { platform?: string; functions?: string[] },
): Promise<void> {
  const meta: SessionMetaMessage = {
    role: "session_meta",
    model,
    cached_toolsets: tools,
    staged_toolsets: [],
    functions: opts?.functions ?? [],
    timestamp: formatCstIso(),
  };
  if (opts?.platform) meta.platform = opts.platform;
  await pgWriteMeta(repos, session, meta);
}

export async function initSession(
  repos: PgRepositories,
  tools: ToolSetRegistry,
  sid: string,
  model: string,
  opts: { platform: string; functions?: string[]; platform_extra?: Record<string, unknown> },
): Promise<void> {
  const cwd = allocateSessionCwd(sid);
  const capabilityMaskRaw = opts.platform_extra?.capability_mask;
  const capability_mask =
    capabilityMaskRaw !== undefined ? capabilityMaskSchema.parse(capabilityMaskRaw) : undefined;
  const platform_extra = opts.platform_extra ? { ...opts.platform_extra } : undefined;
  if (platform_extra) delete platform_extra.capability_mask;

  const metaDraft: SessionMetaMessage = {
    role: "session_meta",
    model,
    cached_toolsets: resolveDefaultSessionToolSets(tools),
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
  const meta: SessionMetaMessage = { ...metaDraft, system_prompt: systemPrompt };
  await pgWriteMeta(repos, sid, meta);
}

export async function newSession(
  repos: PgRepositories,
  tools: ToolSetRegistry,
  platform: string,
  model?: string,
  platformExtra?: Record<string, unknown>,
): Promise<string> {
  const cfg = getActiveConfig().data;
  const sid = generateSessionId();
  await initSession(repos, tools, sid, model ?? getProfileHopModel(cfg, PROFILE_CHAT), {
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

async function resolveFoundOriginSession(
  repos: PgRepositories,
  sessionId: string,
): Promise<string | null> {
  const meta = await loadSessionMeta(repos, sessionId);
  if (!isSessionMeta(meta)) return null;
  if (meta.platform_extra?.origin_active === false) return null;
  if (meta.platform_extra?.origin_active !== true) {
    await activateSessionOrigin(repos, sessionId);
  }
  return sessionId;
}

/** Mark session as the sole active origin; siblings with same identity become inactive. */
export async function activateSessionOrigin(
  repos: PgRepositories,
  sessionId: string,
): Promise<void> {
  const meta = await loadSessionMeta(repos, sessionId);
  if (!isSessionMeta(meta)) return;
  const platform = meta.platform ?? "";
  if (!platform) return;
  const identityExtra = stripOriginRoutingMeta(meta.platform_extra ?? {});

  let siblingIds: string[] = [];
  if (postgresAvailable(repos) && Object.keys(identityExtra).length > 0) {
    siblingIds = await pgListSessionIdsMatchingPlatformProbe(repos, platform, identityExtra);
  } else {
    for (const sid of await listSessionsWithRouting(repos, platform)) {
      try {
        const siblingMeta = await loadSessionMeta(repos, sid);
        if (!isSessionMeta(siblingMeta)) continue;
        if (!originExtraMatches(siblingMeta.platform_extra ?? {}, identityExtra)) continue;
        siblingIds.push(sid);
      } catch {
        continue;
      }
    }
  }

  if (!siblingIds.includes(sessionId)) siblingIds.push(sessionId);

  for (const sid of siblingIds) {
    const siblingMeta = await loadSessionMeta(repos, sid);
    if (!isSessionMeta(siblingMeta)) continue;
    const active = sid === sessionId;
    const nextExtra = { ...siblingMeta.platform_extra, origin_active: active };
    await updateSessionMetaField(repos, sid, { platform_extra: nextExtra });
  }
}

/** Match existing session by platform + platform_extra (each extra item must match meta) */
export async function findSessionByOrigin(
  repos: PgRepositories,
  platform: string,
  platformExtra: Record<string, unknown> = {},
): Promise<string | null> {
  if (postgresAvailable(repos) && Object.keys(platformExtra).length > 0) {
    try {
      const sid = await pgFindSessionIdByPlatformInfo(repos, platform, platformExtra);
      if (sid) return resolveFoundOriginSession(repos, sid);
    } catch {
      /* fallback scan */
    }
  }

  try {
    let bestInactive: string | null = null;
    for (const sid of await listSessionsWithRouting(repos, platform)) {
      try {
        const meta = await loadSessionMeta(repos, sid);
        if (!isSessionMeta(meta)) continue;
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
    if (bestInactive) return resolveFoundOriginSession(repos, bestInactive);
  } catch {
    /* empty */
  }
  return null;
}

export async function updateSessionMetaField(
  repos: PgRepositories,
  session: string,
  patch: Partial<SessionMetaMessage> & Record<string, unknown>,
): Promise<void> {
  const parsed = await loadSessionMeta(repos, session);
  if (!isSessionMeta(parsed)) return;
  await pgWritePatchMeta(repos, session, patch);
}

export async function patchSessionOrigin(
  repos: PgRepositories,
  session: string,
  platform: string,
  platformExtra?: Record<string, unknown>,
): Promise<void> {
  const parsed = await loadSessionMeta(repos, session);
  if (!isSessionMeta(parsed)) return;
  const meta: SessionMetaMessage = parsed;
  const existing = meta.platform ?? "";
  if (existing && existing !== platform) {
    throw new Error(
      `session ${session.slice(0, 16)}... platform cannot be changed: ${existing} -> ${platform}`,
    );
  }
  if (!existing) meta.platform = platform;
  if (platformExtra !== undefined) meta.platform_extra = platformExtra;
  await pgWriteMeta(repos, session, meta);
}

export async function rebuildSessionSystemPrompt(
  repos: PgRepositories,
  session: string,
): Promise<void> {
  const meta = await loadSessionMeta(repos, session);
  if (!isSessionMeta(meta)) return;
  const functions = meta.functions ?? [];
  const cwd = meta.cwd;
  const systemPrompt = await buildSystemPrompt(functions, cwd, meta);
  await updateSessionMetaField(repos, session, { system_prompt: systemPrompt });
}

/** Promote staged ToolSets to cached and rebuild system_prompt */
export async function rebuildSessionCache(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  session: string,
): Promise<{
  cachedCount: number;
  promoted: string[];
  systemPromptLength: number;
}> {
  const meta = await loadSessionMeta(repos, session);
  if (!isSessionMeta(meta)) {
    throw new Error("session does not exist");
  }
  let cached = resolveToolSetNames(registry, meta.cached_toolsets ?? []);
  if (cached.length === 0) {
    cached = resolveDefaultSessionToolSetsForMeta(registry, meta);
  }
  const staged = [...(meta.staged_toolsets ?? [])];
  cached = mergeToolSetNames(cached, staged);
  await updateSessionMetaField(repos, session, {
    cached_toolsets: cached,
    staged_toolsets: [],
    timestamp: formatCstIso(),
  });
  await rebuildSessionSystemPrompt(repos, session);
  const after = await loadSessionMeta(repos, session);
  const systemPromptLength = isSessionMeta(after) ? (after.system_prompt ?? "").length : 0;
  return {
    cachedCount: cached.length,
    promoted: staged,
    systemPromptLength,
  };
}

const RESUME_STALE_MS = 7 * 24 * 60 * 60 * 1000;

async function sessionLastActivityMs(
  repos: PgRepositories,
  session: string,
): Promise<number | null> {
  const meta = await loadSessionMeta(repos, session);
  const metaTs = isSessionMeta(meta) ? meta.timestamp : undefined;
  let last: number | null = metaTs ? Date.parse(metaTs) : null;
  const ts = await pgLastMessageTimestamp(repos, session);
  if (ts) {
    const t = Date.parse(ts);
    if (!Number.isNaN(t) && (last === null || t > last)) last = t;
  }
  return last;
}

/** Conditionally refresh system_prompt when resuming session */
export async function refreshSystemPromptOnResume(
  repos: PgRepositories,
  session: string,
): Promise<boolean> {
  const meta = await loadSessionMeta(repos, session);
  if (!isSessionMeta(meta)) return false;
  const cached = (meta.system_prompt ?? "").trim();
  if (!cached) {
    await rebuildSessionSystemPrompt(repos, session);
    return true;
  }
  const last = await sessionLastActivityMs(repos, session);
  if (last === null) return false;
  if (Date.now() - last > RESUME_STALE_MS) {
    await rebuildSessionSystemPrompt(repos, session);
    return true;
  }
  return false;
}

export async function assertSessionPlatform(
  repos: PgRepositories,
  session: string,
  expected: string,
): Promise<void> {
  const meta = await loadSessionMeta(repos, session);
  const p = isSessionMeta(meta) ? meta.platform : undefined;
  if (p && p !== expected) {
    throw new Error(`Session platform mismatch: expected ${expected}, got ${p}`);
  }
}

export async function appendUserTurn(
  repos: PgRepositories,
  session: string,
  userText: string,
): Promise<string> {
  const content = userText;
  await appendMessage(repos, { role: "user", content }, session);
  return content;
}

export async function updateSessionMeta(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  session: string,
  model: string,
  opts?: { functions?: string[]; cached_toolsets?: string[] },
): Promise<void> {
  const parsed = await loadSessionMeta(repos, session);
  if (!isSessionMeta(parsed)) return;
  const meta: SessionMetaMessage = parsed;
  meta.model = model;
  meta.timestamp = formatCstIso();
  if (opts?.functions) meta.functions = opts.functions;
  if (opts?.cached_toolsets !== undefined) {
    meta.cached_toolsets = opts.cached_toolsets;
  } else if (!meta.cached_toolsets.length) {
    meta.cached_toolsets = resolveDefaultSessionToolSets(registry);
    meta.staged_toolsets = meta.staged_toolsets ?? [];
  }
  await pgWriteMeta(repos, session, meta);
}

export async function setSessionTitle(
  repos: PgRepositories,
  session: string,
  title: string,
): Promise<void> {
  await updateSessionMetaField(repos, session, { title });
}

export async function getSessionTitle(repos: PgRepositories, session: string): Promise<string> {
  const meta = await loadSessionMeta(repos, session);
  return isSessionMeta(meta) && typeof meta.title === "string" ? meta.title : "";
}

export async function getSessionCwd(
  repos: PgRepositories,
  session: string,
): Promise<string | null> {
  const meta = await loadSessionMeta(repos, session);
  const cwd = isSessionMeta(meta) ? meta.cwd : undefined;
  return typeof cwd === "string" && cwd ? cwd : null;
}

function expandUserPath(cwd: string): string {
  if (cwd.startsWith("~/")) return join(homedir(), cwd.slice(2));
  if (cwd === "~") return homedir();
  return cwd;
}

export async function setSessionCwd(
  repos: PgRepositories,
  session: string,
  cwd: string,
): Promise<string> {
  const expanded = expandUserPath(cwd.trim());
  const resolved = resolve(expanded);
  if (!existsSync(resolved)) {
    throw new Error(`Path does not exist: ${cwd}`);
  }
  await updateSessionMetaField(repos, session, { cwd: resolved });
  await rebuildSessionSystemPrompt(repos, session);
  return resolved;
}

/** Delete assistant/tool messages after last user turn; return that user body */
export async function rollbackToLastUser(repos: PgRepositories, session: string): Promise<string> {
  const parsed = await load(repos, session);
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
  await pgWriteTruncate(repos, session, Number(keepThroughPos));

  return lastUser.role === "user" ? lastUser.content : "";
}

/** Default minimum age before a stale session may be deleted by sleep-cycle cleanup */
export const STALE_SESSION_MIN_AGE_MS = 24 * 60 * 60 * 1000;

export type CleanupStaleSessionsResult = {
  deleted: number;
  ids: string[];
};

export async function cleanupStaleSessions(
  repos: PgRepositories,
  opts?: { olderThan?: Date; minAgeMs?: number },
): Promise<CleanupStaleSessionsResult> {
  if (!postgresAvailable(repos)) return { deleted: 0, ids: [] };
  const minAgeMs = opts?.minAgeMs ?? STALE_SESSION_MIN_AGE_MS;
  const olderThan = opts?.olderThan ?? new Date(Date.now() - minAgeMs);
  return await repos.session.deleteStaleSessions({ olderThan });
}

export async function cleanupDebugSessions(
  repos: PgRepositories,
  _maxAgeHours = 1,
): Promise<number> {
  if (!postgresAvailable(repos)) return 0;
  try {
    return await pgDeleteDebugSessions(repos);
  } catch {
    let removed = 0;
    for (const sid of await pgListDebugSessionIds(repos)) {
      try {
        await pgWriteDeleteSession(repos, sid);
        removed++;
      } catch {
        /* skip */
      }
    }
    return removed;
  }
}
