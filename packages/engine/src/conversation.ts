import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { PATHS, CST_OFFSET_MS } from "@freeanima/legacy-kernel";
import { getProfileHopModel, loadConfig } from "@freeanima/legacy-kernel";
import { PROFILE_CHAT } from "@freeanima/engine-provider-llm";
import { buildSystemPrompt } from "./system-prompt-registry";
import { openaiSchemas } from "@freeanima/legacy-kernel";
import { getCompressionConfig } from "./compression-config";
import { generateSessionSummary } from "./compression-summary";
import { clearToolLoopSuppression, isInToolLoop } from "./compression-tool-loop";
import {
  analyzeCompression,
  compress,
  parseCompressionState,
  type CompressionState,
} from "./compressor";
import { injectTimePrefixes } from "./time-perception";
import { logComponent } from "@freeanima/legacy-kernel";
import {
  detectToolLoopCorruption,
  countFollowingToolMessages,
  syntheticToolContent,
  REPAIR_REASON_LOST,
} from "./tool-loop-integrity";
import {
  isSessionMeta,
  type SessionMessage,
  type SessionMetaMessage,
  type SessionMetaLoadResult,
  type OpenAiToolSchema,
} from "@freeanima/legacy-kernel";
import {
  loadMetaWithRouting,
  loadMessagesForRuntimeWithRouting,
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
} from "./session-store-pg-bridge";

export type Message = SessionMessage;
export { isSessionMeta, parseSessionLine } from "@freeanima/legacy-kernel";

function nowIso(): string {
  return new Date(Date.now() + CST_OFFSET_MS).toISOString().replace("Z", "+08:00");
}

/** 新 session 默认工作目录（与 Python `init_session` 一致，隔离于 service 启动目录） */
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

export function loadSoul(): string {
  try {
    if (!existsSync(PATHS.soul)) return "";
    return readFileSync(PATHS.soul, "utf-8").trim();
  } catch {
    return "";
  }
}

/** 读取 session 缓存的 OpenAI tools；缺失时回退注册表并写回 meta */
export async function loadSessionTools(
  session: string,
  cachedMeta?: SessionMetaLoadResult,
): Promise<OpenAiToolSchema[]> {
  if (cachedMeta != null && isSessionMeta(cachedMeta) && cachedMeta.tools.length > 0) {
    return cachedMeta.tools;
  }
  if (postgresAvailable()) {
    const cached = await loadSessionToolsWithRouting(session);
    if (cached.length > 0) {
      return cached;
    }
  } else {
    const meta = cachedMeta ?? (await loadSessionMeta(session));
    if (isSessionMeta(meta) && meta.tools.length > 0) {
      return meta.tools;
    }
  }
  const fresh = openaiSchemas();
  if (fresh.length > 0) {
    await updateSessionMetaField(session, { tools: fresh });
  }
  return fresh;
}

export async function loadSessionMeta(session: string): Promise<SessionMetaLoadResult> {
  return loadMetaWithRouting(session);
}

