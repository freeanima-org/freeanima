import { NEST_VERSION } from "@freeanima/legacy-runtime";

import { existsSync } from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface, type Interface } from "node:readline";
import { genericAcpAdapter, parseSessionUpdateChunk } from "./adapters/generic.js";
import { resolveAcpAdapter } from "./adapters/registry.js";
import type { AcpAgentAdapter } from "./adapters/types.js";
import type { AcpAgentConfig } from "./status.js";
import {
  jsonRpcMessageSchema,
  type JsonRpcMessage,
} from "../schemas/acp-jsonrpc.js";

export const DEFAULT_CONNECT_TIMEOUT_MS = 15_000;
export const DEFAULT_PROMPT_TIMEOUT_MS = 120_000;
const MAX_STDERR_LINES = 20;

export class ACPError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(`[${code}] ${message}`);
    this.name = "ACPError";
  }
}

type PendingRequest = {
  resolve: (result: Record<string, unknown>) => void;
  reject: (err: Error) => void;
  method: string;
  timeoutId: ReturnType<typeof setTimeout>;
};

export function resolveAcpRequestTimeoutMs(
  method: string,
  cfg?: Pick<AcpAgentConfig, "connect_timeout_ms" | "prompt_timeout_ms">,
): number {
  const connect = cfg?.connect_timeout_ms ?? DEFAULT_CONNECT_TIMEOUT_MS;
  const prompt = cfg?.prompt_timeout_ms ?? DEFAULT_PROMPT_TIMEOUT_MS;
  return method === "session/prompt" ? prompt : connect;
}

