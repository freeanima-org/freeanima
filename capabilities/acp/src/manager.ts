import { join } from "node:path";
import type { SkillRegistry } from "@freeanima/engine-skill";
import { registerSkillsFromDirectory } from "@freeanima/engine-skill";
import { getToolSessionId } from "@freeanima/engine-loop";
import type { ToolRegistry } from "@freeanima/engine-tool";
import { toolError, toolResult } from "@freeanima/engine-tool";
import { loadConfig } from "@freeanima/service-config";
import { logComponent } from "@freeanima/service-logging";

import type { ConversationService } from "@freeanima/engine-conversation";
import {
  AcpAsyncTaskStore,
  appendProgressNote,
  createTaskId,
  formatProgressBody,
  toTaskSnapshot,
  type AcpAsyncTask,
} from "./async-task.ts";
import { AcpAgentQueue } from "./agent-queue.ts";
import type { AcpProgressDeliveryPort } from "./ports/progress-delivery.ts";
import { ACPClient } from "./client.ts";
import { bindAcpSession, getBoundAcpSession, unbindAcpSession } from "./anima-binding.ts";
import {
  formatAcpPromptResult,
  type AcpCursorMode,
  type AcpPromptResult,
} from "./prompt-result.ts";
import {
  sanitizeAcpConfig,
  shortSessionId,
  isAcpAgentEnabled,
  type AcpAgentConfig,
  type AcpControlResult,
  type AcpAgentStatusView,
  type AcpStatusResponse,
} from "./status.ts";

const DEFAULT_HEALTH_CHECK_MS = 60_000;
const DEFAULT_ASYNC_TIMEOUT_MINUTES = 30;
const DEFAULT_PROGRESS_INTERVAL_MS = 30_000;
const ACP_SKILLS_SOURCE = "acp";

type AcpPromptOptions = {
  animaSessionId?: string;
  acpSessionId?: string;
  newSession?: boolean;
  continueSession?: boolean;
  mode?: AcpCursorMode;
};

type SessionMeta = {
  agent: string;
  lastUsed: number;
};

class ACPSessionStore {
  private sessions = new Map<string, SessionMeta>();

  add(sessionId: string, agentName: string): void {
    this.sessions.set(sessionId, { agent: agentName, lastUsed: Date.now() });
  }

  touch(sessionId: string): void {
    const row = this.sessions.get(sessionId);
    if (row) row.lastUsed = Date.now();
  }

  getAgent(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.agent;
  }

  remove(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  removeByAgent(agentName: string): void {
    for (const [sid, meta] of this.sessions) {
      if (meta.agent === agentName) this.sessions.delete(sid);
    }
  }

  listForAgent(agentName: string): string[] {
    const ids: string[] = [];
    for (const [sid, meta] of this.sessions) {
      if (meta.agent === agentName) ids.push(sid);
    }
    return ids;
  }

  count(): number {
    return this.sessions.size;
  }

  has(sessionId: string, agentName: string): boolean {
    return this.sessions.get(sessionId)?.agent === agentName;
  }

  pruneExpired(ttlMs: number): string[] {
    if (ttlMs <= 0) return [];
    const now = Date.now();
    const removed: string[] = [];
    for (const [sid, meta] of this.sessions) {
      if (now - meta.lastUsed > ttlMs) {
        this.sessions.delete(sid);
        removed.push(sid);
      }
    }
    return removed;
  }
}

let defaultManager: AcpManager | null = null;

export function getAcpManager(): AcpManager {
  if (!defaultManager) defaultManager = new AcpManager();
  return defaultManager;
}

function parseMode(raw: unknown): AcpCursorMode | undefined {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "agent" || s === "plan" || s === "ask") return s;
  return undefined;
}

function defaultCursorDescription(agentName: string): string {
  if (agentName === "cursor") {
    return (
      "Cursor 编码代理，支持 Agent（直接修改代码）、Plan（先规划后执行）、Ask（只读分析）三种模式。" +
      "可搜索代码库、分析代码、运行测试、应用修改。同对话自动续用 session。" +
      "async=true 时后台执行并定时推送进度到消息通道。" +
      "遇到 Cursor 提问或方案审批时，结果会含 pending 字段；可自主决策或 clarify 询问天空，" +
      "再通过 continue_session=true 继续同一 session。"
    );
  }
  return `ACP agent: ${agentName}（默认绑定当前逸灵风对话；continue_session 自动续用）`;
}

