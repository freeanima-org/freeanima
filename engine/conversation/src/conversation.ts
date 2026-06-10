import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { resolveDefaultSessionTools } from "@freeanima/engine-tool";
import { getProfileHopModel, loadConfig } from "@freeanima/service-config";
import { CST_OFFSET_MS, formatCstIso } from "@freeanima/kernel-util";
import { PROFILE_CHAT } from "@freeanima/engine-provider-llm";
import { buildSystemPrompt } from "@freeanima/engine-prompt";
import {
  getCompressionConfig,
  generateSessionSummary,
  clearToolLoopSuppression,
  isInToolLoop,
  analyzeCompression,
  compress,
  isCompressed,
  parseCompressionState,
  buildCompressOptions,
  willAdvanceCompression,
  type CompressionState,
} from "@freeanima/engine-compress";
import { injectTimePrefixes } from "./time-perception.ts";
import { applySessionToolMaskFilter } from "./mask-port.ts";
import { logComponent } from "@freeanima/service-logging";
import {
  detectToolLoopCorruption,
  countFollowingToolMessages,
  syntheticToolContent,
  REPAIR_REASON_LOST,
} from "@freeanima/engine-llm";
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
  loadMessagesByPosRangeWithRouting,
  loadMessagesPageWithRouting,
  loadMessagesWithRouting,
  loadSessionToolsWithRouting,
  countMessagesWithRouting,
  listSessionsWithRouting,
  pgCountSessionsByPlatform,
  pgDeleteDebugSessions,
  pgListDebugSessionIds,
  pgListSessionSummaries,
  pgLastMessageTimestamp,
  pgFindSessionIdByPlatformInfo,
  pgWriteDeleteSession,
  pgWriteMessage,
  pgWriteMeta,
  pgWritePatchMeta,
  pgWriteTruncate,
  pgShiftMessagePositions,
  postgresAvailable,
  sessionExistsWithRouting,
  nextMessagePosWithRouting,
} from "./session-store-pg-bridge.ts";
import type { PgRepositories } from "@freeanima/engine-repos";

export type Message = SessionMessage;
export { isSessionMeta } from "./message.ts";

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

/** Read session-cached tool names and resolve to OpenAI schema; fallback to registry and write meta */
export async function loadSessionTools(
  repos: PgRepositories,
  tools: ToolSetRegistry,
  session: string,
  cachedMeta?: SessionMetaLoadResult,
): Promise<OpenAiToolSchema[]> {
  let names: string[] = [];
  if (cachedMeta != null && isSessionMeta(cachedMeta) && cachedMeta.tools.length > 0) {
    names = cachedMeta.tools;
  } else if (postgresAvailable(repos)) {
    names = await loadSessionToolsWithRouting(repos, session);
  } else {
    const meta = cachedMeta ?? (await loadSessionMeta(repos, session));
    if (isSessionMeta(meta) && meta.tools.length > 0) {
      names = meta.tools;
    }
  }
  if (names.length > 0) {
    const metaForMask =
      cachedMeta != null && isSessionMeta(cachedMeta)
        ? cachedMeta
        : await loadSessionMeta(repos, session);
    if (isSessionMeta(metaForMask)) {
      names = applySessionToolMaskFilter(names, metaForMask);
    }
    return tools.openaiSchemasFromNames(names);
  }
  const fresh = resolveDefaultSessionTools(tools);
  if (fresh.length > 0) {
    await updateSessionMetaField(repos, session, { tools: fresh, loaded_tools: [] });
  }
  let effective = fresh;
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
    tools,
    loaded_tools: [],
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
  const systemPrompt = await buildSystemPrompt(opts.functions ?? [], cwd);
  const meta: SessionMetaMessage = {
    role: "session_meta",
    model,
    tools: resolveDefaultSessionTools(tools),
    loaded_tools: [],
    functions: opts.functions ?? [],
    timestamp: formatCstIso(),
    platform: opts.platform,
    system_prompt: systemPrompt,
    cwd,
  };
  if (opts.platform_extra && Object.keys(opts.platform_extra).length > 0) {
    meta.platform_extra = opts.platform_extra;
  }
  await pgWriteMeta(repos, sid, meta);
}

