import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { loadConfig, sanitizeConfigForApi } from "@freeanima/legacy-kernel";
import {
  executeCommand as runSlashCommand,
  resolveCommand,
  listCommandDefs,
  listCommandDefsForPlatform,
  isRetryResult,
} from "./commands/index";
import type { CommandResult } from "./commands/registry";
import { logComponent, logSseError } from "@freeanima/legacy-kernel";
import * as conv from "@freeanima/legacy-engine";
import {
  buildMessagesDisplay,
  paginateMessagesDisplay,
} from "./build-messages-display";
import type { MessagesDisplay } from "@freeanima/legacy-kernel";
import type {
  HealthSnapshot,
  PlatformStatusSnapshot,
  SafeConfigSnapshot,
  ServiceSnapshot,
  SessionSummary,
} from "@freeanima/legacy-kernel";
import type { StreamEvent } from "@freeanima/legacy-engine";
import type { Message } from "@freeanima/legacy-engine";
import { LLMError } from "@freeanima/legacy-engine";
import type { EventBus } from "@freeanima/legacy-kernel";
import { listTools, openaiSchemas } from "@freeanima/legacy-kernel";
import { statsReport } from "./conversation-stats";
import { runWithToolContext } from "@freeanima/legacy-engine";
import {
  ensureBuiltinCronJobs,
  getJob,
  listJobs,
  pauseJob,
  resumeJob,
  enqueueRunJob,
} from "./cron/index";
import type { CronJobData } from "./cron/models";
import { kernel } from "@freeanima/legacy-engine";
import {
  messageIncoming,
  turnAfterComplete,
} from "@freeanima/legacy-kernel";
import { applyClarifyStreamAwaiting } from "@freeanima/legacy-clarify";
import { PATHS, CST_OFFSET_MS } from "@freeanima/legacy-kernel";
import { distillAll } from "@freeanima/legacy-memory/clean";
import { countL2FtsRows, reindexL2All as reindexL2FtsAll } from "@freeanima/legacy-memory/l2-indexer";
import { indexL3All as reindexL3FtsAll } from "@freeanima/legacy-memory/l3-indexer";
import { getStore } from "@freeanima/legacy-memory/store";
import { memorySearchDetailed, type MemorySearchResult } from "@freeanima/legacy-memory/search";
import { PARLOR_PLATFORM } from "./platforms";
import { NEST_VERSION } from "./version";
import {
  isInsufficientToolMessagesError,
  repairAndPersistToolLoop,
  collectStreamReply,
} from "@freeanima/legacy-engine";
import * as engine from "@freeanima/legacy-engine";
import type { CommandDef } from "./commands/registry";

function streamErrorEvent(
  sessionId: string,
  message: string,
  err?: unknown,
): StreamEvent {
  logSseError(`/sessions/${sessionId}/messages/stream`, message, {
    session_id: sessionId,
  });
  if (err !== undefined) {
    logComponent("nest-service").error(message, { err, session_id: sessionId });
  }
  return { event: "error", data: { error: message } };
}

function lastAssistantText(msgs: Message[]): string {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m?.role === "assistant") {
      const content = m.content;
      return typeof content === "string" ? content : "";
    }
  }
  return "";
}

export type MemoryFileEntry = {
  name: string;
  path: string;
  size: number;
  mtime: number;
  content: string;
};

export type { StreamEvent } from "@freeanima/legacy-engine";

export class SessionManager {
  private chains = new Map<string, Promise<unknown>>();

  runExclusive<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(sessionId) ?? Promise.resolve();
    const next = prev.then(() => fn());
    this.chains.set(
      sessionId,
      next.catch(() => undefined),
    );
    return next;
  }
}

function startTimeIso(epochSec: number): string {
  if (epochSec <= 0) return "";
  return new Date(epochSec * 1000 + CST_OFFSET_MS)
    .toISOString()
    .replace("Z", "+08:00")
    .slice(0, 19);
}

