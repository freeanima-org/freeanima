import { acpAgentSchema } from "@freeanima/legacy-kernel";
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
  enabled?: boolean;
  connect_timeout_ms?: number;
  prompt_timeout_ms?: number;
};

export type AcpSessionView = {
  session_id: string;
  session_id_short: string;
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

/** enabled 缺省或为 true 时视为启用 */
export function isAcpAgentEnabled(cfg: AcpAgentConfig): boolean {
  return cfg.enabled !== false;
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
  if (cfg.connect_timeout_ms) view.connect_timeout_ms = cfg.connect_timeout_ms;
  if (cfg.prompt_timeout_ms) view.prompt_timeout_ms = cfg.prompt_timeout_ms;
  return view;
}

export function shortSessionId(sessionId: string): string {
  if (sessionId.length <= 16) return sessionId;
  return `${sessionId.slice(0, 12)}…`;
}