export async function newSession(
  repos: PgRepositories,
  tools: ToolSetRegistry,
  platform: string,
  model?: string,
  platformExtra?: Record<string, unknown>,
): Promise<string> {
  const cfg = loadConfig();
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
  for (const [key, val] of Object.entries(platformExtra)) {
    if (String(stored[key] ?? "") !== String(val ?? "")) {
      return false;
    }
  }
  return true;
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
      if (sid) return sid;
    } catch {
      /* fallback scan */
    }
  }

  try {
    for (const sid of await listSessionsWithRouting(repos, platform)) {
      try {
        const meta = await loadSessionMeta(repos, sid);
        if (!isSessionMeta(meta)) continue;
        if (Object.keys(platformExtra).length > 0) {
          const stored = meta.platform_extra ?? {};
          if (!originExtraMatches(stored, platformExtra)) continue;
        }
        return sid;
      } catch {
        continue;
      }
    }
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
  const systemPrompt = await buildSystemPrompt(functions, cwd);
  await updateSessionMetaField(repos, session, { system_prompt: systemPrompt });
}

/** Reset session tool schema to default set and clear loaded_tools */
export async function reloadSessionTools(
  repos: PgRepositories,
  tools: ToolSetRegistry,
  session: string,
): Promise<number> {
  const meta = await loadSessionMeta(repos, session);
  if (!isSessionMeta(meta)) {
    throw new Error("session does not exist");
  }
  const names = resolveDefaultSessionTools(tools);
  await updateSessionMetaField(repos, session, {
    tools: names,
    loaded_tools: [],
    timestamp: formatCstIso(),
  });
  return names.length;
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

  const meta = await loadSessionMeta(repos, session);
  if (isSessionMeta(meta) && !meta.title) {
    const short = content.slice(0, 30).trim();
    if (short) {
      await updateSessionMetaField(repos, session, { title: short });
    }
  }

  return content;
}

function compressionEnabled(): boolean {
  return getCompressionConfig().enabled;
}

function defaultChatModel(): string {
  return getProfileHopModel(loadConfig(), PROFILE_CHAT);
}

const pendingCompressionSummaries = new Map<string, Promise<void>>();

/** Await in-flight async session summaries (integration teardown must call before restoring FREEANIMA_HOME) */
export async function flushCompressionSummaries(
  _repos: PgRepositories,
  session?: string,
): Promise<void> {
  if (session !== undefined) {
    const p = pendingCompressionSummaries.get(session);
    if (p) await p;
    return;
  }
  await Promise.all([...pendingCompressionSummaries.values()]);
}

async function finalizeCompressionSummary(
  repos: PgRepositories,
  session: string,
  prevState: CompressionState | null,
  cutState: CompressionState,
  systemPromptSnapshot: string,
  model: string,
  homeAtSchedule: string,
): Promise<void> {
  if ((process.env.FREEANIMA_HOME ?? "") !== homeAtSchedule) {
    logComponent("compression").warn(
      `Skipping session summary (FREEANIMA_HOME changed): ${session}`,
    );
    return;
  }
  const prevL2 = prevState?.l2 ?? null;
  const fromPos = (prevL2 ?? 0) + 1;
  const slice = await loadMessagesByPosRangeWithRouting(repos, session, fromPos, cutState.l2);
  const gen = await generateSessionSummary(
    slice,
    prevState,
    cutState,
    systemPromptSnapshot,
    model,
    { preSliced: true },
  );

  const merged: CompressionState = {
    ...cutState,
    summary_at: formatCstIso(),
  };
  if (gen.ok) {
    merged.summary = gen.summary;
  } else {
    logComponent("compression").error(`Session summary generation failed: ${session}`, {
      err: gen.error,
    });
  }

  await updateSessionMetaField(repos, session, { compression: merged });
  try {
    await rebuildSessionSystemPrompt(repos, session);
  } catch (e) {
    logComponent("compression").error(
      `Failed to rebuild system_prompt after compression: ${session}`,
      {
        err: String(e),
      },
    );
  }
}