function buildMemoryFileStats(): { files_count: number; files_bytes: number } {
  let files_count = 0;
  let files_bytes = 0;
  const add = (path: string) => {
    if (!existsSync(path)) return;
    try {
      files_count++;
      files_bytes += statSync(path).size;
    } catch {
      /* ignore */
    }
  };

  add(PATHS.soul);
  add(join(PATHS.home, "MEMORY.md"));
  add(join(PATHS.home, "USER.md"));

  try {
    if (existsSync(PATHS.memory)) {
      for (const name of readdirSync(PATHS.memory)) {
        if (!name.startsWith("f-") || !name.endsWith(".md")) continue;
        add(join(PATHS.memory, name));
      }
    }
  } catch {
    /* empty */
  }

  return { files_count, files_bytes };
}

async function buildSessionsByPlatform(): Promise<Record<string, number>> {
  try {
    return await conv.countSessionsByPlatform();
  } catch {
    return {};
  }
}

function readMemoryEntry(path: string, displayName: string): MemoryFileEntry | null {
  if (!existsSync(path)) return null;
  try {
    const st = statSync(path);
    return {
      name: displayName,
      path,
      size: st.size,
      mtime: st.mtimeMs / 1000,
      content: readFileSync(path, "utf-8"),
    };
  } catch {
    return null;
  }
}

export class NestService {
  private startTime = 0;
  private platformStatus: Record<string, PlatformStatusSnapshot> = {};
  private sessionManager = new SessionManager();
  private bus: EventBus | null = null;
  private onSessionUpdated: ((sid: string) => void) | null = null;
  private shuttingDown = false;
  private inFlightCount = 0;
  private inFlightResolve: (() => void) | null = null;
  private sessionAbortControllers = new Map<string, AbortController>();

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  acquireInFlight(): void {
    this.inFlightCount++;
  }

  releaseInFlight(): void {
    this.inFlightCount--;
    if (this.inFlightCount === 0 && this.inFlightResolve !== null) {
      const r = this.inFlightResolve;
      this.inFlightResolve = null;
      r();
    }
  }

  async waitForDrain(): Promise<void> {
    if (this.inFlightCount <= 0) {
      logComponent("shutdown").info("无进行中请求，跳过 drain");
      return;
    }
    logComponent("shutdown").info(
      `等待 ${this.inFlightCount} 个进行中的对话/工具请求落盘（engine.run/runStream）…`,
      { in_flight: this.inFlightCount },
    );
    await new Promise<void>((resolve) => {
      this.inFlightResolve = resolve;
      if (this.inFlightCount <= 0) {
        this.inFlightResolve = null;
        resolve();
      }
    });
    logComponent("shutdown").info("进行中请求已排空");
  }

  startShutdown(): void {
    this.shuttingDown = true;
  }

  /** 关停诊断：当前未结束的 engine.run / runStream 数量 */
  getInFlightCount(): number {
    return this.inFlightCount;
  }

  private preemptSessionEngine(sessionId: string): void {
    this.sessionAbortControllers.get(sessionId)?.abort();
  }

  private beginEngineRun(sessionId: string): { signal: AbortSignal; controller: AbortController } {
    this.preemptSessionEngine(sessionId);
    const controller = new AbortController();
    this.sessionAbortControllers.set(sessionId, controller);
    return { signal: controller.signal, controller };
  }

  private endEngineRun(sessionId: string, controller: AbortController): void {
    if (this.sessionAbortControllers.get(sessionId) === controller) {
      this.sessionAbortControllers.delete(sessionId);
    }
  }

  private engineStreamOpts(sessionId: string, signal: AbortSignal) {
    return {
      onMessageAppended: async (msg: Message) => {
        await conv.appendMessage(msg, sessionId);
      },
      onToolRoundComplete: async (batch: Message[]) => {
        for (const msg of batch) {
          await conv.appendMessage(msg, sessionId);
        }
      },
      signal,
    };
  }

  private async reloadRuntimeAfterRepair(
    sessionId: string,
  ): Promise<[Message[], string[]]> {
    await repairAndPersistToolLoop(sessionId, await conv.load(sessionId));
    return conv.buildRuntimeMessages(sessionId);
  }

