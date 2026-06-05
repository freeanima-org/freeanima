import type { McpServerConfig } from "./client.ts";

export type McpServerConfigView = {
  transport: "stdio" | "sse";
  enabled: boolean;
  command?: string;
  args?: string[];
  url?: string;
  api_key_env?: string;
  cwd?: string;
  env_keys?: string[];
  connect_timeout_ms?: number;
};

export type McpToolView = {
  original_name: string;
  registered_name: string;
  description?: string;
  input_schema: Record<string, unknown>;
};

export type McpResourceView = {
  uri: string;
  name?: string;
  description?: string;
  mime_type?: string;
};

export type McpPromptView = {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
};

export type McpRegisteredToolView = {
  name: string;
  description: string;
};

export type McpServerStatusView = {
  name: string;
  config: McpServerConfigView;
  status: "connected" | "connecting" | "error" | "not_started" | "disabled";
  error?: string;
  tools: McpToolView[];
  resources: McpResourceView[];
  prompts: McpPromptView[];
  registered_tools: McpRegisteredToolView[];
};

export type McpStatusResponse = {
  server_count: number;
  connected_count: number;
  connecting_count: number;
  tool_count: number;
  servers: McpServerStatusView[];
};

export type McpControlResult = {
  ok: boolean;
  error?: string;
  server?: string;
  action?: "start" | "stop";
};

/** enabled 缺省或为 true 时视为启用 */
export function isMcpServerEnabled(cfg: McpServerConfig): boolean {
  return cfg.enabled !== false;
}

/** 脱敏 MCP 配置供工作间 / API 展示 */
export function sanitizeMcpConfig(cfg: McpServerConfig): McpServerConfigView {
  const view: McpServerConfigView = {
    transport: cfg.transport ?? "stdio",
    enabled: isMcpServerEnabled(cfg),
  };
  if (cfg.command) view.command = cfg.command;
  if (cfg.args?.length) view.args = cfg.args;
  if (cfg.url) view.url = cfg.url;
  if (cfg.api_key_env) view.api_key_env = cfg.api_key_env;
  if (cfg.cwd) view.cwd = cfg.cwd;
  if (cfg.connect_timeout_ms) view.connect_timeout_ms = cfg.connect_timeout_ms;
  if (cfg.env && Object.keys(cfg.env).length > 0) {
    view.env_keys = Object.keys(cfg.env);
  }
  return view;
}