function parseTimeoutMinutes(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_ASYNC_TIMEOUT_MINUTES;
  return Math.min(Math.floor(n), 24 * 60);
}

function buildPromptText(
  prompt: string,
  context: string,
  resolved: { newSession: boolean },
  mode: AcpCursorMode,
): string {
  let promptText = prompt;
  if (context) promptText += `\n\nContext: ${context}`;
  if (resolved.newSession && mode === "plan") {
    promptText =
      `## Goal\n${promptText}\n\n## Instructions\n` +
      "First, analyze and create a detailed plan. " +
      "After creating the plan, stop and wait for approval. " +
      "Do NOT execute the plan yet.";
  }
  return promptText;
}

function registerAcpBuiltinSkills(skills: SkillRegistry): void {
  const dir = join(import.meta.dir, "..", "skills");
  const count = registerSkillsFromDirectory(skills, dir, { source: ACP_SKILLS_SOURCE });
  if (count > 0) {
    logComponent("acp").info(`已注册 ${count} 个 ACP 内置 Skill`, {
      count,
      source: ACP_SKILLS_SOURCE,
    });
  }
}

export class AcpManager {
  private readonly clients = new Map<string, ACPClient>();
  private readonly sessionStore = new ACPSessionStore();
  private readonly agentQueues = new Map<string, AcpAgentQueue>();
  private readonly agentErrors = new Map<string, string>();
  private readonly starting = new Set<string>();
  private readonly healthTimers = new Map<string, ReturnType<typeof setInterval>>();
  private toolsRegistered = false;
  private closed = false;
  private startTask: Promise<void> | null = null;
  private conversation: ConversationService | null = null;
  private progressDelivery: AcpProgressDeliveryPort | null = null;
  private readonly taskStore = new AcpAsyncTaskStore();
  private readonly taskAbortControllers = new Map<string, AbortController>();
  /** agentName → taskId 或 "sync" */
  private readonly activePromptByAgent = new Map<string, string>();
  private progressTicker: ReturnType<typeof setInterval> | null = null;
  private tools: ToolRegistry | null = null;
  private skills: SkillRegistry | null = null;

  wireRegistries(opts: { tools: ToolRegistry; skills: SkillRegistry }): void {
    this.tools = opts.tools;
    this.skills = opts.skills;
  }

  wireConversation(conversation: ConversationService): void {
    this.conversation = conversation;
  }

  wireProgressDelivery(port: AcpProgressDeliveryPort): void {
    this.progressDelivery = port;
  }

  startProgressTicker(intervalMs = DEFAULT_PROGRESS_INTERVAL_MS): void {
    if (this.progressTicker) return;
    this.progressTicker = setInterval(() => {
      void this.pollProgress();
    }, intervalMs);
  }

  stopProgressTicker(): void {
    if (!this.progressTicker) return;
    clearInterval(this.progressTicker);
    this.progressTicker = null;
  }

  private conv(): ConversationService {
    if (!this.conversation) {
      throw new Error("AcpManager: conversation 未绑定，请先 wireConversation");
    }
    return this.conversation;
  }

  private queueFor(agentName: string): AcpAgentQueue {
    let q = this.agentQueues.get(agentName);
    if (!q) {
      q = new AcpAgentQueue();
      this.agentQueues.set(agentName, q);
    }
    return q;
  }