  setEventBus(bus: EventBus): void {
    this.bus = bus;
  }

  setOnSessionUpdated(cb: (sid: string) => void): void {
    this.onSessionUpdated = cb;
  }

  markStarted(): void {
    this.startTime = Date.now() / 1000;
  }

  get start_time(): number {
    return this.startTime;
  }

  registerPlatform(name: string): void {
    this.platformStatus[name] = { status: "starting", since: Date.now() / 1000 };
  }

  updatePlatformStatus(name: string, status: string, extra: Record<string, unknown> = {}): void {
    this.platformStatus[name] = { status, ...extra };
  }

  getPlatformStatus(): Record<string, PlatformStatusSnapshot> {
    return { ...this.platformStatus };
  }

  private async checkPlatform(params: { platform?: string }, sid: string): Promise<void> {
    const platform = (params.platform ?? "").trim();
    if (platform) await conv.assertSessionPlatform(sid, platform);
  }

  private async runIncomingMessageHooks(
    sessionId: string,
    message: string,
    platform: string,
  ): Promise<
    | { ok: true; message: string; expiredHint?: string }
    | { ok: false; reason: string }
  > {
    const ctx = await kernel.hookRegistry.run(messageIncoming, {
      sessionId,
      message,
      platform,
    });
    if (ctx.blocked) return { ok: false, reason: ctx.blocked.reason };
    return {
      ok: true,
      message: ctx.transformedMessage ?? message,
      expiredHint: ctx.expiredHint,
    };
  }

  private async runTurnAfterCompleteHooks(
    sessionId: string,
    messages: Message[],
    defaultContent: string,
  ): Promise<string> {
    const ctx = await kernel.hookRegistry.run(turnAfterComplete, {
      sessionId,
      messages: messages as Record<string, unknown>[],
    });
    return ctx.displayContent ?? defaultContent;
  }

  private emitSessionUpdated(sessionId: string): void {
    this.bus?.emit("session:updated", { session_id: sessionId });
    this.onSessionUpdated?.(sessionId);
  }

  health(): HealthSnapshot {
    return { status: "ok", version: NEST_VERSION };
  }

  async buildStatus(host: string, port: number): Promise<ServiceSnapshot> {
    const cfg = loadConfig();
    const uptime =
      this.startTime > 0 ? Math.round(Date.now() / 1000 - this.startTime) : null;

    const byPlatform = await buildSessionsByPlatform();
    const sessionCount = Object.values(byPlatform).reduce((a, b) => a + b, 0);

    let toolCount = 0;
    try {
      toolCount = listTools().length;
    } catch {
      toolCount = 0;
    }

    let memoryKb = 0;
    try {
      const statusText = readFileSync(`/proc/${process.pid}/status`, "utf-8");
      for (const line of statusText.split("\n")) {
        if (line.startsWith("VmRSS:")) {
          memoryKb = parseInt(line.split(/\s+/)[1] ?? "0", 10);
          break;
        }
      }
    } catch {
      /* non-Linux */
    }

    const fileStats = buildMemoryFileStats();
    let factsCount = 0;
    let l2IndexRows = 0;
    try {
      factsCount = getStore().count();
    } catch {
      factsCount = 0;
    }
    try {
      l2IndexRows = countL2FtsRows();
    } catch {
      l2IndexRows = 0;
    }

    const status: ServiceSnapshot = {
      status: "running",
      pid: process.pid,
      version: NEST_VERSION,
      uptime_seconds: uptime,
      start_time_iso: startTimeIso(this.startTime),
      config: {
        model: cfg.model,
        api_base: cfg.api_base,
      },
      sessions: { total: sessionCount, by_platform: byPlatform },
      tools: toolCount,
      cron_jobs: this.listCronJobs().jobs.length,
      platforms: { ...this.platformStatus },
      memory_kb: memoryKb,
      memory: {
        files_count: fileStats.files_count,
        files_bytes: fileStats.files_bytes,
        facts_count: factsCount,
        l2_index_rows: l2IndexRows,
      },
    };
    if (host) status.host = host;
    if (port) status.port = port;
    return status;
  }