function scheduleCompressionSummary(
  repos: PgRepositories,
  session: string,
  prevState: CompressionState | null,
  cutState: CompressionState,
  systemPromptSnapshot: string,
  model: string,
): void {
  const homeAtSchedule = process.env.FREEANIMA_HOME ?? "";
  const prev = pendingCompressionSummaries.get(session);
  const run = async (): Promise<void> => {
    if (prev) await prev;
    await finalizeCompressionSummary(
      repos,
      session,
      prevState,
      cutState,
      systemPromptSnapshot,
      model,
      homeAtSchedule,
    );
  };
  const p = run()
    .catch((e) => {
      logComponent("compression").error(`Session summary pipeline error: ${session}`, {
        err: String(e),
      });
    })
    .finally(() => {
      if (pendingCompressionSummaries.get(session) === p) {
        pendingCompressionSummaries.delete(session);
      }
    });
  pendingCompressionSummaries.set(session, p);
}

/** Maintain meta.compression from full history (no message delete; async summary on cut change) */
export async function advanceCompressionMeta(
  repos: PgRepositories,
  tools: ToolSetRegistry,
  session: string,
  preloaded?: { msgs: Message[]; meta: SessionMetaLoadResult },
): Promise<void> {
  await recompressSession(repos, tools, session, undefined, preloaded);
}

/** Recompute session compression (optional force ignores hysteresis) */
export async function recompressSession(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  session: string,
  opts?: { force?: boolean },
  preloaded?: { msgs: Message[]; meta: SessionMetaLoadResult },
): Promise<Record<string, unknown>> {
  const cfg = getCompressionConfig();
  const msgs = preloaded?.msgs ?? (await load(repos, session));
  const meta = preloaded?.meta ?? (await loadSessionMeta(repos, session));
  const prevState = parseCompressionState(isSessionMeta(meta) ? meta.compression : undefined);
  const state = !opts?.force && prevState ? prevState : opts?.force ? null : prevState;

  if (!cfg.enabled) {
    return {
      ok: true,
      enabled: false,
      updated: false,
      compression: null,
    };
  }

  const toolSchemas = await loadSessionTools(repos, registry, session, meta);
  const compressOpts = buildCompressOptions(meta, state, defaultChatModel(), {
    force: opts?.force,
    forceEmergency: opts?.force,
    tools: toolSchemas,
  });
  const [, newState] = compress(msgs, compressOpts);

  const boundariesChanged =
    newState != null &&
    (prevState == null ||
      Number(newState.l2) !== Number(prevState.l2) ||
      Number(newState.l3) !== Number(prevState.l3));

  const prevJson = JSON.stringify(prevState);
  const newJson = JSON.stringify(newState);
  const updated = newJson !== prevJson;

  if (updated && newState) {
    if (boundariesChanged) {
      const systemSnapshot = isSessionMeta(meta) ? (meta.system_prompt ?? "") : "";
      const model = isSessionMeta(meta)
        ? meta.model
        : getProfileHopModel(loadConfig(), PROFILE_CHAT);
      await updateSessionMetaField(repos, session, { compression: newState });
      scheduleCompressionSummary(repos, session, prevState, newState, systemSnapshot, model);
    } else {
      await updateSessionMetaField(repos, session, { compression: newState });
    }
  }

  const analysis = analyzeCompression(msgs, {
    ...compressOpts,
    state: newState,
  });
  return {
    ok: true,
    updated,
    compression: newState,
    ...analysis,
  };
}

