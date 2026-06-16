import type { ToolDef, ToolSetRegistry } from "@freeanima/core/tool";
import { mcpToolSetId, toolError } from "@freeanima/core/tool";
import type { Config } from "@freeanima/core/config";
import { logCapability as logComponent } from "@freeanima/core/config";

import { McpClientSession, type McpServerConfig } from "./client.ts";
import { extractMcpResult, mcpToolParameters } from "./schema.ts";
import {
  isMcpServerEnabled,
  sanitizeMcpConfig,
  type McpControlResult,
  type McpServerStatusView,
  type McpStatusResponse,
} from "./status.ts";

type McpServersConfig = NonNullable<import("@freeanima/core/config").AnimaConfig["mcp_servers"]>;

/** MCP manager — start MCP Servers from config, discover and register tools */
export class MCPManager {
  private readonly clients = new Map<string, McpClientSession>();
  private readonly serverConfigs = new Map<string, McpServerConfig>();
  private readonly serverErrors = new Map<string, string>();
  private readonly connecting = new Set<string>();
  private toolCount = 0;
  private closed = false;
  private startTask: Promise<number> | null = null;

  constructor(
    private readonly toolSets: ToolSetRegistry,
    private readonly config: Config,
  ) {}

  /** Connect enabled MCP Servers in parallel in background without blocking HTTP startup */
  startAllAsync(serversCfg?: McpServersConfig): void {
    if (this.startTask || this.closed) return;
    this.startTask = this.runStartAll(serversCfg, { enabledOnly: true }).finally(() => {
      this.startTask = null;
    });
    void this.startTask.catch((err) => {
      logComponent("mcp").error("MCP background startup failed", { err });
    });
  }

  /** Synchronously wait for all enabled MCP Server connections (tests or blocking scenarios) */
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

  /** Start a single MCP Server (workshop manual control) */
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

  /** Stop a single MCP Server and unregister its tools */
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

    this.toolSets.unregisterToolSet(mcpToolSetId(name));
    this.serverErrors.delete(name);
    this.recountTools();
    return { ok: true, server: name, action: "stop" };
  }

  /** Start all enabled and disconnected servers */
  async startAllEnabled(): Promise<McpControlResult> {
    const cfg = this.config.data;
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

  /** Stop all connected MCP Servers */
  async stopAll(): Promise<McpControlResult> {
    for (const name of [...this.clients.keys()]) {
      await this.stopServer(name);
    }
    return { ok: true, action: "stop" };
  }

  private resolveServerConfig(name: string): McpServerConfig | undefined {
    const cfg = this.config.data;
    const fromCfg = cfg.mcp_servers?.[name] as McpServerConfig | undefined;
    return this.serverConfigs.get(name) ?? fromCfg;
  }

  private async runStartAll(
    serversCfg?: McpServersConfig,
    opts?: { enabledOnly?: boolean },
  ): Promise<number> {
    const cfg = this.config.data;
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

    const mcpTools = await session.listTools();
    const defs: ToolDef[] = [];

    for (const toolDef of mcpTools) {
      const originalName = toolDef.name;
      if (!originalName) continue;

      const prefixedName = `mcp_${name}_${originalName}`;
      const params = mcpToolParameters({ inputSchema: toolDef.inputSchema });

      defs.push({
        name: prefixedName,
        description: toolDef.description ?? `MCP tool ${originalName} (${name})`,
        parameters: params,
        handler: async (args) => {
          try {
            const result = await session.callTool(originalName, args);
            return extractMcpResult(result);
          } catch (err) {
            return toolError(`MCP ${originalName} failed: ${err}`);
          }
        },
      });
    }

    const setId = mcpToolSetId(name);
    this.toolSets.unregisterToolSet(setId);
    if (defs.length > 0) {
      this.toolSets.registerToolSet(setId, `MCP ${name}`, defs);
      logComponent("mcp").info(`MCP '${name}': ${defs.length} tool(s) registered`, {
        server: name,
        tool_count: defs.length,
      });
    }
    return defs.length;
  }

  private recountTools(): void {
    this.toolCount = this.toolSets
      .listToolSets()
      .filter((ts) => ts.name.startsWith("mcp_"))
      .reduce((n, ts) => n + ts.tools.length, 0);
  }

  /** Lightweight connection counts for /status memory_detail (no listTools RPC). */
  getConnectionSummary(): {
    server_count: number;
    connected_count: number;
    connecting_count: number;
  } {
    const cfg = this.config.data;
    const serversCfg = cfg.mcp_servers ?? {};
    const serverNames = new Set([...Object.keys(serversCfg), ...this.serverConfigs.keys()]);
    return {
      server_count: serverNames.size,
      connected_count: this.clients.size,
      connecting_count: this.connecting.size,
    };
  }

  async getStatus(): Promise<McpStatusResponse> {
    const cfg = this.config.data;
    const serversCfg = cfg.mcp_servers ?? {};
    const serverNames = new Set([...Object.keys(serversCfg), ...this.serverConfigs.keys()]);

    const servers: McpServerStatusView[] = [];
    for (const name of [...serverNames].toSorted()) {
      const rawCfg =
        this.serverConfigs.get(name) ?? (serversCfg[name] as McpServerConfig | undefined) ?? {};
      const enabled = isMcpServerEnabled(rawCfg);
      const session = this.clients.get(name);
      const error = this.serverErrors.get(name);
      const setId = mcpToolSetId(name);
      const registeredTools = this.toolSets.getToolSet(setId)?.tools ?? [];

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
          /* Some servers do not support resources */
        }
        try {
          const listed = await session.listPrompts();
          prompts = listed.map((p) => ({
            name: p.name,
            description: p.description,
            arguments: p.arguments,
          }));
        } catch {
          /* Some servers do not support prompts */
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
      `MCP closing ${clientCount} connection(s)` +
        (connectingCount ? ` (plus ${connectingCount} still connecting)` : "") +
        "…",
      { client_count: clientCount, connecting_count: connectingCount },
    );
    this.closed = true;
    if (this.startTask) {
      logComponent("shutdown").debug("MCP waiting for background startAll to finish…");
      await this.startTask.catch(() => {});
      logComponent("shutdown").debug("MCP background startAll finished", { ms: Date.now() - t0 });
    }

    for (const [name, session] of this.clients) {
      const ts = Date.now();
      try {
        await session.close();
        logComponent("shutdown").debug(`MCP '${name}' closed`, {
          ms: Date.now() - ts,
          server: name,
        });
      } catch (err) {
        logComponent("shutdown").warn(`MCP '${name}' close failed`, { err, server: name });
      }
    }
    for (const name of [...this.clients.keys()]) {
      this.toolSets.unregisterToolSet(mcpToolSetId(name));
    }
    this.clients.clear();
    this.serverConfigs.clear();
    this.serverErrors.clear();
    this.connecting.clear();
    this.toolCount = 0;
    this.closed = false;
    logComponent("shutdown").debug("MCP shutdown complete", { ms: Date.now() - t0 });
  }

  serverCount(): number {
    return this.clients.size;
  }

  getToolCount(): number {
    return this.toolCount;
  }
}