  async listSessions(platform?: string | null): Promise<{ sessions: SessionSummary[] }> {
    const p = platform === "" ? null : platform;
    return { sessions: await conv.listSessionSummaries(p ?? undefined) };
  }

  async createSession(platform = PARLOR_PLATFORM): Promise<{ session_id: string }> {
    const sid = await conv.newSession(platform);
    return { session_id: sid };
  }

  async findOrCreateSession(
    platform: string,
    platform_extra: Record<string, unknown> = {},
  ): Promise<{ session_id: string }> {
    let sid = await conv.findSessionByOrigin(platform, platform_extra);
    if (!sid) {
      sid = await conv.newSession(platform, undefined, platform_extra);
    } else {
      await conv.refreshSystemPromptOnResume(sid);
    }
    return { session_id: sid };
  }

  async patchSessionOrigin(
    session_id: string,
    platform: string,
    platform_extra?: Record<string, unknown>,
  ): Promise<{ ok: boolean }> {
    await conv.patchSessionOrigin(session_id, platform, platform_extra);
    return { ok: true };
  }

  private async applyCommandSessionEffects(
    result: CommandResult,
    _sessionId: string,
    platform: string,
    originExtra?: Record<string, unknown>,
  ): Promise<void> {
    const data = result.data as { new_session_id?: string } | undefined;
    if (data?.new_session_id && originExtra !== undefined) {
      await conv.patchSessionOrigin(data.new_session_id, platform, originExtra);
    }
  }

  async executeCommand(params: {
    session_id: string;
    text: string;
    platform?: string;
    origin_extra?: Record<string, unknown>;
  }): Promise<{ text: string; data: unknown; found: boolean }> {
    const sessionId = params.session_id;
    const platform = params.platform ?? "gateway";
    const text = params.text.trim();
    const [cmd, args] = resolveCommand(text, platform);

    if (!cmd) {
      if (text.startsWith("/")) {
        const cmdName = text.split(/\s/)[0] ?? "/?";
        return {
          text: `❌ 未知命令: ${cmdName}。输入 /help 查看可用命令。`,
          data: null,
          found: true,
        };
      }
      return { text: "", data: null, found: false };
    }

    const result = await runSlashCommand(cmd, {
      sessionId,
      platform,
      args,
      raw: text,
      origin_extra: params.origin_extra,
    });
    await this.applyCommandSessionEffects(result, sessionId, platform, params.origin_extra);

    if (isRetryResult(result)) {
      try {
        const reply = await collectStreamReply(this.runRetryStream(sessionId));
        return { text: reply, data: result.data, found: true };
      } catch (e) {
        return { text: `⚠️ ${e}`, data: result.data, found: true };
      }
    }

    return { text: result.text, data: result.data ?? null, found: true };
  }

  async getSessionInfo(sessionId: string, platform = ""): Promise<Record<string, unknown>> {
    if (!(await conv.sessionExists(sessionId))) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    await this.checkPlatform({ platform }, sessionId);
    return { session_id: sessionId, stats: await statsReport(sessionId) };
  }

  async getMessages(
    sessionId: string,
    platform = "",
    opts?: { offset?: number; limit?: number | null },
  ): Promise<MessagesDisplay> {
    if (!(await conv.sessionExists(sessionId))) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    await this.checkPlatform({ platform }, sessionId);
    if (opts?.limit != null) {
      const offset = Math.max(0, opts.offset ?? 0);
      const limit = Math.max(1, opts.limit);
      const [total, page] = await Promise.all([
        conv.countMessages(sessionId),
        conv.loadMessagePage(sessionId, offset, limit),
      ]);
      const full = buildMessagesDisplay(page);
      return {
        session_id: sessionId,
        display: full,
        total,
        offset,
        limit,
      };
    }
    const all = await conv.load(sessionId);
    return paginateMessagesDisplay(sessionId, all, opts);
  }

