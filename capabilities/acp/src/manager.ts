import { join } from "node:path";
import type { SkillRegistry } from "@freeanima/core/skill";
import { registerSkillsFromDirectory } from "@freeanima/core/skill";
import { getToolConversationId } from "@freeanima/core/tool";
import type { ToolDef, ToolSetRegistry } from "@freeanima/core/tool";
import { acpToolSetId, toolError, toolResult } from "@freeanima/core/tool";
import type { Config } from "@freeanima/core/config";
import { logCapability as logComponent } from "@freeanima/core/config";

import type { ConversationPort } from "@freeanima/core/tool/conversation-port";
import { isConversationMeta } from "@freeanima/core/db/domain";
import {
  AcpAsyncTaskStore,
  appendProgressNote,
  createProgressDebouncer,
  createTaskId,
  DISCORD_PROGRESS_DELIVER_MS,
  formatDiscordProgressBody,
  formatProgressBody,
  toTaskSnapshot,
  type AcpAsyncTask,
} from "./async-task.ts";
import type { AcpTaskQueryPort } from "./ports/task-query.ts";
import { queryAcpTaskStatus, queryAcpTaskStatusList } from "./task-status.ts";
import { AcpAgentQueue } from "./agent-queue.ts";
import { AcpClientPool, type ClientLease } from "./client-pool.ts";
import { AcpTaskScheduler, type AsyncLaunchSpec } from "./task-scheduler.ts";
import type {
  AcpProgressDeliveryPort,
  AcpProgressDeliverOptions,
} from "./ports/progress-delivery.ts";
import { ACPClient } from "./client.ts";
import {
  bindAcpTaskRunning,
  bindAcpTaskQueued,
  getBoundAcpSession,
  promoteQueuedTaskToRunning,
  removeAcpTaskEntry,
  updateAcpTaskStatus,
} from "./acp-tasks.ts";
import type { CursorPendingInteraction } from "./cursor-decision.ts";
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
const DEFAULT_MAX_CONCURRENT_TASKS = 3;
const ACP_SKILLS_SOURCE = "acp";

type AcpPromptOptions = {
  animaSessionId?: string;
  acpSessionId?: string;
  newConversation?: boolean;
  mode?: AcpCursorMode;
  isAsync?: boolean;
};

type SessionMeta = {
  agent: string;
  lastUsed: number;
};

class ACPSessionStore {
  private sessions = new Map<string, SessionMeta>();

  add(conversationId: string, agentName: string): void {
    this.sessions.set(conversationId, { agent: agentName, lastUsed: Date.now() });
  }

  touch(conversationId: string): void {
    const row = this.sessions.get(conversationId);
    if (row) row.lastUsed = Date.now();
  }

  getAgent(conversationId: string): string | undefined {
    return this.sessions.get(conversationId)?.agent;
  }

  remove(conversationId: string): void {
    this.sessions.delete(conversationId);
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

  has(conversationId: string, agentName: string): boolean {
    return this.sessions.get(conversationId)?.agent === agentName;
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
      "Cursor coding agent supporting Agent (direct code edits), Plan (plan first, then execute), and Ask (read-only analysis) modes. " +
      "Can search the codebase, analyze code, run tests, and apply changes. " +
      "When async=true, runs in the background and periodically pushes progress to the message channel. " +
      "When Cursor asks questions or submits a plan for approval, results include a pending field; decide autonomously or use clarify to ask your partner, " +
      "then continue the same conversation with acp_conversation_id from the prior result."
    );
  }
  return `ACP agent: ${agentName} (pass acp_conversation_id to reuse a Cursor session; omit to start a new conversation)`;
}

function parseTimeoutMinutes(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_ASYNC_TIMEOUT_MINUTES;
  return Math.min(Math.floor(n), 24 * 60);
}

function buildPromptText(
  prompt: string,
  context: string,
  resolved: { newConversation: boolean },
  mode: AcpCursorMode,
): string {
  let promptText = prompt;
  if (context) promptText += `\n\nContext: ${context}`;
  if (resolved.newConversation && mode === "plan") {
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
    logComponent("acp").info(`Registered ${count} built-in ACP Skill(s)`, {
      count,
      source: ACP_SKILLS_SOURCE,
    });
  }
}

