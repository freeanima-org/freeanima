import { readAppVersionForCapability as readAppVersion } from "@freeanima/host/core/config/capability-injection";
import { omitUndefined } from "@freeanima/host/core/util";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  SSEClientTransport,
  type SSEClientTransportOptions,
} from "@modelcontextprotocol/sdk/client/sse.js";
import {
  StreamableHTTPClientTransport,
  type StreamableHTTPClientTransportOptions,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

export type McpTransportKind = "stdio" | "sse" | "http";

export type McpServerConfig = {
  command?: string;
  args?: string[];
  url?: string;
  transport?: McpTransportKind;
  /** @deprecated Prefer `headers.Authorization`; kept for runtime compat */
  api_key_env?: string;
  /** SSE / HTTP request headers (e.g. Authorization) */
  headers?: Record<string, string>;
  env?: Record<string, string>;
  cwd?: string;
  /** Connection timeout (ms), default 15000 */
  connect_timeout_ms?: number;
  /** Whether to auto-connect on Free Anima startup, default true */
  enabled?: boolean;
};

const DEFAULT_CONNECT_TIMEOUT_MS = 15_000;

const ENV_REF_RE = /env\("([^"]*)"\)/g;

/** Expand embedded `env("KEY")`；任一 KEY 缺失则返回 undefined。 */
function expandHeaderEnvRefs(value: string): string | undefined {
  let missing = false;
  const out = value.replace(ENV_REF_RE, (_full: string, key: string) => {
    const fromEnv = process.env[key];
    if (fromEnv === undefined || fromEnv === "") {
      missing = true;
      return "";
    }
    return fromEnv;
  });
  return missing ? undefined : out;
}

/**
 * Merge headers；展开 `env("KEY")`。
 * 迁移后推荐 `headers.Authorization: Bearer env("KEY")`；
 * 仍接受遗留 `api_key_env`（未写 Authorization 时注入 Bearer）。
 */
export function buildHttpRequestHeaders(cfg: McpServerConfig): Record<string, string> | undefined {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(cfg.headers ?? {})) {
    const expanded = expandHeaderEnvRefs(value);
    if (expanded !== undefined) headers[key] = expanded;
  }
  const hasAuthorization = Object.keys(headers).some((k) => k.toLowerCase() === "authorization");
  if (!hasAuthorization) {
    const apiKey = cfg.api_key_env ? process.env[cfg.api_key_env] : undefined;
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

export type McpToolDef = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};

export type McpResourceDef = {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
};

export type McpPromptDef = {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
};

function createTransport(serverName: string, cfg: McpServerConfig): Transport {
  const transport = cfg.transport ?? "stdio";

  if (transport === "http" || transport === "sse") {
    if (!cfg.url) {
      throw new Error(`MCP server '${serverName}': ${transport} transport requires url`);
    }
    const url = new URL(cfg.url);
    const headers = buildHttpRequestHeaders(cfg);

    if (transport === "http") {
      const opts: StreamableHTTPClientTransportOptions = {};
      if (headers) opts.requestInit = { headers };
      // SDK StreamableHTTPClientTransport.sessionId 为 string|undefined，与 Transport 严格可选不完全一致
      return new StreamableHTTPClientTransport(url, opts) as Transport;
    }

    // 旧 HTTP+SSE（已弃用）；连 FreeAnima Habitat /mcp 请用 transport: http
    const opts: SSEClientTransportOptions = {};
    if (headers) {
      opts.requestInit = { headers };
      opts.eventSourceInit = {
        fetch: (input, init) => {
          const merged = new Headers(init?.headers);
          for (const [key, value] of Object.entries(headers)) {
            merged.set(key, value);
          }
          return fetch(input, { ...init, headers: merged });
        },
      };
    }
    return new SSEClientTransport(url, opts);
  }

  if (!cfg.command) {
    throw new Error(`MCP server '${serverName}': stdio transport requires command`);
  }
  return new StdioClientTransport({
    command: cfg.command,
    args: cfg.args ?? [],
    ...(cfg.env !== undefined ? { env: cfg.env } : {}),
    ...(cfg.cwd !== undefined ? { cwd: cfg.cwd } : {}),
    stderr: "inherit",
  });
}

/** Single MCP Server conversation (SDK Client + Transport) */
export class McpClientSession {
  readonly name: string;
  private readonly client: Client;

  private constructor(name: string, client: Client) {
    this.name = name;
    this.client = client;
  }

  static async connect(serverName: string, cfg: McpServerConfig): Promise<McpClientSession> {
    const timeoutMs = cfg.connect_timeout_ms ?? DEFAULT_CONNECT_TIMEOUT_MS;
    const connectTask = (async () => {
      const transport = createTransport(serverName, cfg);
      const client = new Client({ name: "anima", version: readAppVersion() });
      await client.connect(transport);
      return new McpClientSession(serverName, client);
    })();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutTask = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`MCP server '${serverName}': connect timeout after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });

    try {
      return await Promise.race([connectTask, timeoutTask]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  async listTools(): Promise<McpToolDef[]> {
    const { tools } = await this.client.listTools();
    return tools.map((t) =>
      omitUndefined({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema ?? { type: "object", properties: {} },
      }),
    );
  }

  async listResources(): Promise<McpResourceDef[]> {
    const { resources } = await this.client.listResources();
    return resources.map((r) =>
      omitUndefined({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      }),
    );
  }

  async listPrompts(): Promise<McpPromptDef[]> {
    const { prompts } = await this.client.listPrompts();
    return prompts.map((p) =>
      omitUndefined({
        name: p.name,
        description: p.description,
        arguments: p.arguments?.map((a) =>
          omitUndefined({
            name: a.name,
            description: a.description,
            required: a.required,
          }),
        ),
      }),
    );
  }

  async callTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
  }> {
    const result = await this.client.callTool({ name: toolName, arguments: args });
    if ("content" in result && Array.isArray(result.content)) {
      return {
        content: result.content as Array<{ type: string; text?: string }>,
        isError: Boolean(result.isError),
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