  async setSessionTitle(sessionId: string, title: string, platform = ""): Promise<{ ok: boolean }> {
    await this.checkPlatform({ platform }, sessionId);
    await conv.setSessionTitle(sessionId, title.slice(0, 50));
    return { ok: true };
  }

  private async *yieldEngineStream(
    sessionId: string,
    msgs: Message[],
    model: string,
    signal: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    const tools = await conv.loadSessionTools(sessionId);
    this.acquireInFlight();
    try {
      try {
        for await (const ev of runWithToolContext(sessionId, () =>
          engine.runStream(msgs, {
            model,
            tools,
            ...this.engineStreamOpts(sessionId, signal),
          }),
        )) {
          if (ev.event === "awaiting_clarify") {
            await applyClarifyStreamAwaiting(sessionId, ev.data.items, ev.data.timeout_sec);
          }
          yield ev;
        }
      } catch (e) {
        if (e instanceof engine.EngineTurnInterrupted) {
          yield { event: "interrupted", data: { reason: e.message } };
          yield { event: "done", data: { reason: "interrupted" } };
          return;
        }
        if (e instanceof engine.MaxTurnsExceeded) {
          const msg = `tool loop exceeded: ${e.message}`;
          logComponent("nest-service").error(msg, { err: e });
          yield { event: "error", data: { error: msg } };
          return;
        }
        if (e instanceof LLMError) {
          logComponent("nest-service").error(e.message, { err: e });
          yield { event: "error", data: { error: e.message } };
          return;
        }
        const msg = String(e);
        logComponent("nest-service").error(msg, { err: e });
        yield { event: "error", data: { error: msg } };
      }
    } finally {
      this.releaseInFlight();
    }
  }

  async sendMessage(
    sessionId: string,
    message: string,
    platform = PARLOR_PLATFORM,
  ): Promise<{ session_id: string; content: string }> {
    const content = await collectStreamReply(
      this.sendMessageStream(sessionId, message, platform),
    );
    return { session_id: sessionId, content };
  }

  async *sendMessageStream(
    sessionId: string,
    message: string,
    platform = PARLOR_PLATFORM,
  ): AsyncGenerator<StreamEvent> {
    message = message.trim();
    if (this.shuttingDown) {
      yield streamErrorEvent(sessionId, "Server is shutting down");
      return;
    }
    if (!(await conv.sessionExists(sessionId))) {
      yield streamErrorEvent(sessionId, `Session not found: ${sessionId}`);
      return;
    }
    if (!message) {
      yield streamErrorEvent(sessionId, "message is required");
      return;
    }
    await this.checkPlatform({ platform }, sessionId);

    const [cmd, args] = resolveCommand(message, platform);
    if (cmd) {
      yield* this.dispatchCommandStream(sessionId, platform, message, cmd, args);
      return;
    }
    if (message.startsWith("/")) {
      yield {
        event: "token",
        data: {
          content: `❌ 未知命令: ${message.split(/\s/)[0]}。输入 /help 查看可用命令。`,
        },
      };
      yield { event: "done", data: {} };
      return;
    }

    const guard = await this.runIncomingMessageHooks(sessionId, message, platform);
    if (!guard.ok) {
      yield { event: "token", data: { content: guard.reason } };
      yield { event: "done", data: {} };
      return;
    }
    if (guard.expiredHint) {
      yield { event: "token", data: { content: `${guard.expiredHint}\n\n` } };
    }

    yield* this.runTurnStream(sessionId, guard.message);
  }

  private async *dispatchCommandStream(
    sessionId: string,
    platform: string,
    raw: string,
    cmd: CommandDef,
    args: string[],
  ): AsyncGenerator<StreamEvent> {
    if (cmd.name !== "cancel") {
      const guard = await this.runIncomingMessageHooks(sessionId, raw, platform);
      if (!guard.ok) {
        yield { event: "token", data: { content: guard.reason } };
        yield { event: "done", data: {} };
        return;
      }
    }
    const result = await runSlashCommand(cmd, {
      sessionId,
      platform,
      args,
      raw,
    });
    if (isRetryResult(result)) {
      try {
        yield* this.runRetryStream(sessionId);
      } catch (e) {
        yield { event: "token", data: { content: `⚠️ ${e}` } };
        yield { event: "done", data: {} };
      }
      return;
    }
    if (result.text) {
      yield { event: "token", data: { content: result.text } };
    }
    yield { event: "done", data: {} };
  }

