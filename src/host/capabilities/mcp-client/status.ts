import { isEnabledByDefault } from "@freeanima/host/core/util";
import type { McpServerConfig } from "./client.ts";

export type McpServerConfigView = {
  transport: "stdio" | "sse" | "http";
  enabled: boolean;
  command?: string;
  args?: string[];
  url?: string;
  api_key_env?: string;
  headers?: Record<string, string>;
  cwd?: string;
  env?: Record<string, string>;
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

/** treated as enabled when enabled is omitted or true */
export function isMcpServerEnabled(cfg: McpServerConfig): boolean {
  return isEnabledByDefault(cfg);
}

/** Sanitized MCP config for workshop / API display */
export function sanitizeMcpConfig(cfg: McpServerConfig): McpServerConfigView {
  const view: McpServerConfigView = {
    transport: cfg.transport ?? "stdio",
    enabled: isMcpServerEnabled(cfg),
  };
  if (cfg.command) view.command = cfg.command;
  if (cfg.args?.length) view.args = cfg.args;
  if (cfg.url) view.url = cfg.url;
  if (cfg.api_key_env) view.api_key_env = cfg.api_key_env;
  if (cfg.headers && Object.keys(cfg.headers).length > 0) view.headers = { ...cfg.headers };
  if (cfg.cwd) view.cwd = cfg.cwd;
  if (cfg.connect_timeout_ms) view.connect_timeout_ms = cfg.connect_timeout_ms;
  if (cfg.env && Object.keys(cfg.env).length > 0) view.env = { ...cfg.env };
  return view;
}