/** Write missing tool responses to PG (insert in-place after assistant; shift later pos) */
export async function repairAndPersistToolLoop(
  repos: PgRepositories,
  session: string,
  msgs: SessionMessage[],
  reason = REPAIR_REASON_LOST,
): Promise<boolean> {
  const corruptions = detectToolLoopCorruption(msgs);
  if (!corruptions.length) return false;

  const ordered = [...corruptions].toSorted(
    (a, b) => (b.assistantPos ?? 0) - (a.assistantPos ?? 0),
  );

  let inserted = 0;
  for (const c of ordered) {
    if (c.assistantPos === undefined) continue;

    const current = await load(repos, session);
    const idx = current.findIndex((m) => m.pos === c.assistantPos);
    if (idx < 0) continue;

    const following = countFollowingToolMessages(current, idx);
    const insertAtPos = c.assistantPos + 1 + following;
    const n = c.missingCalls.length;
    if (n === 0) continue;

    await pgShiftMessagePositions(repos, session, insertAtPos - 1, n);

    for (let i = 0; i < n; i++) {
      const call = c.missingCalls[i]!;
      await pgWriteMessage(repos, session, {
        role: "tool",
        pos: insertAtPos + i,
        tool_call_id: call.id,
        name: call.name,
        content: syntheticToolContent(reason),
        timestamp: formatCstIso(),
      });
      inserted++;
    }
  }

  logComponent("tool-loop-integrity").error(
    `tool loop history repaired: session=${session} inserted in-place ${inserted} synthetic tool message(s)`,
  );
  return true;
}

async function ensureSessionToolIntegrity(
  repos: PgRepositories,
  session: string,
  msgs: SessionMessage[],
): Promise<Message[]> {
  const repaired = await repairAndPersistToolLoop(repos, session, msgs);
  return repaired ? load(repos, session) : msgs;
}

/** Tool-loop single-turn emergency: in-place trim in-memory messages */
export async function maybeApplyEmergencyCompression(
  repos: PgRepositories,
  session: string,
  runtimeMessages: SessionMessage[],
  opts: { model: string; tools: OpenAiToolSchema[] },
): Promise<boolean> {
  if (!compressionEnabled()) return false;
  if (isInToolLoop(runtimeMessages)) return false;
  const meta = await loadSessionMeta(repos, session);
  const state = isSessionMeta(meta) ? parseCompressionState(meta.compression) : null;
  const systemPrompt = isSessionMeta(meta) ? (meta.system_prompt ?? "") : "";
  const cfg = getCompressionConfig();
  const compressOpts = {
    maxRounds: cfg.maxRounds,
    model: opts.model,
    systemPrompt,
    tools: opts.tools,
    state,
    forceEmergency: true,
  };
  const analysis = analyzeCompression(runtimeMessages, compressOpts);
  if (analysis.usage_ratio == null || analysis.usage_ratio < cfg.emergencyRatio) {
    return false;
  }

  const [compressed, newState] = compress(runtimeMessages, compressOpts);
  if (compressed.length >= runtimeMessages.length) return false;

  runtimeMessages.length = 0;
  runtimeMessages.push(...compressed);
  if (newState) {
    const prev = state;
    await updateSessionMetaField(repos, session, { compression: newState });
    const systemSnapshot = systemPrompt;
    scheduleCompressionSummary(repos, session, prev, newState, systemSnapshot, opts.model);
  }
  return true;
}

function buildRuntimeMessagesFrom(
  _session: string,
  meta: SessionMetaLoadResult,
  msgs: Message[],
  tools: OpenAiToolSchema[],
): [SessionMessage[], string[]] {
  const functions = isSessionMeta(meta) ? meta.functions : [];
  let runtimeMsgs = msgs;
  const systemPrompt = isSessionMeta(meta) ? (meta.system_prompt ?? "") : "";

  if (compressionEnabled()) {
    const state = isSessionMeta(meta) ? parseCompressionState(meta.compression) : null;
    const [compressed] = compress(
      runtimeMsgs,
      buildCompressOptions(meta, state, defaultChatModel(), { tools }),
    );
    runtimeMsgs = compressed;
  }

  runtimeMsgs = runtimeMsgs.filter((m) => m.role !== "system");
  runtimeMsgs = injectTimePrefixes(runtimeMsgs);

  if (systemPrompt) runtimeMsgs.unshift({ role: "system", content: systemPrompt });
  return [runtimeMsgs, functions];
}

export async function buildRuntimeMessages(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  session: string,
): Promise<[SessionMessage[], string[]]> {
  const meta = await loadSessionMeta(repos, session);
  const msgs = await loadForRuntime(repos, session, meta);
  const toolSchemas = await loadSessionTools(repos, registry, session, meta);
  return buildRuntimeMessagesFrom(session, meta, msgs, toolSchemas);
}