  private async *runRetryStream(sessionId: string): AsyncGenerator<StreamEvent> {
    this.preemptSessionEngine(sessionId);
    yield* this.runExclusiveEngineStream(sessionId, async () => conv.retryTurn(sessionId));
  }

  private async *runTurnStream(
    sessionId: string,
    message: string,
  ): AsyncGenerator<StreamEvent> {
    this.preemptSessionEngine(sessionId);
    yield* this.runExclusiveEngineStream(sessionId, async () => conv.beginTurn(sessionId, message));
  }

  private async *runExclusiveEngineStream(
    sessionId: string,
    prepare: () => Promise<[Message[], string[], string]>,
  ): AsyncGenerator<StreamEvent> {
    const buffer: StreamEvent[] = [];
    let closed = false;
    let wake: (() => void) | null = null;
    const signalReady = () => {
      wake?.();
      wake = null;
    };

    const work = this.sessionManager.runExclusive(sessionId, async () => {
      let [msgs, functions, effective] = await prepare();
      const cfg = loadConfig();
      const model = cfg.model ?? "deepseek-v4-flash";
      let hadError = false;
      let sawDone = false;
      let retried = false;

      while (true) {
        hadError = false;
        sawDone = false;
        let pendingDone: StreamEvent | null = null;
        const { signal, controller } = this.beginEngineRun(sessionId);

        try {
          for await (const ev of this.yieldEngineStream(sessionId, msgs, model, signal)) {
            if (ev.event === "done") {
              pendingDone = ev;
              sawDone = true;
              continue;
            }
            buffer.push(ev);
            signalReady();
            if (ev.event === "error") {
              hadError = true;
              if (
                !retried &&
                isInsufficientToolMessagesError(ev.data.error)
              ) {
                const [runtimeMsgs, fn] = await this.reloadRuntimeAfterRepair(sessionId);
                msgs = runtimeMsgs;
                functions = fn;
                retried = true;
                hadError = false;
                break;
              }
            }
          }
          if (retried && !sawDone && !hadError) {
            continue;
          }
          if (!hadError) {
            await conv.finishTurn(sessionId, msgs, effective, model, functions, true);
            const reply = lastAssistantText(msgs);
            const displayContent = await this.runTurnAfterCompleteHooks(sessionId, msgs, reply);
            if (displayContent !== reply) {
              buffer.push({ event: "content_replace", data: { content: displayContent } });
              signalReady();
            }
            if (pendingDone) {
              buffer.push(pendingDone);
              signalReady();
            } else if (!sawDone) {
              buffer.push({ event: "done", data: {} });
              signalReady();
            }
          }
          break;
        } catch (e) {
          hadError = true;
          buffer.push(streamErrorEvent(sessionId, String(e), e));
          signalReady();
          break;
        } finally {
          this.endEngineRun(sessionId, controller);
        }
      }

      if (!hadError) {
        this.emitSessionUpdated(sessionId);
      }
      closed = true;
      signalReady();
    });

    while (!closed || buffer.length > 0) {
      while (buffer.length > 0) {
        yield buffer.shift()!;
      }
      if (closed) break;
      await new Promise<void>((resolve) => {
        wake = resolve;
        setTimeout(resolve, 50);
      });
    }

    await work;
  }

  memorySearch(args: {
    query: string;
    limit?: number;
    session_limit?: number;
    session?: string;
  }): MemorySearchResult {
    const query = args.query.trim();
    if (!query) throw new Error("query is required");
    return memorySearchDetailed(query, {
      l3Limit: args.limit,
      l2Limit: args.session_limit,
      sessionId: args.session?.trim() || undefined,
    });
  }