export function generateSessionId(): string {
  const d = new Date(Date.now() + CST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  const ts = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}_${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
  return `${ts}_${randomBytes(2).toString("hex")}`;
}

export async function countSessionsByPlatform(): Promise<Record<string, number>> {
  if (postgresAvailable()) {
    return pgCountSessionsByPlatform();
  }
  const byPlatform: Record<string, number> = {};
  for (const sid of await listSessions()) {
    const meta = await loadSessionMeta(sid);
    const raw = isSessionMeta(meta) ? meta.platform : undefined;
    const platform = typeof raw === "string" && raw.trim() ? raw.trim() : "unknown";
    byPlatform[platform] = (byPlatform[platform] ?? 0) + 1;
  }
  return byPlatform;
}

export async function listSessionSummaries(platform?: string | null): Promise<
  Array<{
    id: string;
    title: string;
    created: string;
    platform: string;
  }>
> {
  if (postgresAvailable()) {
    return pgListSessionSummaries(platform);
  }
  const ids = await listSessions(platform);
  const out: Array<{ id: string; title: string; created: string; platform: string }> = [];
  for (const sid of ids) {
    const meta = await loadSessionMeta(sid);
    out.push({
      id: sid,
      title: isSessionMeta(meta) ? (meta.title ?? "") : "",
      created: isSessionMeta(meta) ? meta.timestamp : "",
      platform: isSessionMeta(meta) ? (meta.platform ?? "") : "",
    });
  }
  return out;
}

export async function listSessions(platform?: string | null): Promise<string[]> {
  return listSessionsWithRouting(platform);
}

/** session 是否存在（PostgreSQL） */
export async function sessionExists(session: string): Promise<boolean> {
  return sessionExistsWithRouting(session);
}

export async function load(session: string): Promise<Message[]> {
  return loadMessagesWithRouting(session);
}

export async function loadMessagePage(
  session: string,
  offset: number,
  limit: number,
): Promise<Message[]> {
  return loadMessagesPageWithRouting(session, offset, limit);
}

export async function countMessages(session: string): Promise<number> {
  return countMessagesWithRouting(session);
}

export async function loadForRuntime(
  session: string,
  meta?: SessionMetaLoadResult,
): Promise<Message[]> {
  const m = meta ?? (await loadSessionMeta(session));
  return loadMessagesForRuntimeWithRouting(session, m);
}

export async function appendMessage(msg: SessionMessage, session: string): Promise<void> {
  const out: SessionMessage & { timestamp?: string; id?: number } = { ...msg };
  if (!out.timestamp) out.timestamp = nowIso();
  if (out.pos === undefined && out.role !== "session_meta") {
    out.pos = await nextMessagePosWithRouting(session);
  }
  if (out.role !== "session_meta") {
    await pgWriteMessage(session, out);
  }
}

export async function appendSessionMeta(
  session: string,
  tools: OpenAiToolSchema[],
  model: string,
  opts?: { platform?: string; functions?: string[] },
): Promise<void> {
  const meta: SessionMetaMessage = {
    role: "session_meta",
    model,
    tools,
    functions: opts?.functions ?? [],
    timestamp: nowIso(),
  };
  if (opts?.platform) meta.platform = opts.platform;
  await pgWriteMeta(session, meta);
}

export async function initSession(
  sid: string,
  model: string,
  opts: { platform: string; functions?: string[]; platform_extra?: Record<string, unknown> },
): Promise<void> {
  const soul = loadSoul();
  const cwd = allocateSessionCwd(sid);
  const systemPrompt = buildSystemPrompt(opts.functions ?? [], soul, cwd);
  const meta: SessionMetaMessage = {
    role: "session_meta",
    model,
    tools: openaiSchemas(),
    functions: opts.functions ?? [],
    timestamp: nowIso(),
    platform: opts.platform,
    system_prompt: systemPrompt,
    cwd,
  };
  if (opts.platform_extra && Object.keys(opts.platform_extra).length > 0) {
    meta.platform_extra = opts.platform_extra;
  }
  await pgWriteMeta(sid, meta);
}

export async function newSession(
  platform: string,
  model?: string,
  platformExtra?: Record<string, unknown>,
): Promise<string> {
  const cfg = loadConfig();
  const sid = generateSessionId();
  await initSession(sid, model ?? getProfileHopModel(cfg, PROFILE_CHAT), {
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

/** 按 platform + platform_extra 匹配已有 session（extra 中每项须与 meta 一致） */
export async function findSessionByOrigin(
  platform: string,
  platformExtra: Record<string, unknown> = {},
): Promise<string | null> {
  if (postgresAvailable() && Object.keys(platformExtra).length > 0) {
    try {
      const sid = await pgFindSessionIdByPlatformInfo(platform, platformExtra);
      if (sid) return sid;
    } catch {
      /* 回退扫描 */
    }
  }

  try {
    for (const sid of await listSessionsWithRouting(platform)) {
      try {
        const meta = await loadSessionMeta(sid);
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
  session: string,
  patch: Partial<SessionMetaMessage> & Record<string, unknown>,
): Promise<void> {
  const parsed = await loadSessionMeta(session);
  if (!isSessionMeta(parsed)) return;
  await pgWritePatchMeta(session, patch);
}

export async function patchSessionOrigin(
  session: string,
  platform: string,
  platformExtra?: Record<string, unknown>,
): Promise<void> {
  const parsed = await loadSessionMeta(session);
  if (!isSessionMeta(parsed)) return;
  const meta: SessionMetaMessage = parsed;
  const existing = meta.platform ?? "";
  if (existing && existing !== platform) {
    throw new Error(
      `session ${session.slice(0, 16)}... platform 不可修改: ${existing} -> ${platform}`,
    );
  }
  if (!existing) meta.platform = platform;
  if (platformExtra !== undefined) meta.platform_extra = platformExtra;
  await pgWriteMeta(session, meta);
}

export async function rebuildSessionSystemPrompt(session: string): Promise<void> {
  const meta = await loadSessionMeta(session);
  if (!isSessionMeta(meta)) return;
  const functions = meta.functions ?? [];
  const cwd = meta.cwd;
  const soul = loadSoul();
  const systemPrompt = buildSystemPrompt(functions, soul, cwd);
  await updateSessionMetaField(session, { system_prompt: systemPrompt });
}

/** 将当前注册表工具写回 session_meta，供下次 LLM 请求使用 */
export async function reloadSessionTools(session: string): Promise<number> {
  const meta = await loadSessionMeta(session);
  if (!isSessionMeta(meta)) {
    throw new Error("session 不存在");
  }
  const tools = openaiSchemas();
  await updateSessionMetaField(session, { tools, timestamp: nowIso() });
  return tools.length;
}

const RESUME_STALE_MS = 7 * 24 * 60 * 60 * 1000;

async function sessionLastActivityMs(session: string): Promise<number | null> {
  const meta = await loadSessionMeta(session);
  const metaTs = isSessionMeta(meta) ? meta.timestamp : undefined;
  let last: number | null = metaTs ? Date.parse(metaTs) : null;
  const ts = await pgLastMessageTimestamp(session);
  if (ts) {
    const t = Date.parse(ts);
    if (!Number.isNaN(t) && (last === null || t > last)) last = t;
  }
  return last;
}

/** 续接 session 时按条件刷新 system_prompt */
export async function refreshSystemPromptOnResume(session: string): Promise<boolean> {
  const meta = await loadSessionMeta(session);
  if (!isSessionMeta(meta)) return false;
  const cached = (meta.system_prompt ?? "").trim();
  if (!cached) {
    await rebuildSessionSystemPrompt(session);
    return true;
  }
  const last = await sessionLastActivityMs(session);
  if (last === null) return false;
  if (Date.now() - last > RESUME_STALE_MS) {
    await rebuildSessionSystemPrompt(session);
    return true;
  }
  return false;
}

export async function assertSessionPlatform(session: string, expected: string): Promise<void> {
  const meta = await loadSessionMeta(session);
  const p = isSessionMeta(meta) ? meta.platform : undefined;
  if (p && p !== expected) {
    throw new Error(`Session platform mismatch: expected ${expected}, got ${p}`);
  }
}

export async function appendUserTurn(session: string, userText: string): Promise<string> {
  const content = userText;
  await appendMessage({ role: "user", content }, session);

  const meta = await loadSessionMeta(session);
  if (isSessionMeta(meta) && !meta.title) {
    const short = content.slice(0, 30).trim();
    if (short) {
      await updateSessionMetaField(session, { title: short });
    }
  }

  return content;
}

function compressionEnabled(): boolean {
  return getCompressionConfig().enabled;
}

function compressOptsForSession(
  _session: string,
  meta: SessionMetaLoadResult,
  state: CompressionState | null,
  overrides?: {
    forceEmergency?: boolean;
    force?: boolean;
  },
): Parameters<typeof compress>[1] {
  const cfg = getCompressionConfig();
  const model = isSessionMeta(meta) ? meta.model : getProfileHopModel(loadConfig(), PROFILE_CHAT);
  const systemPrompt = isSessionMeta(meta) ? (meta.system_prompt ?? "") : "";
  const tools = isSessionMeta(meta) ? meta.tools : [];
  return {
    maxRounds: cfg.maxRounds,
    model,
    systemPrompt,
    tools,
    state,
    forceEmergency: overrides?.forceEmergency,
    force: overrides?.force,
  };
}

async function finalizeCompressionSummary(
  session: string,
  allMsgs: Message[],
  prevState: CompressionState | null,
  cutState: CompressionState,
  systemPromptSnapshot: string,
  model: string,
): Promise<void> {
  const gen = await generateSessionSummary(
    allMsgs,
    prevState,
    cutState,
    systemPromptSnapshot,
    model,
  );

  const merged: CompressionState = {
    ...cutState,
    summary_at: new Date(Date.now() + CST_OFFSET_MS).toISOString().replace("Z", "+08:00"),
  };
  if (gen.ok) {
    merged.summary = gen.summary;
  } else {
    logComponent("compression").error(`会话摘要生成失败: ${session}`, { err: gen.error });
  }

  await updateSessionMetaField(session, { compression: merged });
  try {
    await rebuildSessionSystemPrompt(session);
  } catch (e) {
    logComponent("compression").error(`压缩后重建 system_prompt 失败: ${session}`, {
      err: String(e),
    });
  }
}

function scheduleCompressionSummary(
  session: string,
  allMsgs: Message[],
  prevState: CompressionState | null,
  cutState: CompressionState,
  systemPromptSnapshot: string,
  model: string,
): void {
  void finalizeCompressionSummary(
    session,
    allMsgs,
    prevState,
    cutState,
    systemPromptSnapshot,
    model,
  ).catch((e) => {
    logComponent("compression").error(`会话摘要流水线异常: ${session}`, { err: String(e) });
  });
}

/** 根据完整历史维护 meta.compression（不删消息；cut 变更时异步生成摘要） */
export async function advanceCompressionMeta(
  session: string,
  preloaded?: { msgs: Message[]; meta: SessionMetaLoadResult },
): Promise<void> {
  await recompressSession(session, undefined, preloaded);
}

/** 重新计算 session 裁剪（可选 force 忽略滞回） */
export async function recompressSession(
  session: string,
  opts?: { force?: boolean },
  preloaded?: { msgs: Message[]; meta: SessionMetaLoadResult },
): Promise<Record<string, unknown>> {
  const cfg = getCompressionConfig();
  const msgs = preloaded?.msgs ?? (await load(session));
  const meta = preloaded?.meta ?? (await loadSessionMeta(session));
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

  const compressOpts = compressOptsForSession(session, meta, state, {
    force: opts?.force,
    forceEmergency: opts?.force,
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
      await updateSessionMetaField(session, { compression: newState });
      scheduleCompressionSummary(session, msgs, prevState, newState, systemSnapshot, model);
    } else {
      await updateSessionMetaField(session, { compression: newState });
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

/** 将缺失 tool 响应写入 PG（在 assistant 后原位插入，后续 pos 后移） */
export async function repairAndPersistToolLoop(
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

    const current = await load(session);
    const idx = current.findIndex((m) => m.pos === c.assistantPos);
    if (idx < 0) continue;

    const following = countFollowingToolMessages(current, idx);
    const insertAtPos = c.assistantPos + 1 + following;
    const n = c.missingCalls.length;
    if (n === 0) continue;

    await pgShiftMessagePositions(session, insertAtPos - 1, n);

    for (let i = 0; i < n; i++) {
      const call = c.missingCalls[i]!;
      await pgWriteMessage(session, {
        role: "tool",
        pos: insertAtPos + i,
        tool_call_id: call.id,
        name: call.name,
        content: syntheticToolContent(reason),
        timestamp: nowIso(),
      });
      inserted++;
    }
  }

  logComponent("tool-loop-integrity").error(
    `tool loop 历史已修复: session=${session} 原位插入 ${inserted} 条 synthetic tool`,
  );
  return true;
}

async function ensureSessionToolIntegrity(
  session: string,
  msgs: SessionMessage[],
): Promise<Message[]> {
  const repaired = await repairAndPersistToolLoop(session, msgs);
  return repaired ? load(session) : msgs;
}

/** 工具循环中单轮上下文 emergency：就地裁切内存中的 messages */
export async function maybeApplyEmergencyCompression(
  session: string,
  runtimeMessages: SessionMessage[],
  opts: { model: string; tools: OpenAiToolSchema[] },
): Promise<boolean> {
  if (!compressionEnabled()) return false;
  if (isInToolLoop(runtimeMessages)) return false;
  const meta = await loadSessionMeta(session);
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
    await updateSessionMetaField(session, { compression: newState });
    const systemSnapshot = systemPrompt;
    const allMsgs = await load(session);
    scheduleCompressionSummary(session, allMsgs, prev, newState, systemSnapshot, opts.model);
  }
  return true;
}

function buildRuntimeMessagesFrom(
  session: string,
  meta: SessionMetaLoadResult,
  msgs: Message[],
): [SessionMessage[], string[]] {
  const functions = isSessionMeta(meta) ? meta.functions : [];
  let runtimeMsgs = msgs;
  const systemPrompt = isSessionMeta(meta) ? (meta.system_prompt ?? "") : "";

  if (compressionEnabled()) {
    const state = isSessionMeta(meta) ? parseCompressionState(meta.compression) : null;
    const [compressed] = compress(runtimeMsgs, compressOptsForSession(session, meta, state));
    runtimeMsgs = compressed;
  }

  runtimeMsgs = runtimeMsgs.filter((m) => m.role !== "system");
  runtimeMsgs = injectTimePrefixes(runtimeMsgs);

  if (systemPrompt) runtimeMsgs.unshift({ role: "system", content: systemPrompt });
  return [runtimeMsgs, functions];
}

export async function buildRuntimeMessages(session: string): Promise<[SessionMessage[], string[]]> {
  const meta = await loadSessionMeta(session);
  const msgs = await loadForRuntime(session, meta);
  return buildRuntimeMessagesFrom(session, meta, msgs);
}

export async function beginTurn(
  session: string,
  userText: string,
): Promise<[SessionMessage[], string[], string]> {
  clearToolLoopSuppression(session);
  const effective = await appendUserTurn(session, userText);
  let msgs = await load(session);
  msgs = await ensureSessionToolIntegrity(session, msgs);
  const meta = await loadSessionMeta(session);
  await advanceCompressionMeta(session, { meta, msgs });
  const [runtimeMsgs, functions] = buildRuntimeMessagesFrom(session, meta, msgs);
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
      await appendMessage(msg, session);
    }
  }
  await updateSessionMeta(session, model, { functions });
}

export async function updateSessionMeta(
  session: string,
  model: string,
  opts?: { functions?: string[]; tools?: OpenAiToolSchema[] },
): Promise<void> {
  const parsed = await loadSessionMeta(session);
  if (!isSessionMeta(parsed)) return;
  const meta: SessionMetaMessage = parsed;
  meta.model = model;
  meta.timestamp = nowIso();
  if (opts?.functions) meta.functions = opts.functions;
  if (opts?.tools !== undefined) {
    meta.tools = opts.tools;
  } else if (!meta.tools.length) {
    meta.tools = openaiSchemas();
  }
  await pgWriteMeta(session, meta);
}

export async function setSessionTitle(session: string, title: string): Promise<void> {
  await updateSessionMetaField(session, { title });
}

export async function getSessionTitle(session: string): Promise<string> {
  const meta = await loadSessionMeta(session);
  return isSessionMeta(meta) && typeof meta.title === "string" ? meta.title : "";
}

export async function getSessionCwd(session: string): Promise<string | null> {
  const meta = await loadSessionMeta(session);
  const cwd = isSessionMeta(meta) ? meta.cwd : undefined;
  return typeof cwd === "string" && cwd ? cwd : null;
}

function expandUserPath(cwd: string): string {
  if (cwd.startsWith("~/")) return join(homedir(), cwd.slice(2));
  if (cwd === "~") return homedir();
  return cwd;
}

export async function setSessionCwd(session: string, cwd: string): Promise<string> {
  const expanded = expandUserPath(cwd.trim());
  const resolved = resolve(expanded);
  if (!existsSync(resolved)) {
    throw new Error(`路径不存在: ${cwd}`);
  }
  await updateSessionMetaField(session, { cwd: resolved });
  await rebuildSessionSystemPrompt(session);
  return resolved;
}

/** 删除最后一轮 user 之后的 assistant/tool 消息，返回该 user 正文 */
export async function rollbackToLastUser(session: string): Promise<string> {
  const parsed = await load(session);
  if (!parsed.length) throw new Error("没有可重试的伙伴消息");

  let lastUserIdx = -1;
  for (let i = parsed.length - 1; i >= 0; i--) {
    if (parsed[i]?.role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx < 0) throw new Error("没有可重试的伙伴消息");

  const kept = parsed.slice(0, lastUserIdx + 1);
  const lastUser = kept[lastUserIdx]!;
  const keepThroughPos = lastUser.pos;
  if (keepThroughPos === undefined) {
    throw new Error("没有可重试的伙伴消息");
  }
  await pgWriteTruncate(session, Number(keepThroughPos));

  return lastUser.role === "user" ? lastUser.content : "";
}

/** 重试回合：回滚末条 user，不追加新 user，返回运行时 messages */
export async function retryTurn(session: string): Promise<[SessionMessage[], string[], string]> {
  const effective = await rollbackToLastUser(session);
  let msgs = await load(session);
  msgs = await ensureSessionToolIntegrity(session, msgs);
  const meta = await loadSessionMeta(session);
  await advanceCompressionMeta(session, { meta, msgs });
  const [runtimeMsgs, functions] = buildRuntimeMessagesFrom(session, meta, msgs);
  return [runtimeMsgs, functions, effective];
}

export async function cleanupDebugSessions(_maxAgeHours = 1): Promise<number> {
  if (!postgresAvailable()) return 0;
  try {
    return await pgDeleteDebugSessions();
  } catch {
    let removed = 0;
    for (const sid of await pgListDebugSessionIds()) {
      try {
        await pgWriteDeleteSession(sid);
        removed++;
      } catch {
        /* skip */
      }
    }
    return removed;
  }
}
