import { readAppVersionForCapability as readAppVersion } from "@freeanima/core/config";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  SSEClientTransport,
  type SSEClientTransportOptions,
} from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

export type McpServerConfig = {
  command?: string;
  args?: string[];
  url?: string;
  transport?: "stdio" | "sse";
  api_key_env?: string;
  env?: Record<string, string>;
  cwd?: string;
  /** Connection timeout (ms), default 15000 */
  connect_timeout_ms?: number;
  /** Whether to auto-connect on Free Anima startup, default true */
  enabled?: boolean;
};

const DEFAULT_CONNECT_TIMEOUT_MS = 15_000;

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

function resolveApiKey(envVar?: string): string | undefined {
  if (!envVar) return undefined;
  return process.env[envVar];
}

function createTransport(serverName: string, cfg: McpServerConfig): Transport {
  const transport = cfg.transport ?? "stdio";

  if (transport === "sse") {
    if (!cfg.url) {
      throw new Error(`MCP server '${serverName}': SSE transport requires url`);
    }
    const apiKey = resolveApiKey(cfg.api_key_env);
    const url = new URL(cfg.url);
    const opts: SSEClientTransportOptions = {};
    if (apiKey) {
      const headers = { Authorization: `Bearer ${apiKey}` };
      opts.requestInit = { headers };
      opts.eventSourceInit = {
        fetch: (input, init) => {
          const merged = new Headers(init?.headers);
          merged.set("Authorization", `Bearer ${apiKey}`);
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
    env: cfg.env,
    cwd: cfg.cwd,
    stderr: "inherit",
  });
}

/** Single MCP Server session (SDK Client + Transport) */
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
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: (t.inputSchema ?? { type: "object", properties: {} }) as Record<string, unknown>,
    }));
  }

  async listResources(): Promise<McpResourceDef[]> {
    const { resources } = await this.client.listResources();
    return resources.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    }));
  }

  async listPrompts(): Promise<McpPromptDef[]> {
    const { prompts } = await this.client.listPrompts();
    return prompts.map((p) => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments?.map((a) => ({
        name: a.name,
        description: a.description,
        required: a.required,
      })),
    }));
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