  /** 从 L1 全量重蒸馏 L2（不写 FTS）。 */
  async distillL2All(): Promise<{ sessions: number }> {
    return { sessions: await distillAll({ overwrite: true }) };
  }

  /** 清空并重建 L2 FTS 索引（不蒸馏）。 */
  reindexL2All(): { index_rows: number } {
    return { index_rows: reindexL2FtsAll({ dropFirst: true }) };
  }

  /** 清空并重建 L3 FTS 索引。 */
  reindexL3All(): { index_rows: number } {
    return { index_rows: reindexL3FtsAll({ dropFirst: true }) };
  }

  /** 蒸馏 + 重建 L2 索引（组合，供脚本/测试）。 */
  async rebuildL2All(): Promise<{ sessions: number; index_rows: number }> {
    const sessions = await distillAll({ overwrite: true });
    const index_rows = reindexL2FtsAll({ dropFirst: true });
    return { sessions, index_rows };
  }

  listMemoryFiles(): { files: MemoryFileEntry[] } {
    const files: MemoryFileEntry[] = [];
    const home = PATHS.home;

    for (const name of ["SOUL.md", "MEMORY.md", "USER.md"]) {
      const path = name === "SOUL.md" ? PATHS.soul : join(home, name);
      const entry = readMemoryEntry(path, name);
      if (entry) files.push(entry);
    }

    try {
      if (existsSync(PATHS.memory)) {
        for (const name of readdirSync(PATHS.memory).sort()) {
          if (!name.startsWith("f-") || !name.endsWith(".md")) continue;
          const path = join(PATHS.memory, name);
          const entry = readMemoryEntry(path, name);
          if (entry) files.push(entry);
        }
      }
    } catch {
      /* empty */
    }

    return { files };
  }

  getConfig(): SafeConfigSnapshot {
    const cfg = loadConfig();
    return { config: sanitizeConfigForApi(cfg) as SafeConfigSnapshot["config"] };
  }

  listToolsApi(): { tools: { name: string; description: string }[] } {
    return { tools: listTools().map((t) => ({ name: t.name, description: t.description })) };
  }

  listCronJobs(): { jobs: CronJobData[] } {
    return { jobs: listJobs().map((j) => j.toJSON()) };
  }

  pauseCronJob(jobId: string): CronJobData | null {
    if (!pauseJob(jobId)) return null;
    return getJob(jobId)?.toJSON() ?? null;
  }

  resumeCronJob(jobId: string): CronJobData | null {
    if (!resumeJob(jobId)) return null;
    return getJob(jobId)?.toJSON() ?? null;
  }

  runCronJobNow(jobId: string): { job: CronJobData; message: string } | null {
    const job = getJob(jobId);
    if (!job) return null;
    enqueueRunJob(job);
    return {
      job: job.toJSON(),
      message: `已触发立即运行: ${job.name}`,
    };
  }

  ensureBuiltinCronJobs(): void {
    ensureBuiltinCronJobs();
  }

  listCommands(opts?: { platform?: string; all?: boolean }): {
    commands: {
      name: string;
      description: string;
      scope: string;
      platforms: string[] | null;
    }[];
    platform?: string;
  } {
    const platform = opts?.platform ?? PARLOR_PLATFORM;
    const defs = opts?.all ? listCommandDefs() : listCommandDefsForPlatform(platform);
    return {
      commands: defs.map((c) => ({
        name: c.name,
        description: c.description,
        scope: c.scope ?? "session",
        platforms: c.platforms?.length ? [...c.platforms] : null,
      })),
      ...(opts?.all ? {} : { platform }),
    };
  }

  getStatus(): Record<string, unknown> {
    return { platforms: this.platformStatus };
  }
}

export async function appendSessionMetaForEngine(session: string): Promise<void> {
  const cfg = loadConfig();
  const tools = await conv.loadSessionTools(session);
  await conv.appendSessionMeta(
    session,
    tools.length ? tools : openaiSchemas(),
    cfg.model ?? "",
    {},
  );
}
