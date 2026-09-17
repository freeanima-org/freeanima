/**
 * Coding Outpost：项目 MCP 管理与 remote-tools 桥。
 * HTTP/SSE 在 SPA 内连接；stdio 在 Node/Bun 测试环境可用，Tauri WebView 暂记 status。
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { RemoteToolDefInput } from "@freeanima/shared/rpc-contract/frames/tool.ts";
import type { ProjectMcpServer } from "@freeanima/shared/coding/project-agent-context";

export type BridgedMcpTool = {
  serverName: string;
  localName: string;
  mcpToolName: string;
};

export type ProjectMcpStatus = {
  name: string;
  transport: string;
  connected: boolean;
  error?: string;
  tools: string[];
};

type Session = {
  server: ProjectMcpServer;
  client: Client | null;
  tools: BridgedMcpTool[];
  status: ProjectMcpStatus;
};

function mcpLocalName(serverName: string, toolName: string): string {
  const safeServer = serverName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeTool = toolName.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `mcp_${safeServer}_${safeTool}`;
}

async function createTransport(server: ProjectMcpServer): Promise<Transport> {
  const cfg = server.config;
  const transport = cfg.transport ?? (cfg.url ? "http" : "stdio");

  if (transport === "http" || transport === "sse") {
    if (!cfg.url) throw new Error(`${server.name}: ${transport} requires url`);
    const url = new URL(cfg.url);
    const headers = cfg.headers;
    if (transport === "http") {
      const opts = headers ? { requestInit: { headers } } : {};
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 第三方/库类型边界
      return new StreamableHTTPClientTransport(url, opts) as Transport;
    }
    const opts = headers
      ? {
          requestInit: { headers },
          eventSourceInit: {
            fetch: (input: RequestInfo | URL, init?: RequestInit) => {
              const merged = new Headers(init?.headers);
              for (const [k, v] of Object.entries(headers)) merged.set(k, v);
              return fetch(input, { ...init, headers: merged });
            },
          },
        }
      : {};
    return new SSEClientTransport(url, opts);
  }

  // stdio：仅 Node/Bun（测试）；浏览器/Tauri WebView 不可用
  if (!cfg.command) throw new Error(`${server.name}: stdio requires command`);
  const canStdio =
    typeof process !== "undefined" &&
    Boolean((process as { versions?: { node?: string } }).versions?.node);
  if (!canStdio) {
    throw new Error(
      `${server.name}: stdio MCP 需在具备 Node 的 Outpost 环境；当前 WebView 请改用 HTTP MCP 或后续壳桥`,
    );
  }
  const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
  const stdioOpts: {
    command: string;
    args: string[];
    env?: Record<string, string>;
    cwd?: string;
  } = {
    command: cfg.command,
    args: cfg.args ?? [],
  };
  if (cfg.env) stdioOpts.env = cfg.env;
  if (cfg.cwd) stdioOpts.cwd = cfg.cwd;
  return new StdioClientTransport(stdioOpts);
}

export class ProjectMcpManager {
  private sessions = new Map<string, Session>();

  listStatuses(): ProjectMcpStatus[] {
    return [...this.sessions.values()].map((s) => s.status);
  }

  listBridgedTools(): BridgedMcpTool[] {
    const out: BridgedMcpTool[] = [];
    for (const s of this.sessions.values()) out.push(...s.tools);
    return out;
  }

  toRemoteToolDefs(): RemoteToolDefInput[] {
    const defs: RemoteToolDefInput[] = [];
    for (const session of this.sessions.values()) {
      if (!session.status.connected) continue;
      for (const t of session.tools) {
        defs.push({
          local_name: t.localName,
          description: `Project MCP [${t.serverName}] ${t.mcpToolName}`,
          parameters: { type: "object", additionalProperties: true },
          return_kind: "json",
        });
      }
    }
    return defs;
  }

  async callTool(localName: string, args: Record<string, unknown>): Promise<string> {
    for (const session of this.sessions.values()) {
      const hit = session.tools.find((t) => t.localName === localName);
      if (!hit) continue;
      if (!session.status.connected || !session.client) {
        return JSON.stringify({ error: `MCP server offline: ${hit.serverName}` });
      }
      try {
        const result = await session.client.callTool({
          name: hit.mcpToolName,
          arguments: args,
        });
        return JSON.stringify(result);
      } catch (e) {
        return JSON.stringify({
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return JSON.stringify({ error: `unknown MCP tool: ${localName}` });
  }

  async reconcile(servers: ProjectMcpServer[]): Promise<ProjectMcpStatus[]> {
    const wanted = new Set(servers.map((s) => s.name));
    for (const name of Array.from(this.sessions.keys())) {
      if (!wanted.has(name)) await this.stopOne(name);
    }
    for (const server of servers) {
      const existing = this.sessions.get(server.name);
      if (existing?.status.connected) continue;
      if (existing) await this.stopOne(server.name);
      await this.startOne(server);
    }
    return this.listStatuses();
  }

  async stopAll(): Promise<void> {
    for (const name of Array.from(this.sessions.keys())) {
      await this.stopOne(name);
    }
  }

  private async stopOne(name: string): Promise<void> {
    const session = this.sessions.get(name);
    if (!session) return;
    this.sessions.delete(name);
    try {
      await session.client?.close();
    } catch {
      /* ignore */
    }
  }

  private async startOne(server: ProjectMcpServer): Promise<void> {
    const transportKind = server.config.transport ?? (server.config.url ? "http" : "stdio");
    const status: ProjectMcpStatus = {
      name: server.name,
      transport: transportKind,
      connected: false,
      tools: [],
    };
    try {
      const transport = await createTransport(server);
      const client = new Client({ name: "freeanima-coding", version: "0.0.0" });
      await client.connect(transport);
      const listed = await client.listTools();
      const tools: BridgedMcpTool[] = (listed.tools ?? []).map((t) => ({
        serverName: server.name,
        localName: mcpLocalName(server.name, t.name),
        mcpToolName: t.name,
      }));
      status.connected = true;
      status.tools = tools.map((t) => t.localName);
      this.sessions.set(server.name, { server, client, tools, status });
    } catch (e) {
      status.error = e instanceof Error ? e.message : String(e);
      // 保留失败状态供 UI/prompt；无 client
      this.sessions.set(server.name, {
        server,
        client: null,
        tools: [],
        status,
      });
    }
  }
}

let singleton: ProjectMcpManager | null = null;

export function getProjectMcpManager(): ProjectMcpManager {
  if (!singleton) singleton = new ProjectMcpManager();
  return singleton;
}

export function resetProjectMcpManagerForTest(): void {
  void singleton?.stopAll();
  singleton = null;
}