export class AcpManager {
  private readonly clientPools = new Map<string, AcpClientPool>();
  private readonly schedulers = new Map<string, AcpTaskScheduler>();
  private readonly conversationStore = new ACPSessionStore();
  private readonly agentQueues = new Map<string, AcpAgentQueue>();
  private readonly agentErrors = new Map<string, string>();
  private readonly starting = new Set<string>();
  private readonly healthTimers = new Map<string, ReturnType<typeof setInterval>>();
  private toolsRegistered = false;
  private closed = false;
  private startTask: Promise<void> | null = null;
  private conversationPort: ConversationPort | null = null;
  private progressDelivery: AcpProgressDeliveryPort | null = null;
  private taskQuery: AcpTaskQueryPort | null = null;
  private readonly taskStore = new AcpAsyncTaskStore();
  private readonly taskAbortControllers = new Map<string, AbortController>();
  private readonly syncLeases = new Map<string, ClientLease>();
  private progressTicker: ReturnType<typeof setInterval> | null = null;
  private toolSets: ToolSetRegistry | null = null;
  private skills: SkillRegistry | null = null;
  private config: Config | null = null;

  wireRegistries(opts: { toolSets: ToolSetRegistry; skills: SkillRegistry; config: Config }): void {
    this.toolSets = opts.toolSets;
    this.skills = opts.skills;
    this.config = opts.config;
  }

  private requireConfig(): Config {
    if (!this.config) {
      throw new Error("AcpManager: config not wired; call wireRegistries first");
    }
    return this.config;
  }

  wireConversation(conversationPort: ConversationPort): void {
    this.conversationPort = conversationPort;
  }

  wireProgressDelivery(port: AcpProgressDeliveryPort): void {
    this.progressDelivery = port;
  }

