import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { PATHS } from "@freeanima/service-config";
import { getToolSessionId } from "@freeanima/engine-loop";
import { listTools, registerTool, toolError } from "@freeanima/engine-tool";
import { loadConfig } from "@freeanima/service-config";
import { logComponent } from "@freeanima/service-logging";

import type { ConversationService } from "@freeanima/engine-conversation";
import { AcpAgentQueue } from "./agent-queue.ts";
import { ACPClient } from "./client.ts";
import { bindAcpSession, getBoundAcpSession, unbindAcpSession } from "./nest-binding.ts";
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
const BUILTIN_SKILL_NAME = "acp-cursor";

type AcpPromptOptions = {
  nestSessionId?: string;
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
      "遇到 Cursor 提问或方案审批时，结果会含 pending 字段；可自主决策或 clarify 询问天空，" +
      "再通过 continue_session=true 继续同一 session。"
    );
  }
  return `ACP agent: ${agentName}（默认绑定当前逸灵风对话；continue_session 自动续用）`;
}

function seedBuiltinSkill(): void {
  const skillPath = join(PATHS.home, "skills", `${BUILTIN_SKILL_NAME}.md`);
  if (existsSync(skillPath)) return;
  const bundled = join(import.meta.dir, "..", "skills", `${BUILTIN_SKILL_NAME}.md`);
  if (!existsSync(bundled)) return;
  try {
    mkdirSync(dirname(skillPath), { recursive: true });
    writeFileSync(skillPath, readFileSync(bundled, "utf-8"), "utf-8");
    logComponent("acp").info(`已安装内置 Skill: ${BUILTIN_SKILL_NAME}`);
  } catch (e) {
    logComponent("acp").warn("安装内置 Skill 失败", { err: e });
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

  wireConversation(conversation: ConversationService): void {
    this.conversation = conversation;
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
    const cfg = loadConfig();
    const agents = agentsCfg ?? cfg.acp_agents ?? {};
    if (!Object.keys(agents).length) return 0;

    seedBuiltinSkill();

    let count = 0;
    for (const [agentName, agentCfg] of Object.entries(agents)) {
      const toolName = `acp_${agentName}`;
      const description = agentCfg.description ?? defaultCursorDescription(agentName);

      registerTool({
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
          },
          required: [],
        },
        handler: (args) => {
          const prompt = String(args.prompt ?? args.goal ?? "").trim();
          if (!prompt) return toolError("prompt（或 goal）不能为空");
          const context = String(args.context ?? "");
          const explicitSid = String(args.session_id ?? "").trim() || undefined;
          const newSession = args.new_session === true || args.new_session === "true";
          const continueSession =
            args.continue_session === true || args.continue_session === "true";
          const mode = parseMode(args.mode) ?? "agent";
          const nestSid = getToolSessionId();
          return this.queueFor(agentName).run(() =>
            this.handleAcpPrompt(agentName, prompt, context, {
              nestSessionId: nestSid,
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

      const registered = listTools().find((t) => t.name === `acp_${name}`);
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
      tool_count: listTools().filter((t) => t.toolset?.startsWith("acp:")).length,
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
      const id = await this.createAcpSession(client, agentName, agentCfg, opts.nestSessionId);
      return { id, newSession: true, reusedBinding: false, explicit: false };
    }

    if (opts.continueSession && opts.nestSessionId) {
      const bound = await getBoundAcpSession(this.conv(), opts.nestSessionId, agentName);
      if (bound) {
        if (this.sessionStore.has(bound, agentName)) {
          this.sessionStore.touch(bound);
          return { id: bound, newSession: false, reusedBinding: true, explicit: false };
        }
        const retried = await this.tryContinueOrRecreate(
          client,
          agentName,
          agentCfg,
          opts.nestSessionId,
          bound,
          opts.mode ?? "agent",
        );
        return { ...retried, reusedBinding: !retried.newSession, explicit: false };
      }
    }

    if (opts.nestSessionId) {
      const bound = await getBoundAcpSession(this.conv(), opts.nestSessionId, agentName);
      if (bound) {
        if (this.sessionStore.has(bound, agentName)) {
          this.sessionStore.touch(bound);
          return { id: bound, newSession: false, reusedBinding: true, explicit: false };
        }
        const retried = await this.tryContinueOrRecreate(
          client,
          agentName,
          agentCfg,
          opts.nestSessionId,
          bound,
          opts.mode ?? "agent",
        );
        return { ...retried, reusedBinding: !retried.newSession, explicit: false };
      }
    }

    const id = await this.createAcpSession(client, agentName, agentCfg, opts.nestSessionId);
    return { id, newSession: true, reusedBinding: false, explicit: false };
  }

  /** 绑定在 meta 但进程内未登记（如重启后）— 先试续用，失败则新建 */
  private async tryContinueOrRecreate(
    client: ACPClient,
    agentName: string,
    agentCfg: AcpAgentConfig,
    nestSessionId: string,
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
    const id = await this.createAcpSession(client, agentName, agentCfg, nestSessionId);
    return { id, newSession: true };
  }

  private async createAcpSession(
    client: ACPClient,
    agentName: string,
    agentCfg: AcpAgentConfig,
    nestSessionId?: string,
  ): Promise<string> {
    const sid = await client.createSession(agentCfg.cwd);
    this.sessionStore.add(sid, agentName);
    if (nestSessionId) {
      await bindAcpSession(this.conv(), nestSessionId, agentName, sid);
    }
    return sid;
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

    const mode = opts.mode ?? "agent";

    try {
      const client = await this.getOrStartClient(agentName, agentCfg);

      const previousBound =
        opts.newSession && opts.nestSessionId
          ? await getBoundAcpSession(this.conv(), opts.nestSessionId, agentName)
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

      let promptText = prompt;
      if (context) promptText += `\n\nContext: ${context}`;

      if (resolved.newSession && mode === "plan") {
        promptText =
          `## Goal\n${promptText}\n\n## Instructions\n` +
          "First, analyze and create a detailed plan. " +
          "After creating the plan, stop and wait for approval. " +
          "Do NOT execute the plan yet.";
      }

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
      if (opts.nestSessionId && !opts.acpSessionId && !opts.continueSession) {
        await unbindAcpSession(this.conv(), opts.nestSessionId, agentName);
      }
      return toolError(msg);
    }
  }
}

export function registerAcpTools(agentsCfg?: Record<string, AcpAgentConfig>): number {
  return getAcpManager().registerTools(agentsCfg);
}

export { ACPClient, ACPError } from "./client.ts";
export { ACPSessionStore };