async function loadMessagesForTurn(
  repos: PgRepositories,
  session: string,
  meta: SessionMetaLoadResult,
  tools: OpenAiToolSchema[],
): Promise<Message[]> {
  if (!compressionEnabled()) {
    return load(repos, session);
  }
  const state = isSessionMeta(meta) ? parseCompressionState(meta.compression) : null;
  if (!isCompressed(state)) {
    return load(repos, session);
  }
  const windowed = await loadForRuntime(repos, session, meta);
  const compressOpts = buildCompressOptions(meta, state, defaultChatModel(), { tools });
  if (willAdvanceCompression(windowed, compressOpts)) {
    return load(repos, session);
  }
  return windowed;
}

async function prepareTurnMessages(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  session: string,
  meta: SessionMetaLoadResult,
): Promise<{ msgs: Message[]; tools: OpenAiToolSchema[] }> {
  const tools = await loadSessionTools(repos, registry, session, meta);
  let msgs = await loadMessagesForTurn(repos, session, meta, tools);
  msgs = await ensureSessionToolIntegrity(repos, session, msgs);
  const total = await countMessages(repos, session);
  if (msgs.length < total) {
    const state = isSessionMeta(meta) ? parseCompressionState(meta.compression) : null;
    const compressOpts = buildCompressOptions(meta, state, defaultChatModel(), { tools });
    if (willAdvanceCompression(msgs, compressOpts)) {
      msgs = await load(repos, session);
      msgs = await ensureSessionToolIntegrity(repos, session, msgs);
    }
  }
  return { msgs, tools };
}

export async function beginTurn(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  session: string,
  userText: string,
): Promise<[SessionMessage[], string[], string]> {
  clearToolLoopSuppression(session);
  const effective = await appendUserTurn(repos, session, userText);
  const meta = await loadSessionMeta(repos, session);
  const { msgs, tools } = await prepareTurnMessages(repos, registry, session, meta);
  await advanceCompressionMeta(repos, registry, session, { meta, msgs });
  const [runtimeMsgs, functions] = buildRuntimeMessagesFrom(session, meta, msgs, tools);
  return [runtimeMsgs, functions, effective];
}

function findTurnUserIndex(messages: SessionMessage[], userText: string): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role === "user" && msg.content === userText) return i;
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return i;
  }
  return -1;
}

export async function finishTurn(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  session: string,
  messages: SessionMessage[],
  userText: string,
  model: string,
  functions?: string[],
  skipMessageAppend = false,
): Promise<void> {
  const idx = findTurnUserIndex(messages, userText);
  if (!skipMessageAppend) {
    for (const msg of messages.slice(idx + 1)) {
      if (msg.role === "system") continue;
      await appendMessage(repos, msg, session);
    }
  }
  await updateSessionMeta(repos, registry, session, model, { functions });
}

export async function updateSessionMeta(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  session: string,
  model: string,
  opts?: { functions?: string[]; tools?: string[] },
): Promise<void> {
  const parsed = await loadSessionMeta(repos, session);
  if (!isSessionMeta(parsed)) return;
  const meta: SessionMetaMessage = parsed;
  meta.model = model;
  meta.timestamp = formatCstIso();
  if (opts?.functions) meta.functions = opts.functions;
  if (opts?.tools !== undefined) {
    meta.tools = opts.tools;
  } else if (!meta.tools.length) {
    meta.tools = resolveDefaultSessionTools(registry);
    meta.loaded_tools = meta.loaded_tools ?? [];
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

/** Retry turn: roll back to last user without appending new user; return runtime messages */
export async function retryTurn(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  session: string,
): Promise<[SessionMessage[], string[], string]> {
  const effective = await rollbackToLastUser(repos, session);
  const meta = await loadSessionMeta(repos, session);
  const { msgs, tools } = await prepareTurnMessages(repos, registry, session, meta);
  await advanceCompressionMeta(repos, registry, session, { meta, msgs });
  const [runtimeMsgs, functions] = buildRuntimeMessagesFrom(session, meta, msgs, tools);
  return [runtimeMsgs, functions, effective];
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
