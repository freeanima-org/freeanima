import { isEnabledByDefault, omitUndefined } from "@freeanima/host/core/util";
import { acpAgentSchema } from "@freeanima/host/core/config";
import type { z } from "zod";

export type AcpAgentConfig = z.infer<typeof acpAgentSchema>;

export type AcpAgentConfigView = {
  command?: string;
  args?: string[];
  cwd?: string;
  description?: string;
  adapter?: string;
  plan_mode?: string | false;
  agent_mode?: string;
  model?: string;
  enabled?: boolean;
  connect_timeout_ms?: number;
  prompt_timeout_ms?: number;
  health_check_interval_ms?: number;
  session_ttl_ms?: number;
  prompt_retry_once?: boolean;
  auto_restart?: boolean;
  max_concurrent_tasks?: number;
};

export type AcpSessionView = {
  conversation_id: string;
  conversation_id_short: string;
  agent: string;
};

export type AcpRegisteredToolView = {
  name: string;
  description: string;
};

export type AcpAgentStatusView = {
  name: string;
  config: AcpAgentConfigView;
  status: "connected" | "starting" | "error" | "not_started" | "disabled";
  error?: string;
  tool: AcpRegisteredToolView | null;
  sessions: AcpSessionView[];
};

export type AcpStatusResponse = {
  agent_count: number;
  connected_count: number;
  session_count: number;
  tool_count: number;
  agents: AcpAgentStatusView[];
};

export type AcpControlResult = {
  ok: boolean;
  error?: string;
  agent?: string;
  action?: "start" | "stop";
};

/** treated as enabled when enabled is omitted or true */
export function isAcpAgentEnabled(cfg: AcpAgentConfig): boolean {
  return isEnabledByDefault(omitUndefined({ enabled: cfg.enabled }));
}

export function sanitizeAcpConfig(cfg: AcpAgentConfig): AcpAgentConfigView {
  const view: AcpAgentConfigView = {
    enabled: isAcpAgentEnabled(cfg),
  };
  if (cfg.command) view.command = cfg.command;
  if (cfg.args?.length) view.args = cfg.args;
  if (cfg.cwd) view.cwd = cfg.cwd;
  if (cfg.description) view.description = cfg.description;
  if (cfg.adapter) view.adapter = cfg.adapter;
  if (cfg.plan_mode !== undefined) view.plan_mode = cfg.plan_mode as string | false;
  if (cfg.agent_mode) view.agent_mode = cfg.agent_mode;
  if (cfg.model) view.model = cfg.model;
  if (cfg.connect_timeout_ms) view.connect_timeout_ms = cfg.connect_timeout_ms;
  if (cfg.prompt_timeout_ms) view.prompt_timeout_ms = cfg.prompt_timeout_ms;
  if (cfg.health_check_interval_ms != null) {
    view.health_check_interval_ms = cfg.health_check_interval_ms;
  }
  if (cfg.session_ttl_ms != null) view.session_ttl_ms = cfg.session_ttl_ms;
  if (cfg.prompt_retry_once != null) view.prompt_retry_once = cfg.prompt_retry_once;
  if (cfg.auto_restart != null) view.auto_restart = cfg.auto_restart;
  if (cfg.max_concurrent_tasks != null) view.max_concurrent_tasks = cfg.max_concurrent_tasks;
  return view;
}

export function shortSessionId(conversationId: string): string {
  if (conversationId.length <= 16) return conversationId;
  return `${conversationId.slice(0, 12)}…`;
}