export class ACPClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private stdoutRl: Interface | null = null;
  private stderrRl: Interface | null = null;
  private reqId = 0;
  private connected = false;
  private readonly pending = new Map<number, PendingRequest>();
  private notificationQueue: JsonRpcMessage[] = [];
  private readonly adapter: AcpAgentAdapter;
  private readonly agentCfg?: AcpAgentConfig;
  private readonly stderrLines: string[] = [];

  constructor(
    readonly name: string,
    private readonly command: string,
    private readonly args: string[] = [],
    private readonly defaultCwd?: string,
    agentCfg?: AcpAgentConfig,
    adapter?: AcpAgentAdapter,
  ) {
    this.agentCfg = agentCfg;
    this.adapter = adapter ?? (agentCfg ? resolveAcpAdapter(agentCfg) : genericAcpAdapter);
  }

  get adapterId(): string {
    return this.adapter.id;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  async start(cwd?: string): Promise<void> {
    if (this.connected) return;
    const procCwd = cwd ?? this.defaultCwd;
    if (procCwd && !existsSync(procCwd)) {
      throw new ACPError(-1, `ACP agent '${this.name}' cwd does not exist: ${procCwd}`);
    }
    const shellCmd = this.command.trim();
    const parts = shellCmd.split(/\s+/);
    const bin = parts[0]!;
    const extraArgs = parts.slice(1);

    this.stderrLines.length = 0;
    this.proc = spawn(bin, [...extraArgs, ...this.args], {
      cwd: procCwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.stdoutRl = createInterface({ input: this.proc.stdout });
    this.stdoutRl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const raw: unknown = JSON.parse(trimmed);
        const msg = jsonRpcMessageSchema.safeParse(raw);
        if (msg.success) this.dispatch(msg.data);
      } catch {
        /* ignore invalid json */
      }
    });

    this.stderrRl = createInterface({ input: this.proc.stderr });
    this.stderrRl.on("line", (line) => {
      this.stderrLines.push(line);
      if (this.stderrLines.length > MAX_STDERR_LINES) {
        this.stderrLines.shift();
      }
      console.error(`[acp:${this.name} stderr] ${line}`);
    });

    this.proc.on("exit", (code, signal) => {
      this.connected = false;
      const reason = signal
        ? `ACP agent '${this.name}' exited with signal ${signal}`
        : `ACP agent '${this.name}' exited with code ${code ?? "unknown"}`;
      this.rejectAllPending(reason);
    });

    this.proc.on("error", (err) => {
      this.connected = false;
      const hint =
        procCwd && !existsSync(procCwd)
          ? ` (cwd does not exist: ${procCwd})`
          : "";
      this.rejectAllPending(`ACP agent '${this.name}' spawn error: ${err.message}${hint}`);
    });

    this.proc.stdin.on("error", (err) => {
      const code = "code" in err ? String(err.code) : "";
      const detail = code === "EPIPE" ? "stdin closed" : err.message;
      this.rejectAllPending(`ACP agent '${this.name}' ${detail}`);
    });

    await this.call("initialize", {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: false, writeTextFile: false },
        terminal: false,
      },
      clientInfo: { name: "anima", version: NEST_VERSION },
    });

    if (this.adapter.afterInitialize) {
      await this.adapter.afterInitialize(this);
    }
    this.connected = true;
  }

  stop(): void {
    this.connected = false;
    this.rejectAllPending(`ACP agent '${this.name}' stopped`);
    this.stdoutRl?.close();
    this.stderrRl?.close();
    this.stdoutRl = null;
    this.stderrRl = null;
    if (this.proc) {
      try {
        this.proc.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      this.proc = null;
    }
  }

  /** 供适配器调用 JSON-RPC */
  call(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request(method, params);
  }

  async createSession(cwd?: string): Promise<string> {
    const result = await this.call("session/new", {
      cwd: cwd ?? this.defaultCwd ?? ".",
      mcpServers: [],
    });
    const sessionId = result.sessionId;
    if (typeof sessionId !== "string" || !sessionId) {
      throw new ACPError(-1, "session/new did not return sessionId");
    }
    return sessionId;
  }

  async setMode(sessionId: string, modeId: string): Promise<void> {
    try {
      await this.call("session/set_mode", { sessionId, modeId });
    } catch {
      /* 部分 agent 不支持 set_mode */
    }
  }

  async sendPrompt(sessionId: string, text: string): Promise<string> {
    this.notificationQueue = [];
    const result = await this.call("session/prompt", {
      sessionId,
      prompt: [{ type: "text", text }],
    });

    const parts: string[] = [];
    for (const note of this.notificationQueue) {
      const chunk = this.parseNotification(note);
      if (chunk) parts.push(chunk);
    }

    const fromResult = extractTextFromResult(result);
    if (fromResult) parts.push(fromResult);

    return parts.join("");
  }

  async closeSession(sessionId: string): Promise<void> {
    try {
      await this.call("session/close", { sessionId });
    } catch {
      /* ignore */
    }
  }

  private parseNotification(note: JsonRpcMessage): string | null {
    const method = String(note.method ?? "");
    if (method !== "session/update" && method !== "session/notification") {
      return null;
    }
    const params = note.params as Record<string, unknown> | undefined;
    const update = params?.update as Record<string, unknown> | undefined;
    if (!update) return null;
    return this.adapter.parseSessionUpdate(update) ?? parseSessionUpdateChunk(update);
  }

  private dispatch(msg: JsonRpcMessage): void {
    const id = msg.id;
    if (id != null && typeof id === "number") {
      const waiter = this.pending.get(id);
      if (waiter) {
        clearTimeout(waiter.timeoutId);
        this.pending.delete(id);
        if (msg.error) {
          const err = msg.error as Record<string, unknown>;
          waiter.reject(
            new ACPError(Number(err.code ?? -1), String(err.message ?? "ACP error"), err.data),
          );
        } else {
          waiter.resolve((msg.result as Record<string, unknown>) ?? {});
        }
        return;
      }

      const method = String(msg.method ?? "");
      if (method) {
        const params = (msg.params as Record<string, unknown>) ?? {};
        const result =
          this.adapter.handleServerRequest(method, params) ??
          genericAcpAdapter.handleServerRequest(method, params);
        this.sendResponse(id, result ?? null);
        return;
      }
    }

    if (id == null) {
      const method = String(msg.method ?? "");
      if (
        method === "session/update" ||
        method === "session/notification" ||
        method.startsWith("cursor/")
      ) {
        this.notificationQueue.push(msg);
      }
      return;
    }

    this.sendResponse(id as number, null);
  }

  private sendResponse(id: number, result: Record<string, unknown> | null): void {
    if (!this.proc?.stdin?.writable) return;
    const body = result
      ? { jsonrpc: "2.0", id, result }
      : {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: "Method not supported" },
        };
    this.proc.stdin.write(`${JSON.stringify(body)}\n`);
  }

  private rejectAllPending(reason: string): void {
    const stderrHint = this.stderrSummary();
    const message = stderrHint ? `${reason}${stderrHint}` : reason;
    for (const [, waiter] of this.pending) {
      clearTimeout(waiter.timeoutId);
      waiter.reject(new ACPError(-1, message));
    }
    this.pending.clear();
  }

  private stderrSummary(): string {
    if (!this.stderrLines.length) return "";
    return ` stderr: ${this.stderrLines.slice(-5).join(" | ")}`;
  }

  private request(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const timeoutMs = resolveAcpRequestTimeoutMs(method, this.agentCfg);
    return new Promise((resolve, reject) => {
      if (!this.proc?.stdin) {
        reject(new Error("ACP client not started"));
        return;
      }
      this.reqId += 1;
      const id = this.reqId;
      const timeoutId = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new ACPError(-1, `Request ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, method, timeoutId });

      const req = { jsonrpc: "2.0", id, method, params: params ?? {} };
      try {
        this.proc.stdin.write(`${JSON.stringify(req)}\n`);
      } catch (err) {
        clearTimeout(timeoutId);
        this.pending.delete(id);
        const msg = err instanceof Error ? err.message : String(err);
        reject(new ACPError(-1, `ACP agent '${this.name}' write failed: ${msg}`));
      }
    });
  }
}

function extractTextFromResult(result: Record<string, unknown>): string {
  const parts: string[] = [];

  const stopReason = result.stopReason;
  if (typeof stopReason === "string" && stopReason && stopReason !== "end_turn") {
    parts.push(`[stopReason=${stopReason}]`);
  }

  const direct = result.content;
  if (typeof direct === "string" && direct) parts.push(direct);

  const promptResult = result.result ?? result;
  if (Array.isArray(promptResult)) {
    for (const msg of promptResult) {
      if (!msg || typeof msg !== "object") continue;
      appendMessageContent(parts, msg as Record<string, unknown>);
    }
  } else if (promptResult && typeof promptResult === "object") {
    appendMessageContent(parts, promptResult as Record<string, unknown>);
  }

  return parts.join("\n").trim();
}

function appendMessageContent(parts: string[], row: Record<string, unknown>): void {
  const content = row.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block && typeof block === "object" && (block as Record<string, unknown>).type === "text") {
        parts.push(String((block as Record<string, unknown>).text ?? ""));
      }
    }
  } else if (typeof content === "string") {
    parts.push(content);
  }
}