  wireTaskQuery(port: AcpTaskQueryPort): void {
    this.taskQuery = port;
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

  private conv(): ConversationPort {
    if (!this.conversationPort) {
      throw new Error("AcpManager: conversation not wired; call wireConversation first");
    }
    return this.conversationPort;
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
    if (!this.toolSets || !this.skills) {
      throw new Error("AcpManager: toolSets/skills not wired; call wireRegistries first");
    }
    const cfg = this.requireConfig().data;
    const agents = agentsCfg ?? cfg.acp_agents ?? {};
    if (!Object.keys(agents).length) return 0;

    registerAcpBuiltinSkills(this.skills);

    let count = 0;
    for (const [agentName, agentCfg] of Object.entries(agents)) {
      const toolName = `acp_${agentName}`;
      const description = agentCfg.description ?? defaultCursorDescription(agentName);

      const def: ToolDef = {
        name: toolName,
        description,
        parameters: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "Instruction or reply sent to Cursor. In multi-turn interactions may be a task description, answer to a question, or continuation.",
            },
            context: {
              type: "string",
              description:
                "Task context: project path, related files, constraints, mode notes, etc.",
              default: "",
            },
            mode: {
              type: "string",
              enum: ["agent", "plan", "ask"],
              description:
                "Cursor mode: agent=direct edits, plan=plan first, ask=read-only analysis. Default agent.",
              default: "agent",
            },
            acp_conversation_id: {
              type: "string",
              description:
                "ACP conversation ID to reuse (from a prior acp_cursor result). Omit to start a new conversation.",
              default: "",
            },
            new_session: {
              type: "boolean",
              description:
                "When true, forces a new ACP conversation and updates the current Free Anima conversation binding for this agent.",
              default: false,
            },
            async: {
              type: "boolean",
              description:
                "Async execution (default true): returns task_id immediately, runs the Cursor task in the background, progress pushed periodically via the message channel. Set false for blocking mode.",
              default: true,
            },
            timeout_minutes: {
              type: "integer",
              description: "Max runtime in async mode (minutes), default 30.",
              default: DEFAULT_ASYNC_TIMEOUT_MINUTES,
            },
            cancel: {
              type: "string",
              description: "Cancel the async task with the given task_id.",
              default: "",
            },
          },
          required: [],
        },
        handler: (args) => {
          const cancelId = String(args.cancel ?? "").trim();
          if (cancelId) return this.cancelAsyncTask(cancelId);

          const prompt = String(args.prompt ?? args.goal ?? "").trim();
          if (!prompt) return toolError("prompt cannot be empty");
          const context = String(args.context ?? "");
          const explicitSid = String(args.acp_conversation_id ?? "").trim() || undefined;
          const newConversation = args.new_session === true || args.new_session === "true";
          const mode = parseMode(args.mode) ?? "agent";
          const isAsync = args.async !== false && args.async !== "false";
          const timeoutMinutes = parseTimeoutMinutes(args.timeout_minutes);
          const animaSid = getToolConversationId();

          if (isAsync) {
            return this.launchAsync(
              agentName,
              prompt,
              context,
              {
                animaSessionId: animaSid,
                acpSessionId: explicitSid,
                newConversation,
                mode,
                isAsync: true,
              },
              timeoutMinutes,
            );
          }

          return this.queueFor(agentName).run(() =>
            this.handleAcpPrompt(agentName, prompt, context, {
              animaSessionId: animaSid,
              acpSessionId: explicitSid,
              newConversation,
              mode,
            }),
          );
        },
      };
      const tools: ToolDef[] = [def];
      if (agentName === "cursor") {
        tools.push(this.buildTaskStatusToolDef());
      }
      const setId = acpToolSetId(agentName);
      this.toolSets.unregisterToolSet(setId);
      this.toolSets.registerToolSet(setId, description, tools);
      count += tools.length;
    }
    this.toolsRegistered = true;
    return count;
  }

  private buildTaskStatusToolDef(): ToolDef {
    return {
      name: "acp_cursor_task_status",
      description:
        "Read-only query for ACP async task status, latest progress text, and final result when available. " +
        "Does not send any message to Cursor. Omit task_id to query the latest task in the current conversation.",
      parameters: {
        type: "object",
        properties: {
          task_id: {
            type: "string",
            description:
              "Optional task_id. When omitted, returns the most recently updated ACP task for this conversation.",
            default: "",
          },
          list_all: {
            type: "boolean",
            description:
              "When true, returns all active/recent ACP tasks for this conversation instead of a single task.",
            default: false,
          },
        },
        required: [],
      },
      handler: (args) => this.handleTaskStatusQuery(args),
    };
  }

  private async handleTaskStatusQuery(args: Record<string, unknown>): Promise<string> {
    const animaSid = getToolConversationId();
    if (!animaSid)
      return toolError("No active session; acp_cursor_task_status requires a conversation context");
    const listAll = args.list_all === true || args.list_all === "true";
    const taskId = String(args.task_id ?? "").trim() || undefined;

    if (listAll) {
      const views = await queryAcpTaskStatusList({
        conversation: this.conv(),
        taskStore: this.taskStore,
        taskQuery: this.taskQuery,
        animaSessionId: animaSid,
      });
      return toolResult({ tasks: views });
    }

    const view = await queryAcpTaskStatus({
      conversation: this.conv(),
      taskStore: this.taskStore,
      taskQuery: this.taskQuery,
      animaSessionId: animaSid,
      taskId,
    });
    if (!view) {
      return toolError(
        taskId
          ? `No ACP task found for task_id: ${taskId}`
          : "No ACP task found for this conversation",
      );
    }
    return toolResult(view);
  }

  private getMaxConcurrent(agentCfg: AcpAgentConfig): number {
    const n = agentCfg.max_concurrent_tasks;
    if (typeof n === "number" && Number.isFinite(n) && n > 0) {
      return Math.min(Math.floor(n), 16);
    }
    return DEFAULT_MAX_CONCURRENT_TASKS;
  }

  private ensurePool(agentName: string, agentCfg: AcpAgentConfig): AcpClientPool {
    let pool = this.clientPools.get(agentName);
    if (!pool) {
      pool = new AcpClientPool(this.getMaxConcurrent(agentCfg), () =>
        this.createClientInstance(agentName, agentCfg),
      );
      this.clientPools.set(agentName, pool);
    }
    return pool;
  }

  private ensureScheduler(agentName: string, agentCfg: AcpAgentConfig): AcpTaskScheduler {
    let scheduler = this.schedulers.get(agentName);
    if (!scheduler) {
      const pool = this.ensurePool(agentName, agentCfg);
      const max = this.getMaxConcurrent(agentCfg);
      scheduler = new AcpTaskScheduler(pool, max, {
        onStart: (spec, lease) => this.executeAsyncTask(spec, lease),
        onQueueTimeout: (spec) => this.handleQueueTimeout(spec),
      });
      this.schedulers.set(agentName, scheduler);
    }
    return scheduler;
  }

  private async createClientInstance(
    agentName: string,
    agentCfg: AcpAgentConfig,
  ): Promise<ACPClient> {
    const command = agentCfg.command ?? "";
    if (!command) throw new Error(`ACP agent '${agentName}' missing command`);
    const client = new ACPClient(agentName, command, agentCfg.args ?? [], agentCfg.cwd, agentCfg);
    await client.start();
    this.agentErrors.delete(agentName);
    if (!this.healthTimers.has(agentName)) {
      this.startHealthCheck(agentName, agentCfg);
    }
    return client;
  }

  private poolFor(agentName: string): AcpClientPool | undefined {
    return this.clientPools.get(agentName);
  }

  private schedulerFor(agentName: string): AcpTaskScheduler | undefined {
    return this.schedulers.get(agentName);
  }

  getStatus(): AcpStatusResponse {
    const cfg = this.requireConfig().data;
    const agents = cfg.acp_agents ?? {};
    const views: AcpAgentStatusView[] = [];

    for (const [name, agentCfg] of Object.entries(agents)) {
      const pool = this.clientPools.get(name);
      let status: AcpAgentStatusView["status"] = "not_started";
      if (!isAcpAgentEnabled(agentCfg)) status = "disabled";
      else if (this.starting.has(name)) status = "starting";
      else if (pool?.isAnyAlive()) status = "connected";
      else if (this.agentErrors.has(name)) status = "error";

      const registered = this.toolSets!.getTool(`acp_${name}`);
      const conversationIds = this.conversationStore.listForAgent(name);

      views.push({
        name,
        config: sanitizeAcpConfig(agentCfg),
        status,
        error: this.agentErrors.get(name),
        tool: registered ? { name: registered.name, description: registered.description } : null,
        sessions: conversationIds.map((conversation_id) => ({
          conversation_id,
          conversation_id_short: shortSessionId(conversation_id),
          agent: name,
        })),
      });
    }

    const connected_count = views.filter((a) => a.status === "connected").length;
    return {
      agent_count: views.length,
      connected_count,
      session_count: this.conversationStore.count(),
      tool_count: this.toolSets!.listToolSets().filter((ts) => ts.name.startsWith("acp_")).length,
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
    if (this.starting.has(name)) {
      return { ok: true, agent: name, action: "start" };
    }
    const pool = this.poolFor(name);
    if (pool?.isAnyAlive()) {
      return { ok: true, agent: name, action: "start" };
    }

    this.starting.add(name);
    this.agentErrors.delete(name);
    try {
      await this.ensurePool(name, agentCfg).prewarm();
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
    const scheduler = this.schedulers.get(name);
    scheduler?.cancelAll("agent stopped");
    this.schedulers.delete(name);
    const pool = this.clientPools.get(name);
    if (pool) {
      await pool.stopAll();
      this.clientPools.delete(name);
    }
    this.syncLeases.delete(name);
    this.agentErrors.delete(name);
    this.conversationStore.removeByAgent(name);
    return { ok: true, agent: name, action: "stop" };
  }

  /** Connect enabled ACP agents in parallel in the background without blocking HTTP startup */
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
    const cfg = this.requireConfig().data;
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
    const cfg = this.requireConfig().data;
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
    for (const task of this.taskStore.listActive()) {
      if (task.status === "queued") {
        this.schedulerFor(task.agentName)?.cancelQueued(task.taskId);
        task.status = "cancelled";
        this.taskStore.delete(task.taskId);
      } else if (task.status === "running") {
        this.cancelAsyncTaskInternal(task.taskId, "service shutdown");
      }
    }
    const names = [...new Set([...this.clientPools.keys(), ...this.schedulers.keys()])];
    if (names.length) {
      logComponent("shutdown").debug(
        `ACP stopping ${names.length} agent(s): ${names.join(", ")}…`,
        {
          count: names.length,
          agents: names,
        },
      );
    }
    for (const name of names) {
      const ts = Date.now();
      await this.stopAgent(name);
      logComponent("shutdown").debug(`ACP '${name}' stopped`, { ms: Date.now() - ts, agent: name });
    }
    return { ok: true, action: "stop" };
  }

  private getAgentConfig(name: string): AcpAgentConfig | undefined {
    const cfg = this.requireConfig().data;
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
    const pool = this.clientPools.get(name);
    if (!pool) return;

    const ttl = agentCfg.session_ttl_ms ?? 0;
    if (ttl > 0) {
      const expired = this.conversationStore.pruneExpired(ttl);
      for (const sid of expired) {
        for (const client of pool.listClients()) {
          try {
            await client.closeSession(sid);
          } catch {
            /* ignore */
          }
        }
      }
    }

    if (pool.isAnyAlive()) return;

    logComponent("acp").warn(`ACP agent '${name}' process unhealthy, attempting restart`, {
      agent: name,
    });
    await pool.stopAll();
    if (agentCfg.auto_restart === false) {
      this.agentErrors.set(name, "process died");
      return;
    }

    try {
      await pool.prewarm();
      const sessions = this.conversationStore.listForAgent(name);
      if (sessions.length) {
        logComponent("acp").info(
          `ACP '${name}' restarted, ${sessions.length} session(s) pending reuse verification`,
          {
            agent: name,
            sessions: sessions.length,
          },
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.agentErrors.set(name, msg);
    }
  }

  private async resolveAcpSession(
    client: ACPClient,
    agentName: string,
    agentCfg: AcpAgentConfig,
    opts: AcpPromptOptions,
  ): Promise<{ id: string; newConversation: boolean; reusedBinding: boolean; explicit: boolean }> {
    if (opts.acpSessionId) {
      const id = opts.acpSessionId;
      if (this.conversationStore.has(id, agentName)) {
        this.conversationStore.touch(id);
        return { id, newConversation: false, reusedBinding: false, explicit: true };
      }
      const retried = await this.tryContinueOrRecreate(
        client,
        agentName,
        agentCfg,
        opts.animaSessionId ?? "",
        id,
        opts.mode ?? "agent",
        opts.isAsync,
      );
      return { ...retried, reusedBinding: false, explicit: true };
    }

    if (opts.newConversation) {
      const id = await this.createAcpSession(client, agentName, agentCfg, opts.animaSessionId, {
        skipMetaBind: opts.isAsync,
      });
      return { id, newConversation: true, reusedBinding: false, explicit: false };
    }

    const id = await this.createAcpSession(client, agentName, agentCfg, opts.animaSessionId, {
      skipMetaBind: opts.isAsync,
    });
    return { id, newConversation: true, reusedBinding: false, explicit: false };
  }

  /** Bound in meta but not registered in-process (e.g. after restart) — try reuse first, create new on failure */
  private async tryContinueOrRecreate(
    client: ACPClient,
    agentName: string,
    agentCfg: AcpAgentConfig,
    animaSessionId: string,
    boundId: string,
    mode: AcpCursorMode,
    isAsync?: boolean,
  ): Promise<{ id: string; newConversation: boolean }> {
    try {
      await client.setMode(boundId, mode);
      this.conversationStore.add(boundId, agentName);
      return { id: boundId, newConversation: false };
    } catch {
      /* Session may have expired */
    }
    try {
      await client.closeSession(boundId);
    } catch {
      /* ignore */
    }
    const id = await this.createAcpSession(client, agentName, agentCfg, animaSessionId, {
      skipMetaBind: isAsync,
    });
    return { id, newConversation: true };
  }

  private async createAcpSession(
    client: ACPClient,
    agentName: string,
    agentCfg: AcpAgentConfig,
    animaSessionId?: string,
    opts?: { skipMetaBind?: boolean },
  ): Promise<string> {
    const sid = await client.createSession(agentCfg.cwd);
    this.conversationStore.add(sid, agentName);
    if (animaSessionId && !opts?.skipMetaBind) {
      await bindAcpTaskRunning(this.conv(), animaSessionId, agentName, sid, `sync-${Date.now()}`);
    }
    return sid;
  }

  private async preparePromptSessionWithClient(
    client: ACPClient,
    agentName: string,
    agentCfg: AcpAgentConfig,
    opts: AcpPromptOptions,
  ): Promise<{
    sid: string;
    resolved: { id: string; newConversation: boolean; reusedBinding: boolean; explicit: boolean };
    mode: AcpCursorMode;
  }> {
    const mode = opts.mode ?? "agent";

    const previousBound =
      opts.newConversation && opts.animaSessionId
        ? await getBoundAcpSession(this.conv(), opts.animaSessionId, agentName)
        : undefined;

    const resolved = await this.resolveAcpSession(client, agentName, agentCfg, opts);
    const sid = resolved.id;
    this.conversationStore.touch(sid);

    if (previousBound && previousBound !== sid) {
      try {
        await client.closeSession(previousBound);
      } catch {
        /* ignore */
      }
      this.conversationStore.remove(previousBound);
      if (opts.animaSessionId) {
        await removeAcpTaskEntry(this.conv(), opts.animaSessionId, previousBound);
      }
    }

    await client.setMode(sid, mode);
    return { sid, resolved, mode };
  }

  private async preparePromptSession(
    agentName: string,
    agentCfg: AcpAgentConfig,
    opts: AcpPromptOptions,
  ): Promise<{
    client: ACPClient;
    lease: ClientLease;
    sid: string;
    resolved: { id: string; newConversation: boolean; reusedBinding: boolean; explicit: boolean };
    mode: AcpCursorMode;
  }> {
    const pool = this.ensurePool(agentName, agentCfg);
    const lease = await pool.tryAcquire(`sync-${Date.now()}`);
    if (!lease) {
      throw new Error(`ACP agent '${agentName}' is busy (all client slots in use)`);
    }
    const { sid, resolved, mode } = await this.preparePromptSessionWithClient(
      lease.client,
      agentName,
      agentCfg,
      opts,
    );
    return { client: lease.client, lease, sid, resolved, mode };
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
      return toolError("Async mode requires a valid Free Anima session");
    }

    const now = Date.now();
    const taskId = createTaskId();
    const deadlineAt = now + timeoutMinutes * 60_000;
    const scheduler = this.ensureScheduler(agentName, agentCfg);
    const willQueue = !scheduler.hasCapacity();

    const task: AcpAsyncTask = {
      taskId,
      agentName,
      acpSessionId: "",
      animaSessionId: opts.animaSessionId,
      mode: opts.mode ?? "agent",
      status: willQueue ? "queued" : "running",
      startedAt: now,
      lastProgressAt: now,
      progressNotes: [],
      lastDeliveredAt: 0,
      timeoutAt: deadlineAt,
      ...(willQueue ? { queuePosition: 1 } : {}),
    };
    this.taskStore.set(task);

    if (willQueue) {
      await bindAcpTaskQueued(this.conv(), opts.animaSessionId, agentName, taskId);
    }

    const spec: AsyncLaunchSpec = {
      taskId,
      agentName,
      prompt,
      context,
      animaSessionId: opts.animaSessionId,
      acpSessionId: opts.acpSessionId,
      newConversation: opts.newConversation,
      mode: opts.mode,
      timeoutMinutes,
      enqueuedAt: now,
      deadlineAt,
      wasQueued: willQueue,
    };

    const result = scheduler.enqueue(spec);
    if (result.status === "queued") {
      task.queuePosition = result.queuePosition;
      return toolResult({
        task_id: taskId,
        status: "queued",
        queue_position: result.queuePosition,
        hint: "Task queued; will start when a client slot is available",
      });
    }

    return toolResult({
      task_id: taskId,
      status: "started",
      hint: "Progress will be pushed via the message channel; final result pushed on completion",
    });
  }

  private async executeAsyncTask(spec: AsyncLaunchSpec, lease: ClientLease): Promise<void> {
    const agentCfg = this.getAgentConfig(spec.agentName);
    if (!agentCfg) return;

    const task = this.taskStore.get(spec.taskId);
    if (!task || task.status === "cancelled") {
      this.schedulerFor(spec.agentName)?.onTaskTerminal(spec.taskId);
      return;
    }

    const ac = new AbortController();
    this.taskAbortControllers.set(spec.taskId, ac);

    try {
      const promptOpts: AcpPromptOptions = {
        animaSessionId: spec.animaSessionId,
        acpSessionId: spec.acpSessionId,
        newConversation: spec.newConversation,
        mode: spec.mode,
        isAsync: true,
      };
      const { sid, resolved, mode } = await this.preparePromptSessionWithClient(
        lease.client,
        spec.agentName,
        agentCfg,
        promptOpts,
      );
      const promptText = buildPromptText(spec.prompt, spec.context, resolved, mode);

      task.acpSessionId = sid;
      task.mode = mode;
      task.status = "running";
      task.clientSlot = lease.slotId;
      delete task.queuePosition;

      if (spec.wasQueued) {
        await promoteQueuedTaskToRunning(
          this.conv(),
          spec.animaSessionId,
          spec.agentName,
          spec.taskId,
          sid,
        );
      } else {
        await bindAcpTaskRunning(
          this.conv(),
          spec.animaSessionId,
          spec.agentName,
          sid,
          spec.taskId,
        );
      }

      await this.runAsyncPrompt(task, lease, promptText, resolved, mode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logComponent("acp").error("Async ACP task start failed", { taskId: spec.taskId, err: e });
      task.status = "error";
      task.error = msg;
      if (task.acpSessionId) {
        await updateAcpTaskStatus(this.conv(), task.animaSessionId, task.acpSessionId, "error");
      }
      await this.deliverTaskError(task, msg);
      this.releaseAsyncTask(spec.taskId, spec.agentName);
    }
  }

  private async handleQueueTimeout(spec: AsyncLaunchSpec): Promise<void> {
    const task = this.taskStore.get(spec.taskId);
    if (!task) return;
    task.status = "cancelled";
    task.error = "Task queue timeout";
    this.taskAbortControllers.delete(spec.taskId);
    const placeholderKey = `queued:${spec.taskId}`;
    await removeAcpTaskEntry(this.conv(), spec.animaSessionId, placeholderKey).catch(() => {});
    await this.deliverTaskError(task, "Task queue timeout before start");
    this.taskStore.delete(spec.taskId);
    this.schedulerFor(spec.agentName)?.onTaskTerminal(spec.taskId);
  }

  private async runAsyncPrompt(
    task: AcpAsyncTask,
    lease: ClientLease,
    promptText: string,
    resolved: { newConversation: boolean; reusedBinding: boolean; explicit: boolean },
    mode: AcpCursorMode,
  ): Promise<void> {
    const { taskId, agentName, acpSessionId } = task;
    const client = lease.client;
    const abort = this.taskAbortControllers.get(taskId);
    const remainingMs = Math.max(task.timeoutAt - Date.now(), 1_000);

    const debouncer = createProgressDebouncer((merged) => {
      appendProgressNote(task, merged);
      void this.deliverProgressForTask(task, { weixinBatch: false });
    });

    const onDecisionNeeded = async (
      pending: CursorPendingInteraction[],
      notes: string[],
    ): Promise<void> => {
      if (task.decisionNotified) return;
      task.decisionNotified = true;
      debouncer.flush();
      const partialResult: AcpPromptResult = {
        conversation_id: acpSessionId,
        output: notes.join("\n") || "[awaiting decision]",
        new_session: resolved.newConversation,
        reused_binding: resolved.reusedBinding,
        explicit_session: resolved.explicit,
        mode,
        pending: [...pending],
      };
      await updateAcpTaskStatus(
        this.conv(),
        task.animaSessionId,
        acpSessionId,
        "awaiting_decision",
        {
          pending,
        },
      );
      await this.deliverTaskResult(task, partialResult);
    };

    try {
      const output = await client.sendPromptWithOptions(acpSessionId, promptText, {
        promptTimeoutMs: remainingMs,
        abortSignal: abort?.signal,
        onNotification: (_note, parsed) => {
          if (parsed) debouncer.push(parsed);
        },
        onDecisionNeeded,
      });
      debouncer.flush();
      const capture = client.takeLastPromptCapture();
      const result: AcpPromptResult = {
        conversation_id: acpSessionId,
        output: output.trim() || "[empty response]",
        new_session: resolved.newConversation,
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
      const metaStatus = result.pending?.length ? "awaiting_decision" : "completed";
      await updateAcpTaskStatus(this.conv(), task.animaSessionId, acpSessionId, metaStatus, {
        pending: result.pending,
      });
      if (metaStatus === "completed" || !task.decisionNotified) {
        await this.deliverTaskResult(task, result);
      }
    } catch (e) {
      if (task.status === "cancelled") return;
      const msg = e instanceof Error ? e.message : String(e);
      if (abort?.signal.aborted || msg.includes("aborted")) {
        task.status = "cancelled";
        task.error = "Task cancelled";
        await updateAcpTaskStatus(this.conv(), task.animaSessionId, acpSessionId, "cancelled");
        await this.deliverTaskError(task, task.error);
      } else if (msg.includes("timed out")) {
        task.status = "timed_out";
        task.error = msg;
        try {
          await client.closeSession(acpSessionId);
        } catch {
          /* ignore */
        }
        await updateAcpTaskStatus(this.conv(), task.animaSessionId, acpSessionId, "error");
        await this.deliverTaskError(task, `Task timed out: ${msg}`);
      } else {
        task.status = "error";
        task.error = msg;
        this.agentErrors.set(agentName, msg);
        await updateAcpTaskStatus(this.conv(), task.animaSessionId, acpSessionId, "error");
        await this.deliverTaskError(task, msg);
      }
    } finally {
      debouncer.dispose();
      this.releaseAsyncTask(taskId, agentName);
    }
  }

  private purgeTerminalTask(taskId: string): void {
    const task = this.taskStore.get(taskId);
    if (!task || task.status === "running" || task.status === "queued") return;
    this.taskStore.delete(taskId);
  }

  private releaseAsyncTask(taskId: string, agentName: string): void {
    this.taskAbortControllers.delete(taskId);
    this.schedulerFor(agentName)?.onTaskTerminal(taskId);
    this.purgeTerminalTask(taskId);
  }

  private cancelAsyncTask(taskId: string): string {
    const task = this.taskStore.get(taskId);
    if (!task) return toolError(`Task not found: ${taskId}`);

    if (task.status === "queued") {
      const scheduler = this.schedulerFor(task.agentName);
      if (scheduler?.cancelQueued(taskId)) {
        task.status = "cancelled";
        void removeAcpTaskEntry(this.conv(), task.animaSessionId, `queued:${taskId}`).catch(
          () => {},
        );
        this.taskStore.delete(taskId);
        return toolResult({ task_id: taskId, status: "cancelled" });
      }
    }

    if (task.status !== "running") {
      return toolResult({ task_id: taskId, status: task.status });
    }
    this.cancelAsyncTaskInternal(taskId, "user cancelled");
    return toolResult({ task_id: taskId, status: "cancelled" });
  }

  private cancelAsyncTaskInternal(taskId: string, reason: string): void {
    const task = this.taskStore.get(taskId);
    if (!task || (task.status !== "running" && task.status !== "queued")) return;
    task.status = "cancelled";
    task.error = reason;
    const ac = this.taskAbortControllers.get(taskId);
    ac?.abort();
    const lease =
      this.schedulerFor(task.agentName)?.getLease(taskId) ??
      this.poolFor(task.agentName)?.findLease(taskId);
    if (lease) {
      lease.client.abortActivePrompt();
    }
    if (task.acpSessionId) {
      void updateAcpTaskStatus(
        this.conv(),
        task.animaSessionId,
        task.acpSessionId,
        "cancelled",
      ).then(() => this.deliverTaskError(task, reason));
    } else {
      void removeAcpTaskEntry(this.conv(), task.animaSessionId, `queued:${taskId}`).then(() =>
        this.deliverTaskError(task, reason),
      );
    }
    this.releaseAsyncTask(taskId, task.agentName);
  }

  async pollProgress(): Promise<void> {
    const port = this.progressDelivery;
    if (!port) return;

    await Promise.all(
      this.taskStore
        .listRunning()
        .map((task) => this.deliverProgressForTask(task, { weixinBatch: true })),
    );
  }

  private async sessionPlatform(animaSessionId: string): Promise<string> {
    const meta = await this.conv().loadConversationMeta(animaSessionId);
    return isConversationMeta(meta) && typeof meta.platform === "string" ? meta.platform : "";
  }

  private async deliverProgressForTask(
    task: AcpAsyncTask,
    deliverOpts?: AcpProgressDeliverOptions,
  ): Promise<void> {
    const port = this.progressDelivery;
    if (!port) return;

    const isDiscord = (await this.sessionPlatform(task.animaSessionId)) === "discord";
    if (isDiscord) {
      if (task.lastDiscordDeliveredAt && task.lastProgressAt <= task.lastDiscordDeliveredAt) return;
      if (
        task.lastDiscordDeliveredAt &&
        Date.now() - task.lastDiscordDeliveredAt < DISCORD_PROGRESS_DELIVER_MS
      ) {
        return;
      }
    } else if (task.lastProgressAt <= task.lastDeliveredAt && task.lastDeliveredAt > 0) {
      return;
    }

    const body = isDiscord ? formatDiscordProgressBody(task) : formatProgressBody(task);
    try {
      const res = await port.deliverProgress(toTaskSnapshot(task), body, deliverOpts);
      if (res?.progressMessageId) {
        const isNew = !task.progressMessageId;
        task.progressMessageId = res.progressMessageId;
        if (isNew && task.animaSessionId && task.acpSessionId) {
          await updateAcpTaskStatus(
            this.conv(),
            task.animaSessionId,
            task.acpSessionId,
            "running",
            { progress_message_id: res.progressMessageId },
          );
        }
      }
      if (isDiscord) task.lastDiscordDeliveredAt = Date.now();
      task.lastDeliveredAt = Date.now();
    } catch (e) {
      logComponent("acp").warn("ACP progress delivery failed", { taskId: task.taskId, err: e });
    }
  }

  private async deliverTaskResult(task: AcpAsyncTask, result: AcpPromptResult): Promise<void> {
    const port = this.progressDelivery;
    if (!port) return;
    try {
      await port.deliverResult(toTaskSnapshot(task), result);
    } catch (e) {
      logComponent("acp").warn("ACP result delivery failed", { taskId: task.taskId, err: e });
    } finally {
      this.purgeTerminalTask(task.taskId);
    }
  }

  private async deliverTaskError(task: AcpAsyncTask, message: string): Promise<void> {
    const port = this.progressDelivery;
    if (!port) return;
    try {
      await port.deliverError(toTaskSnapshot(task), message);
    } catch (e) {
      logComponent("acp").warn("ACP error delivery failed", { taskId: task.taskId, err: e });
    } finally {
      this.purgeTerminalTask(task.taskId);
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

    if (this.syncLeases.has(agentName)) {
      return toolResult({
        error: `ACP agent '${agentName}' is busy`,
      });
    }

    const mode = opts.mode ?? "agent";
    let lease: ClientLease | undefined;

    try {
      const prepared = await this.preparePromptSession(agentName, agentCfg, opts);
      lease = prepared.lease;
      this.syncLeases.set(agentName, lease);
      const { sid, resolved } = prepared;
      const promptText = buildPromptText(prompt, context, resolved, mode);
      const output = await prepared.client.sendPrompt(sid, promptText);
      const capture = prepared.client.takeLastPromptCapture();

      const result: AcpPromptResult = {
        conversation_id: sid,
        output: output.trim() || "[empty response]",
        new_session: resolved.newConversation,
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
      if (opts.animaSessionId && !opts.acpSessionId) {
        const bound = await getBoundAcpSession(this.conv(), opts.animaSessionId, agentName);
        if (bound) await removeAcpTaskEntry(this.conv(), opts.animaSessionId, bound);
      }
      return toolError(msg);
    } finally {
      if (lease) {
        this.poolFor(agentName)?.release(lease);
        this.syncLeases.delete(agentName);
      }
    }
  }
}

export function registerAcpTools(agentsCfg?: Record<string, AcpAgentConfig>): number {
  return getAcpManager().registerTools(agentsCfg);
}

export { ACPClient, ACPError } from "./client.ts";
export { ACPSessionStore };
