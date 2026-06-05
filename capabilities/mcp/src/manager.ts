import {
  listTools,
  registerTool,
  toolError,
  unregisterToolsByToolset,
} from "@freeanima/engine-tool";
import { loadConfig } from "@freeanima/service-config";
import { logComponent } from "@freeanima/service-logging";

import { McpClientSession, type McpServerConfig } from "./client.ts";
import { extractMcpResult, mcpToolParameters } from "./schema.ts";
import {
  isMcpServerEnabled,
  sanitizeMcpConfig,
  type McpControlResult,
  type McpServerStatusView,
  type McpStatusResponse,
} from "./status.ts";

type McpServersConfig = NonNullable<ReturnType<typeof loadConfig>["mcp_servers"]>;

/** MCP 管理器 — 启动 config 中的 MCP Server，发现并注册工具 */
export class MCPManager {
  private readonly clients = new Map<string, McpClientSession>();
  private readonly serverConfigs = new Map<string, McpServerConfig>();
  private readonly serverErrors = new Map<string, string>();
  private readonly connecting = new Set<string>();
  private toolCount = 0;
  private closed = false;
  private startTask: Promise<number> | null = null;

  /** 后台并行连接已启用的 MCP Server，不阻塞 HTTP 启动 */
  startAllAsync(serversCfg?: McpServersConfig): void {
    if (this.startTask || this.closed) return;
    this.startTask = this.runStartAll(serversCfg, { enabledOnly: true }).finally(() => {
      this.startTask = null;
    });
    void this.startTask.catch((err) => {
      logComponent("mcp").error("MCP background startup failed", { err });
    });
  }

  /** 同步等待全部已启用 MCP Server 连接完成（测试或需阻塞场景） */
  async startAll(serversCfg?: McpServersConfig): Promise<number> {
    if (this.startTask) return this.startTask;
    if (this.closed) return this.toolCount;
    this.startTask = this.runStartAll(serversCfg, { enabledOnly: true });
    try {
      return await this.startTask;
    } finally {
      this.startTask = null;
    }
  }

  /** 启动单个 MCP Server（工作间手动控制） */
  async startServer(name: string): Promise<McpControlResult> {
    const serverCfg = this.resolveServerConfig(name);
    if (!serverCfg) {
      return {
        ok: false,
        error: `MCP server '${name}' not configured`,
        server: name,
        action: "start",
      };
    }
    if (this.clients.has(name)) {
      return { ok: true, server: name, action: "start" };
    }
    if (this.connecting.has(name)) {
      return { ok: true, server: name, action: "start" };
    }

    this.serverConfigs.set(name, serverCfg);
    await this.startOneSafe(name, serverCfg);
    this.recountTools();
    return { ok: true, server: name, action: "start" };
  }

  /** 停止单个 MCP Server 并注销其工具 */
  async stopServer(name: string): Promise<McpControlResult> {
    if (this.connecting.has(name)) {
      return {
        ok: false,
        error: `MCP server '${name}' is connecting`,
        server: name,
        action: "stop",
      };
    }

    const session = this.clients.get(name);
    if (session) {
      try {
        await session.close();
      } catch (err) {
        logComponent("mcp").warn(`MCP '${name}': close error`, { err, server: name });
      }
      this.clients.delete(name);
    }

    unregisterToolsByToolset(`mcp:${name}`);
    this.serverErrors.delete(name);
    this.recountTools();
    return { ok: true, server: name, action: "stop" };
  }

  /** 启动所有 enabled 且未连接的 server */
  async startAllEnabled(): Promise<McpControlResult> {
    const cfg = loadConfig();
    const servers = cfg.mcp_servers ?? {};
    const tasks: Promise<void>[] = [];

    for (const [name, rawCfg] of Object.entries(servers)) {
      const serverCfg = rawCfg as McpServerConfig;
      if (!isMcpServerEnabled(serverCfg)) continue;
      if (this.clients.has(name) || this.connecting.has(name)) continue;
      this.serverConfigs.set(name, serverCfg);
      tasks.push(this.startOneSafe(name, serverCfg).then(() => undefined));
    }

    await Promise.allSettled(tasks);
    this.recountTools();
    return { ok: true, action: "start" };
  }

