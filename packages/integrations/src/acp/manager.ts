import { getToolSessionId } from "@freeanima/legacy-engine";
import { listTools, loadConfig, logComponent, registerTool, toolError } from "@freeanima/legacy-kernel";

import { AcpAgentQueue } from "./agent-queue";
import { resolveAcpAdapter } from "./adapters/registry";
import { ACPClient } from "./client";
import {
  bindAcpSession,
  getBoundAcpSession,
  unbindAcpSession,
} from "./nest-binding";
import { formatAcpPromptResult, type AcpPromptResult } from "./prompt-result";
import {
  sanitizeAcpConfig,
  shortSessionId,
  isAcpAgentEnabled,
  type AcpAgentConfig,
  type AcpControlResult,
  type AcpAgentStatusView,
  type AcpStatusResponse,
} from "./status";

type AcpPromptOptions = {
  nestSessionId?: string;
  acpSessionId?: string;
  newSession?: boolean;
};

class ACPSessionStore {
  private sessions = new Map<string, { agent: string }>();

  add(sessionId: string, agentName: string): void {
    this.sessions.set(sessionId, { agent: agentName });
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
}

let defaultManager: AcpManager | null = null;

export function getAcpManager(): AcpManager {
  if (!defaultManager) defaultManager = new AcpManager();
  return defaultManager;
}

export class AcpManager {
  private readonly clients = new Map<string, ACPClient>();
  private readonly sessionStore = new ACPSessionStore();
  private readonly agentQueues = new Map<string, AcpAgentQueue>();
  private readonly agentErrors = new Map<string, string>();
  private readonly starting = new Set<string>();
  private toolsRegistered = false;
  private closed = false;
  private startTask: Promise<void> | null = null;

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
    const agents =
      agentsCfg ?? cfg.acp_agents ?? {};
    if (!Object.keys(agents).length) return 0;