  registerTools(agentsCfg?: Record<string, AcpAgentConfig>): number {
    if (this.toolsRegistered && !agentsCfg) return 0;
    if (!this.tools || !this.skills) {
      throw new Error("AcpManager: tools/skills 未绑定，请先 wireRegistries");
    }
    const cfg = loadConfig();
    const agents = agentsCfg ?? cfg.acp_agents ?? {};
    if (!Object.keys(agents).length) return 0;

    registerAcpBuiltinSkills(this.skills);

    let count = 0;
    for (const [agentName, agentCfg] of Object.entries(agents)) {
      const toolName = `acp_${agentName}`;
      const description = agentCfg.description ?? defaultCursorDescription(agentName);

      this.tools.register({
        name: toolName,
        description,
        toolset: `acp:${agentName}`,
        parameters: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "发送给 Cursor 的指令或回复。多轮交互中可为任务描述、问题回答或继续对话。",
            },
            goal: {
              type: "string",
              description: "（已废弃，请用 prompt）任务目标描述。",
            },
            context: {
              type: "string",
              description: "任务上下文：项目路径、相关文件、约束条件、模式说明等。",
              default: "",
            },
            mode: {
              type: "string",
              enum: ["agent", "plan", "ask"],
              description:
                "Cursor 模式：agent=直接修改执行，plan=先出方案，ask=只读分析。默认 agent。",
              default: "agent",
            },
            continue_session: {
              type: "boolean",
              description:
                "为 true 时自动续用当前逸灵风对话最近一次 acp session，无需手动传 session_id。",
              default: false,
            },
            session_id: {
              type: "string",
              description:
                "显式 ACP session ID（优先于逸灵风绑定）。一般无需填写，continue_session 或同对话自动续用。",
              default: "",
            },
            new_session: {
              type: "boolean",
              description:
                "为 true 时强制新建 ACP session，并更新当前逸灵风 session 对该 agent 的绑定。",
              default: false,
            },
            async: {
              type: "boolean",
              description:
                "异步执行：立即返回 task_id，后台运行 Cursor 任务，进度通过消息通道定时推送。",
              default: false,
            },
            timeout_minutes: {
              type: "integer",
              description: "异步模式最大运行时间（分钟），默认 30。",
              default: DEFAULT_ASYNC_TIMEOUT_MINUTES,
            },
            cancel: {
              type: "string",
              description: "取消指定 task_id 的异步任务。",
              default: "",
            },
          },
          required: [],
        },
        handler: (args) => {
          const cancelId = String(args.cancel ?? "").trim();
          if (cancelId) return this.cancelAsyncTask(cancelId);

          const prompt = String(args.prompt ?? args.goal ?? "").trim();
          if (!prompt) return toolError("prompt（或 goal）不能为空");
          const context = String(args.context ?? "");
          const explicitSid = String(args.session_id ?? "").trim() || undefined;
          const newSession = args.new_session === true || args.new_session === "true";
          const continueSession =
            args.continue_session === true || args.continue_session === "true";
          const mode = parseMode(args.mode) ?? "agent";
          const isAsync = args.async === true || args.async === "true";
          const timeoutMinutes = parseTimeoutMinutes(args.timeout_minutes);
          const animaSid = getToolSessionId();

          if (isAsync) {
            return this.queueFor(agentName).run(() =>
              this.launchAsync(
                agentName,
                prompt,
                context,
                {
                  animaSessionId: animaSid,
                  acpSessionId: explicitSid,
                  newSession,
                  continueSession,
                  mode,
                },
                timeoutMinutes,
              ),
            );
          }

          return this.queueFor(agentName).run(() =>
            this.handleAcpPrompt(agentName, prompt, context, {
              animaSessionId: animaSid,
              acpSessionId: explicitSid,
              newSession,
              continueSession,
              mode,
            }),
          );
        },
      });
      count += 1;
    }
    this.toolsRegistered = true;
    return count;
  }

  getStatus(): AcpStatusResponse {
    const cfg = loadConfig();
    const agents = cfg.acp_agents ?? {};
    const views: AcpAgentStatusView[] = [];

    for (const [name, agentCfg] of Object.entries(agents)) {
      const client = this.clients.get(name);
      let status: AcpAgentStatusView["status"] = "not_started";
      if (!isAcpAgentEnabled(agentCfg)) status = "disabled";
      else if (this.starting.has(name)) status = "starting";
      else if (client?.isConnected && client.isProcessAlive()) status = "connected";
      else if (this.agentErrors.has(name)) status = "error";

      const registered = this.tools!.list().find((t) => t.name === `acp_${name}`);
      const sessionIds = this.sessionStore.listForAgent(name);

      views.push({
        name,
        config: sanitizeAcpConfig(agentCfg),
        status,
        error: this.agentErrors.get(name),
        tool: registered ? { name: registered.name, description: registered.description } : null,
        sessions: sessionIds.map((session_id) => ({
          session_id,
          session_id_short: shortSessionId(session_id),
          agent: name,
        })),
      });
    }

    const connected_count = views.filter((a) => a.status === "connected").length;
    return {
      agent_count: views.length,
      connected_count,
      session_count: this.sessionStore.count(),
      tool_count: this.tools!.list().filter((t) => t.toolset?.startsWith("acp:")).length,
      agents: views,
    };
  }

  async startAgent(name: string): Promise<AcpControlResult> {
    const agentCfg = this.getAgentConfig(name);
    if (!agentCfg) {
      return {
        ok: false,
        error: `ACP agent '${name}' not configured`,
        agent: name,
        action: "start",
      };
    }
    if (!isAcpAgentEnabled(agentCfg)) {
      return { ok: false, error: `ACP agent '${name}' is disabled`, agent: name, action: "start" };
    }
    if (this.clients.get(name)?.isConnected && this.clients.get(name)?.isProcessAlive()) {
      return { ok: true, agent: name, action: "start" };
    }
    if (this.starting.has(name)) {
      return { ok: true, agent: name, action: "start" };
    }

    this.starting.add(name);
    this.agentErrors.delete(name);
    try {
      await this.getOrStartClient(name, agentCfg);
      return { ok: true, agent: name, action: "start" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.agentErrors.set(name, msg);
      return { ok: false, error: msg, agent: name, action: "start" };
    } finally {
      this.starting.delete(name);
    }
  }

  async stopAgent(name: string): Promise<AcpControlResult> {
    if (this.starting.has(name)) {
      return {
        ok: false,
        error: `ACP agent '${name}' is starting`,
        agent: name,
        action: "stop",
      };
    }

    this.stopHealthCheck(name);
    const client = this.clients.get(name);
    if (client) {
      client.stop();
      this.clients.delete(name);
    }
    this.agentErrors.delete(name);
    this.sessionStore.removeByAgent(name);
    return { ok: true, agent: name, action: "stop" };
  }

  /** 后台并行连接已启用的 ACP Agent，不阻塞 HTTP 启动 */
  startAllAsync(agentsCfg?: Record<string, AcpAgentConfig>): void {
    if (this.startTask || this.closed) return;
    this.startTask = this.runStartAll(agentsCfg, { enabledOnly: true }).finally(() => {
      this.startTask = null;
    });
    void this.startTask.catch((err) => {
      logComponent("acp").error("ACP background startup failed", { err });
    });
  }

  private async runStartAll(
    agentsCfg?: Record<string, AcpAgentConfig>,
    opts?: { enabledOnly: boolean },
  ): Promise<void> {
    const cfg = loadConfig();
    const agents = agentsCfg ?? cfg.acp_agents ?? {};
    const names = Object.entries(agents)
      .filter(([, agentCfg]) => !opts?.enabledOnly || isAcpAgentEnabled(agentCfg))
      .map(([name]) => name);

    const results = await Promise.allSettled(names.map((name) => this.startAgent(name)));
    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      const agentName = names[i]!;
      if (result.status === "rejected") {
        logComponent("acp").error(`ACP agent '${agentName}' startup failed`, {
          err: result.reason,
          agent: agentName,
        });
      } else if (!result.value.ok) {
        logComponent("acp").error(`ACP agent '${agentName}' startup failed`, {
          error: result.value.error ?? "unknown",
          agent: agentName,
        });
      }
    }
  }

  async startAll(): Promise<AcpControlResult> {
    const cfg = loadConfig();
    const agents = cfg.acp_agents ?? {};
    const names = Object.keys(agents).filter((name) => isAcpAgentEnabled(agents[name]!));
    const errors: string[] = [];

    await Promise.allSettled(
      names.map(async (name) => {
        const result = await this.startAgent(name);
        if (!result.ok && result.error) errors.push(`${name}: ${result.error}`);
      }),
    );

    if (errors.length) {
      return { ok: false, action: "start", error: errors.join("; ") };
    }
    return { ok: true, action: "start" };
  }

  async stopAll(): Promise<AcpControlResult> {
    this.closed = true;
    this.stopProgressTicker();
    for (const task of this.taskStore.listRunning()) {
      this.cancelAsyncTaskInternal(task.taskId, "service shutdown");
    }
    const names = [...this.clients.keys()];
    if (names.length) {
      logComponent("shutdown").debug(`ACP 停止 ${names.length} 个 agent: ${names.join(", ")}…`, {
        count: names.length,
        agents: names,
      });
    }
    for (const name of names) {
      const ts = Date.now();
      await this.stopAgent(name);
      logComponent("shutdown").debug(`ACP '${name}' 已停止`, { ms: Date.now() - ts, agent: name });
    }
    return { ok: true, action: "stop" };
  }

  private getAgentConfig(name: string): AcpAgentConfig | undefined {
    const cfg = loadConfig();
    const agents = cfg.acp_agents;
    return agents?.[name];
  }

  private stopHealthCheck(name: string): void {
    const timer = this.healthTimers.get(name);
    if (timer) {
      clearInterval(timer);
      this.healthTimers.delete(name);
    }
  }

  private startHealthCheck(name: string, agentCfg: AcpAgentConfig): void {
    this.stopHealthCheck(name);
    const interval = agentCfg.health_check_interval_ms ?? DEFAULT_HEALTH_CHECK_MS;
    if (interval <= 0) return;

    const timer = setInterval(() => {
      void this.runHealthCheck(name, agentCfg);
    }, interval);
    this.healthTimers.set(name, timer);
  }

  private async runHealthCheck(name: string, agentCfg: AcpAgentConfig): Promise<void> {
    const client = this.clients.get(name);
    if (!client) return;

    const ttl = agentCfg.session_ttl_ms ?? 0;
    if (ttl > 0) {
      const expired = this.sessionStore.pruneExpired(ttl);
      for (const sid of expired) {
        try {
          await client.closeSession(sid);
        } catch {
          /* ignore */
        }
      }
    }

    if (client.isConnected && client.isProcessAlive()) return;

    logComponent("acp").warn(`ACP agent '${name}' 进程异常，尝试重启`, { agent: name });
    this.clients.delete(name);
    if (agentCfg.auto_restart === false) {
      this.agentErrors.set(name, "process died");
      return;
    }

    try {
      await this.getOrStartClient(name, agentCfg);
      const sessions = this.sessionStore.listForAgent(name);
      if (sessions.length) {
        logComponent("acp").info(`ACP '${name}' 已重启，${sessions.length} 个 session 待续用验证`, {
          agent: name,
          sessions: sessions.length,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.agentErrors.set(name, msg);
    }
  }

  private async getOrStartClient(name: string, agentCfg: AcpAgentConfig): Promise<ACPClient> {
    const existing = this.clients.get(name);
    if (existing?.isConnected && existing.isProcessAlive()) return existing;
    if (existing) {
      existing.stop();
      this.clients.delete(name);
    }

    const command = agentCfg.command ?? "";
    if (!command) throw new Error(`ACP agent '${name}' missing command`);

    const client = new ACPClient(name, command, agentCfg.args ?? [], agentCfg.cwd, agentCfg);
    await client.start();
    this.clients.set(name, client);
    this.agentErrors.delete(name);
    this.startHealthCheck(name, agentCfg);
    return client;
  }

  private async resolveAcpSession(
    client: ACPClient,
    agentName: string,
    agentCfg: AcpAgentConfig,
    opts: AcpPromptOptions,
  ): Promise<{ id: string; newSession: boolean; reusedBinding: boolean; explicit: boolean }> {
    if (opts.acpSessionId) {
      const id = opts.acpSessionId;
      if (!this.sessionStore.has(id, agentName)) {
        this.sessionStore.add(id, agentName);
      } else {
        this.sessionStore.touch(id);
      }
      return { id, newSession: false, reusedBinding: false, explicit: true };
    }

    if (opts.newSession) {
      const id = await this.createAcpSession(client, agentName, agentCfg, opts.animaSessionId);
      return { id, newSession: true, reusedBinding: false, explicit: false };
    }

    if (opts.continueSession && opts.animaSessionId) {
      const bound = await getBoundAcpSession(this.conv(), opts.animaSessionId, agentName);
      if (bound) {
        if (this.sessionStore.has(bound, agentName)) {
          this.sessionStore.touch(bound);
          return { id: bound, newSession: false, reusedBinding: true, explicit: false };
        }
        const retried = await this.tryContinueOrRecreate(
          client,
          agentName,
          agentCfg,
          opts.animaSessionId,
          bound,
          opts.mode ?? "agent",
        );
        return { ...retried, reusedBinding: !retried.newSession, explicit: false };
      }
    }

    if (opts.animaSessionId) {
      const bound = await getBoundAcpSession(this.conv(), opts.animaSessionId, agentName);
      if (bound) {
        if (this.sessionStore.has(bound, agentName)) {
          this.sessionStore.touch(bound);
          return { id: bound, newSession: false, reusedBinding: true, explicit: false };
        }
        const retried = await this.tryContinueOrRecreate(
          client,
          agentName,
          agentCfg,
          opts.animaSessionId,
          bound,
          opts.mode ?? "agent",
        );
        return { ...retried, reusedBinding: !retried.newSession, explicit: false };
      }
    }

    const id = await this.createAcpSession(client, agentName, agentCfg, opts.animaSessionId);
    return { id, newSession: true, reusedBinding: false, explicit: false };
  }

  /** 绑定在 meta 但进程内未登记（如重启后）— 先试续用，失败则新建 */
  private async tryContinueOrRecreate(
    client: ACPClient,
    agentName: string,
    agentCfg: AcpAgentConfig,
    animaSessionId: string,
    boundId: string,
    mode: AcpCursorMode,
  ): Promise<{ id: string; newSession: boolean }> {
    try {
      await client.setMode(boundId, mode);
      this.sessionStore.add(boundId, agentName);
      return { id: boundId, newSession: false };
    } catch {
      /* 会话可能已失效 */
    }
    try {
      await client.closeSession(boundId);
    } catch {
      /* ignore */
    }
    const id = await this.createAcpSession(client, agentName, agentCfg, animaSessionId);
    return { id, newSession: true };
  }

  private async createAcpSession(
    client: ACPClient,
    agentName: string,
    agentCfg: AcpAgentConfig,
    animaSessionId?: string,
  ): Promise<string> {
    const sid = await client.createSession(agentCfg.cwd);
    this.sessionStore.add(sid, agentName);
    if (animaSessionId) {
      await bindAcpSession(this.conv(), animaSessionId, agentName, sid);
    }
    return sid;
  }

  private agentBusyError(agentName: string): string {
    const active = this.activePromptByAgent.get(agentName);
    return toolResult({
      error: `ACP agent '${agentName}' 忙碌中`,
      active_task_id: active,
    });
  }

  private async preparePromptSession(
    agentName: string,
    agentCfg: AcpAgentConfig,
    opts: AcpPromptOptions,
  ): Promise<{
    client: ACPClient;
    sid: string;
    resolved: { id: string; newSession: boolean; reusedBinding: boolean; explicit: boolean };
    mode: AcpCursorMode;
  }> {
    const client = await this.getOrStartClient(agentName, agentCfg);
    const mode = opts.mode ?? "agent";

    const previousBound =
      opts.newSession && opts.animaSessionId
        ? await getBoundAcpSession(this.conv(), opts.animaSessionId, agentName)
        : undefined;

    const resolved = await this.resolveAcpSession(client, agentName, agentCfg, opts);
    const sid = resolved.id;
    this.sessionStore.touch(sid);

    if (previousBound && previousBound !== sid) {
      try {
        await client.closeSession(previousBound);
      } catch {
        /* ignore */
      }
      this.sessionStore.remove(previousBound);
    }

    await client.setMode(sid, mode);
    return { client, sid, resolved, mode };
  }

  private async launchAsync(
    agentName: string,
    prompt: string,
    context: string,
    opts: AcpPromptOptions,
    timeoutMinutes: number,
  ): Promise<string> {
    const agentCfg = this.getAgentConfig(agentName);
    if (!agentCfg) {
      return toolError(`ACP agent '${agentName}' not configured`);
    }
    if (!opts.animaSessionId) {
      return toolError("异步模式需要有效的逸灵风 session");
    }

    const activeTask = this.taskStore.findActive(agentName);
    if (activeTask) {
      return toolResult({
        error: `ACP agent '${agentName}' 已有运行中的异步任务`,
        active_task_id: activeTask.taskId,
      });
    }
    if (this.activePromptByAgent.has(agentName)) {
      return this.agentBusyError(agentName);
    }

    try {
      const { client, sid, resolved, mode } = await this.preparePromptSession(
        agentName,
        agentCfg,
        opts,
      );
      const promptText = buildPromptText(prompt, context, resolved, mode);
      const now = Date.now();
      const taskId = createTaskId();
      const task: AcpAsyncTask = {
        taskId,
        agentName,
        acpSessionId: sid,
        animaSessionId: opts.animaSessionId,
        mode,
        status: "running",
        startedAt: now,
        lastProgressAt: now,
        progressNotes: [],
        lastDeliveredAt: 0,
        timeoutAt: now + timeoutMinutes * 60_000,
      };
      this.taskStore.set(task);
      this.activePromptByAgent.set(agentName, taskId);
      const ac = new AbortController();
      this.taskAbortControllers.set(taskId, ac);

      void this.runAsyncPrompt(task, client, promptText, resolved, mode).catch((err) => {
        logComponent("acp").error("异步 ACP 任务异常", { taskId, err });
      });

      return toolResult({
        task_id: taskId,
        status: "started",
        session_id: sid,
        hint: "进度将通过消息通道推送；完成后推送最终结果",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.agentErrors.set(agentName, msg);
      return toolError(msg);
    }
  }

  private async runAsyncPrompt(
    task: AcpAsyncTask,
    client: ACPClient,
    promptText: string,
    resolved: { newSession: boolean; reusedBinding: boolean; explicit: boolean },
    mode: AcpCursorMode,
  ): Promise<void> {
    const { taskId, agentName, acpSessionId } = task;
    const abort = this.taskAbortControllers.get(taskId);
    const remainingMs = Math.max(task.timeoutAt - Date.now(), 1_000);

    try {
      const output = await client.sendPromptWithOptions(acpSessionId, promptText, {
        promptTimeoutMs: remainingMs,
        abortSignal: abort?.signal,
        onNotification: (_note, parsed) => {
          if (parsed) appendProgressNote(task, parsed);
        },
      });
      const capture = client.takeLastPromptCapture();
      const result: AcpPromptResult = {
        session_id: acpSessionId,
        output: output.trim() || "[empty response]",
        new_session: resolved.newSession,
        reused_binding: resolved.reusedBinding,
        explicit_session: resolved.explicit,
        mode,
      };
      if (capture?.pending.length) {
        result.pending = capture.pending;
      }
      task.result = result;
      task.status = "completed";
      task.lastProgressAt = Date.now();
      await this.deliverTaskResult(task, result);
    } catch (e) {
      if (task.status === "cancelled") return;
      const msg = e instanceof Error ? e.message : String(e);
      if (abort?.signal.aborted || msg.includes("aborted")) {
        task.status = "cancelled";
        task.error = "任务已取消";
        await this.deliverTaskError(task, task.error);
      } else if (msg.includes("timed out")) {
        task.status = "timed_out";
        task.error = msg;
        try {
          await client.closeSession(acpSessionId);
        } catch {
          /* ignore */
        }
        await this.deliverTaskError(task, `任务超时: ${msg}`);
      } else {
        task.status = "error";
        task.error = msg;
        this.agentErrors.set(agentName, msg);
        await this.deliverTaskError(task, msg);
      }
    } finally {
      this.releaseAsyncTask(taskId, agentName);
    }
  }

  private releaseAsyncTask(taskId: string, agentName: string): void {
    this.taskAbortControllers.delete(taskId);
    if (this.activePromptByAgent.get(agentName) === taskId) {
      this.activePromptByAgent.delete(agentName);
    }
  }

  private cancelAsyncTask(taskId: string): string {
    const task = this.taskStore.get(taskId);
    if (!task) return toolError(`未找到任务: ${taskId}`);
    if (task.status !== "running") {
      return toolResult({ task_id: taskId, status: task.status });
    }
    this.cancelAsyncTaskInternal(taskId, "user cancelled");
    return toolResult({ task_id: taskId, status: "cancelled" });
  }

  private cancelAsyncTaskInternal(taskId: string, reason: string): void {
    const task = this.taskStore.get(taskId);
    if (!task || task.status !== "running") return;
    task.status = "cancelled";
    task.error = reason;
    const ac = this.taskAbortControllers.get(taskId);
    ac?.abort();
    const client = this.clients.get(task.agentName);
    client?.abortActivePrompt();
    void this.deliverTaskError(task, reason);
  }

  async pollProgress(): Promise<void> {
    const port = this.progressDelivery;
    if (!port) return;

    for (const task of this.taskStore.listRunning()) {
      if (task.lastProgressAt <= task.lastDeliveredAt && task.lastDeliveredAt > 0) continue;
      const body = formatProgressBody(task);
      try {
        const res = await port.deliverProgress(toTaskSnapshot(task), body);
        if (res?.progressMessageId) task.progressMessageId = res.progressMessageId;
        task.lastDeliveredAt = Date.now();
      } catch (e) {
        logComponent("acp").warn("ACP 进度推送失败", { taskId: task.taskId, err: e });
      }
    }
  }

  private async deliverTaskResult(task: AcpAsyncTask, result: AcpPromptResult): Promise<void> {
    const port = this.progressDelivery;
    if (!port) return;
    try {
      await port.deliverResult(toTaskSnapshot(task), result);
    } catch (e) {
      logComponent("acp").warn("ACP 结果推送失败", { taskId: task.taskId, err: e });
    }
  }

  private async deliverTaskError(task: AcpAsyncTask, message: string): Promise<void> {
    const port = this.progressDelivery;
    if (!port) return;
    try {
      await port.deliverError(toTaskSnapshot(task), message);
    } catch (e) {
      logComponent("acp").warn("ACP 错误推送失败", { taskId: task.taskId, err: e });
    }
  }

  private async handleAcpPrompt(
    agentName: string,
    prompt: string,
    context: string,
    opts: AcpPromptOptions,
  ): Promise<string> {
    const agentCfg = this.getAgentConfig(agentName);
    if (!agentCfg) {
      return toolError(`ACP agent '${agentName}' not configured`);
    }

    if (this.activePromptByAgent.has(agentName)) {
      return this.agentBusyError(agentName);
    }
    this.activePromptByAgent.set(agentName, "sync");

    const mode = opts.mode ?? "agent";

    try {
      const { client, sid, resolved } = await this.preparePromptSession(agentName, agentCfg, opts);
      const promptText = buildPromptText(prompt, context, resolved, mode);
      const output = await client.sendPrompt(sid, promptText);
      const capture = client.takeLastPromptCapture();

      const result: AcpPromptResult = {
        session_id: sid,
        output: output.trim() || "[empty response]",
        new_session: resolved.newSession,
        reused_binding: resolved.reusedBinding,
        explicit_session: resolved.explicit,
        mode,
      };
      if (capture?.pending.length) {
        result.pending = capture.pending;
      }
      return formatAcpPromptResult(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.agentErrors.set(agentName, msg);
      if (opts.animaSessionId && !opts.acpSessionId && !opts.continueSession) {
        await unbindAcpSession(this.conv(), opts.animaSessionId, agentName);
      }
      return toolError(msg);
    } finally {
      if (this.activePromptByAgent.get(agentName) === "sync") {
        this.activePromptByAgent.delete(agentName);
      }
    }
  }
}

export function registerAcpTools(agentsCfg?: Record<string, AcpAgentConfig>): number {
  return getAcpManager().registerTools(agentsCfg);
}

export { ACPClient, ACPError } from "./client.ts";
export { ACPSessionStore };