  /** 停止所有已连接的 MCP Server */
  async stopAll(): Promise<McpControlResult> {
    for (const name of [...this.clients.keys()]) {
      await this.stopServer(name);
    }
    return { ok: true, action: "stop" };
  }

  private resolveServerConfig(name: string): McpServerConfig | undefined {
    const cfg = loadConfig();
    const fromCfg = cfg.mcp_servers?.[name] as McpServerConfig | undefined;
    return this.serverConfigs.get(name) ?? fromCfg;
  }

  private async runStartAll(
    serversCfg?: McpServersConfig,
    opts?: { enabledOnly?: boolean },
  ): Promise<number> {
    const cfg = loadConfig();
    const servers = serversCfg ?? cfg.mcp_servers ?? {};
    if (Object.keys(servers).length === 0) {
      return 0;
    }

    const entries = Object.entries(servers).filter(([, serverCfg]) => {
      if (!opts?.enabledOnly) return true;
      return isMcpServerEnabled(serverCfg as McpServerConfig);
    });

    for (const [serverName, serverCfg] of Object.entries(servers)) {
      this.serverConfigs.set(serverName, serverCfg as McpServerConfig);
    }

    const results = await Promise.allSettled(
      entries.map(([serverName, serverCfg]) =>
        this.startOneSafe(serverName, serverCfg as McpServerConfig),
      ),
    );

    let total = 0;
    for (const result of results) {
      if (result.status === "fulfilled") total += result.value;
    }

    this.recountTools();
    if (total > 0) {
      logComponent("mcp").info(
        `MCP: ${total} tool(s) registered from ${entries.length} server(s)`,
        {
          tool_count: total,
          server_count: entries.length,
        },
      );
    }
    return total;
  }

  private async startOneSafe(name: string, cfg: McpServerConfig): Promise<number> {
    if (this.closed) return 0;

    this.connecting.add(name);
    this.serverErrors.delete(name);
    try {
      const registered = await this.startOne(name, cfg);
      this.serverErrors.delete(name);
      return registered;
    } catch (err) {
      this.serverErrors.set(name, String(err));
      logComponent("mcp").error(`Failed to start MCP server '${name}'`, { err, server: name });
      return 0;
    } finally {
      this.connecting.delete(name);
    }
  }

  private async startOne(name: string, cfg: McpServerConfig): Promise<number> {
    if (this.closed) return 0;

    const session = await McpClientSession.connect(name, cfg);
    if (this.closed) {
      await session.close().catch(() => {});
      return 0;
    }

    this.clients.set(name, session);

    const tools = await session.listTools();
    let registered = 0;

    for (const toolDef of tools) {
      const originalName = toolDef.name;
      if (!originalName) continue;

      const prefixedName = `mcp_${name}_${originalName}`;
      const params = mcpToolParameters({ inputSchema: toolDef.inputSchema });

      registerTool({
        name: prefixedName,
        description: toolDef.description ?? `MCP tool ${originalName} (${name})`,
        parameters: params,
        toolset: `mcp:${name}`,
        handler: async (args) => {
          try {
            const result = await session.callTool(originalName, args);
            return extractMcpResult(result);
          } catch (err) {
            return toolError(`MCP ${originalName} failed: ${err}`);
          }
        },
      });
      registered++;
    }

    if (registered > 0) {
      logComponent("mcp").info(`MCP '${name}': ${registered} tool(s) registered`, {
        server: name,
        tool_count: registered,
      });
    }
    return registered;
  }

  private recountTools(): void {
    this.toolCount = listTools().filter((t) => t.toolset?.startsWith("mcp:")).length;
  }