    let count = 0;
    for (const [agentName, agentCfg] of Object.entries(agents)) {
      const toolName = `acp_${agentName}`;
      const description =
        agentCfg.description ??
        `ACP agent: ${agentName}（默认绑定当前逸灵风对话；new_session 强制新开）`;

      registerTool({
        name: toolName,
        description,
        toolset: `acp:${agentName}`,
        parameters: {
          type: "object",
          properties: {
            goal: {
              type: "string",
              description: "任务目标描述。清晰说明要做什么。",
            },
            context: {
              type: "string",
              description: "任务上下文/背景信息。项目路径、相关文件、约束条件等。",
              default: "",
            },
            session_id: {
              type: "string",
              description:
                "显式 ACP session ID（优先于逸灵风绑定）。一般无需填写，同对话会自动续用。",
              default: "",
            },
            new_session: {
              type: "boolean",
              description:
                "为 true 时强制新建 ACP session，并更新当前逸灵风 session 对该 agent 的绑定。",
              default: false,
            },
          },
          required: ["goal"],
        },
        handler: (args) => {
          const goal = String(args.goal ?? "");
          const context = String(args.context ?? "");
          const explicitSid = String(args.session_id ?? "").trim() || undefined;
          const newSession = args.new_session === true || args.new_session === "true";
          const nestSid = getToolSessionId();
          return this.queueFor(agentName).run(() =>
            this.handleAcpPrompt(agentName, goal, context, {
              nestSessionId: nestSid,
              acpSessionId: explicitSid,
              newSession,
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
      else if (client?.isConnected) status = "connected";
      else if (this.agentErrors.has(name)) status = "error";

      const registered = listTools().find((t) => t.name === `acp_${name}`);
      const sessionIds = this.sessionStore.listForAgent(name);

      views.push({
        name,
        config: sanitizeAcpConfig(agentCfg),
        status,
        error: this.agentErrors.get(name),
        tool: registered
          ? { name: registered.name, description: registered.description }
          : null,
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
      return { ok: false, error: `ACP agent '${name}' not configured`, agent: name, action: "start" };
    }
    if (!isAcpAgentEnabled(agentCfg)) {
      return { ok: false, error: `ACP agent '${name}' is disabled`, agent: name, action: "start" };
    }
    if (this.clients.get(name)?.isConnected) {
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
      logComponent("shutdown").info(`ACP 停止 ${names.length} 个 agent: ${names.join(", ")}…`, {
        count: names.length,
        agents: names,
      });
    }
    for (const name of names) {
      const ts = Date.now();
      await this.stopAgent(name);
      logComponent("shutdown").info(`ACP '${name}' 已停止`, { ms: Date.now() - ts, agent: name });
    }
    return { ok: true, action: "stop" };
  }

  private getAgentConfig(name: string): AcpAgentConfig | undefined {
    const cfg = loadConfig();
    const agents = cfg.acp_agents;
    return agents?.[name];
  }

  private async getOrStartClient(name: string, agentCfg: AcpAgentConfig): Promise<ACPClient> {
    const existing = this.clients.get(name);
    if (existing?.isConnected) return existing;

    const command = agentCfg.command ?? "";
    if (!command) throw new Error(`ACP agent '${name}' missing command`);

    const client = new ACPClient(name, command, agentCfg.args ?? [], agentCfg.cwd, agentCfg);
    await client.start();
    this.clients.set(name, client);
    this.agentErrors.delete(name);
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
      }
      return { id, newSession: false, reusedBinding: false, explicit: true };
    }

    if (opts.newSession) {
      const id = await this.createAcpSession(client, agentName, agentCfg, opts.nestSessionId);
      return { id, newSession: true, reusedBinding: false, explicit: false };
    }

    if (opts.nestSessionId) {
      const bound = await getBoundAcpSession(opts.nestSessionId, agentName);
      if (bound) {
        if (this.sessionStore.has(bound, agentName)) {
          return { id: bound, newSession: false, reusedBinding: true, explicit: false };
        }
        const retried = await this.tryContinueOrRecreate(
          client,
          agentName,
          agentCfg,
          opts.nestSessionId,
          bound,
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
  ): Promise<{ id: string; newSession: boolean }> {
    try {
      await client.setMode(boundId, agentCfg.agent_mode ?? "agent");
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
      await bindAcpSession(nestSessionId, agentName, sid);
    }
    return sid;
  }

  private async handleAcpPrompt(
    agentName: string,
    goal: string,
    context: string,
    opts: AcpPromptOptions,
  ): Promise<string> {
    const agentCfg = this.getAgentConfig(agentName);
    if (!agentCfg) {
      return toolError(`ACP agent '${agentName}' not configured`);
    }

    try {
      const client = await this.getOrStartClient(agentName, agentCfg);
      const adapter = resolveAcpAdapter(agentCfg);
      const defaultAgentMode = adapter.id === "cursor" ? "agent" : "code";
      const defaultPlanMode = adapter.id === "cursor" ? false : "architect";

      const previousBound =
        opts.newSession && opts.nestSessionId
          ? await getBoundAcpSession(opts.nestSessionId, agentName)
          : undefined;

      const resolved = await this.resolveAcpSession(client, agentName, agentCfg, opts);
      const sid = resolved.id;

      if (previousBound && previousBound !== sid) {
        try {
          await client.closeSession(previousBound);
        } catch {
          /* ignore */
        }
        this.sessionStore.remove(previousBound);
      }

      const isFirstTurnInSession = resolved.newSession;

      let output: string;
      if (isFirstTurnInSession) {
        output = await this.runInitialPrompt(
          client,
          sid,
          goal,
          context,
          agentCfg,
          defaultPlanMode,
          defaultAgentMode,
        );
      } else {
        const agentMode = agentCfg.agent_mode ?? defaultAgentMode;
        await client.setMode(sid, agentMode);
        let promptText = goal;
        if (context) promptText += `\n\nContext: ${context}`;
        output = await client.sendPrompt(sid, promptText);
      }

      const result: AcpPromptResult = {
        session_id: sid,
        output: output.trim() || "[empty response]",
        new_session: resolved.newSession,
        reused_binding: resolved.reusedBinding,
        explicit_session: resolved.explicit,
      };
      return formatAcpPromptResult(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.agentErrors.set(agentName, msg);
      if (opts.nestSessionId && !opts.acpSessionId) {
        await unbindAcpSession(opts.nestSessionId, agentName);
      }
      return toolError(msg);
    }
  }

  private async runInitialPrompt(
    client: ACPClient,
    sid: string,
    goal: string,
    context: string,
    agentCfg: AcpAgentConfig,
    defaultPlanMode: string | false,
    defaultAgentMode: string,
  ): Promise<string> {
    let planMode: string | null = null;
    if (agentCfg.plan_mode !== false) {
      const raw = agentCfg.plan_mode ?? defaultPlanMode;
      if (raw) planMode = String(raw);
    }
    if (planMode) {
      await client.setMode(sid, planMode);
    }

    let promptText = `${goal}\n\nContext: ${context}`;
    if (planMode) {
      promptText =
        `## Goal\n${promptText}\n\n## Instructions\n` +
        "First, analyze and create a detailed plan. " +
        "After creating the plan, stop and wait for approval. " +
        "Do NOT execute the plan yet.";
    }

    let output = await client.sendPrompt(sid, promptText);
    if (!output.trim() && planMode) {
      try {
        const agentMode = agentCfg.agent_mode ?? defaultAgentMode;
        await client.setMode(sid, agentMode);
        output = await client.sendPrompt(
          sid,
          `Execute the plan for:\n${goal}\n\nContext: ${context}`,
        );
      } catch {
        /* ignore */
      }
    }
    return output;
  }
}

export function registerAcpTools(agentsCfg?: Record<string, AcpAgentConfig>): number {
  return getAcpManager().registerTools(agentsCfg);
}

export { ACPClient, ACPError } from "./client";
export { ACPSessionStore };
