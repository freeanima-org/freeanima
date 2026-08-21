/** 解析项目 MCP JSON（.agents/mcp.json、.mcp.json、.vscode/mcp.json、.cursor/mcp.json） */

import { asRecord } from "../../util/is-record.ts";
import type { ProjectMcpServerConfig } from "./types.ts";

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.filter((x): x is string => typeof x === "string");
}

function asStringRecord(v: unknown): Record<string, string> | undefined {
  const obj = asRecord(v);
  if (!obj) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(obj)) {
    if (typeof val === "string") out[k] = val;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** 单条 server 配置 → 归一化 */
export function normalizeMcpServerConfig(raw: unknown): ProjectMcpServerConfig | null {
  const obj = asRecord(raw);
  if (!obj) return null;

  const command = asString(obj.command);
  const url = asString(obj.url);
  const type = asString(obj.type) ?? asString(obj.transport);
  let transport: ProjectMcpServerConfig["transport"] | undefined;
  if (type === "stdio" || type === "sse" || type === "http") transport = type;
  else if (url) transport = type === "sse" ? "sse" : "http";
  else if (command) transport = "stdio";

  const enabled = obj.enabled === false ? false : obj.enabled === true ? true : undefined;

  const cfg: ProjectMcpServerConfig = {};
  if (command) cfg.command = command;
  const args = asStringArray(obj.args);
  if (args) cfg.args = args;
  if (url) cfg.url = url;
  if (transport) cfg.transport = transport;
  const headers = asStringRecord(obj.headers);
  if (headers) cfg.headers = headers;
  const env = asStringRecord(obj.env);
  if (env) cfg.env = env;
  const cwd = asString(obj.cwd);
  if (cwd) cfg.cwd = cwd;
  if (enabled !== undefined) cfg.enabled = enabled;

  if (!cfg.command && !cfg.url) return null;
  return cfg;
}

/**
 * 解析 mcp.json 文本。兼容：
 * - `{ "mcpServers": { ... } }`（Claude / 部分 Cursor）
 * - `{ "servers": { ... } }`（VS Code）
 * - 顶层直接 server map
 */
export function parseMcpJsonDocument(text: string): Record<string, ProjectMcpServerConfig> {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return {};
  }
  const root = asRecord(raw);
  if (!root) return {};

  const nested = asRecord(root.mcpServers) ?? asRecord(root.servers) ?? asRecord(root.mcp) ?? root;

  const out: Record<string, ProjectMcpServerConfig> = {};
  for (const [name, val] of Object.entries(nested)) {
    if (name === "inputs" || name === "sandbox") continue;
    const cfg = normalizeMcpServerConfig(val);
    if (cfg) out[name] = cfg;
  }
  return out;
}