  async getStatus(): Promise<McpStatusResponse> {
    const cfg = loadConfig();
    const serversCfg = cfg.mcp_servers ?? {};
    const serverNames = new Set([...Object.keys(serversCfg), ...this.serverConfigs.keys()]);

    const servers: McpServerStatusView[] = [];
    for (const name of [...serverNames].toSorted()) {
      const rawCfg =
        this.serverConfigs.get(name) ?? (serversCfg[name] as McpServerConfig | undefined) ?? {};
      const enabled = isMcpServerEnabled(rawCfg);
      const session = this.clients.get(name);
      const error = this.serverErrors.get(name);
      const registeredTools = listTools().filter((t) => t.toolset === `mcp:${name}`);

      let tools: McpServerStatusView["tools"] = [];
      let resources: McpServerStatusView["resources"] = [];
      let prompts: McpServerStatusView["prompts"] = [];

      if (session) {
        try {
          const listed = await session.listTools();
          tools = listed.map((t) => ({
            original_name: t.name,
            registered_name: `mcp_${name}_${t.name}`,
            description: t.description,
            input_schema: t.inputSchema,
          }));
        } catch (err) {
          logComponent("mcp").warn(`MCP '${name}': listTools failed`, { err, server: name });
        }
        try {
          const listed = await session.listResources();
          resources = listed.map((r) => ({
            uri: r.uri,
            name: r.name,
            description: r.description,
            mime_type: r.mimeType,
          }));
        } catch {
          /* 部分 Server 不支持 resources */
        }
        try {
          const listed = await session.listPrompts();
          prompts = listed.map((p) => ({
            name: p.name,
            description: p.description,
            arguments: p.arguments,
          }));
        } catch {
          /* 部分 Server 不支持 prompts */
        }
      }

      let status: McpServerStatusView["status"];
      if (session) status = "connected";
      else if (this.connecting.has(name)) status = "connecting";
      else if (error) status = "error";
      else if (!enabled) status = "disabled";
      else status = "not_started";

      servers.push({
        name,
        config: sanitizeMcpConfig(rawCfg),
        status,
        error,
        tools,
        resources,
        prompts,
        registered_tools: registeredTools.map((t) => ({
          name: t.name,
          description: t.description,
        })),
      });
    }

    return {
      server_count: servers.length,
      connected_count: this.clients.size,
      connecting_count: this.connecting.size,
      tool_count: this.toolCount,
      servers,
    };
  }

  async closeAll(): Promise<void> {
    const t0 = Date.now();
    const clientCount = this.clients.size;
    const connectingCount = this.connecting.size;
    logComponent("shutdown").debug(
      `MCP 关闭 ${clientCount} 个连接` +
        (connectingCount ? `（另有 ${connectingCount} 个仍在连接中）` : "") +
        "…",
      { client_count: clientCount, connecting_count: connectingCount },
    );
    this.closed = true;
    if (this.startTask) {
      logComponent("shutdown").debug("MCP 等待后台 startAll 结束…");
      await this.startTask.catch(() => {});
      logComponent("shutdown").debug("MCP 后台 startAll 已结束", { ms: Date.now() - t0 });
    }

    for (const [name, session] of this.clients) {
      const ts = Date.now();
      try {
        await session.close();
        logComponent("shutdown").debug(`MCP '${name}' 已关闭`, {
          ms: Date.now() - ts,
          server: name,
        });
      } catch (err) {
        logComponent("shutdown").warn(`MCP '${name}' 关闭失败`, { err, server: name });
      }
    }
    for (const name of [...this.clients.keys()]) {
      unregisterToolsByToolset(`mcp:${name}`);
    }
    this.clients.clear();
    this.serverConfigs.clear();
    this.serverErrors.clear();
    this.connecting.clear();
    this.toolCount = 0;
    this.closed = false;
    logComponent("shutdown").debug("MCP 全部关闭完成", { ms: Date.now() - t0 });
  }

  serverCount(): number {
    return this.clients.size;
  }

  getToolCount(): number {
    return this.toolCount;
  }
}
