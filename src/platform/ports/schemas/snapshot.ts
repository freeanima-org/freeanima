/** AppRuntime internal snapshot types */

import type { ComponentBuildMeta } from "@freeanima/frontend/shell-sdk/build-meta";

export type HealthSnapshot = {
  status: "ok";
  version: string;
  build?: ComponentBuildMeta;
  /** Habitat 进程本次启动时间（CST ISO） */
  started_at?: string;
  /** health.probe：Bearer 是否足以访问其余 REST API */
  authed?: boolean;
};

export type PlatformStatusSnapshot = {
  status: string;
  since?: number;
  [key: string]: unknown;
};

export type DependencyStatus =
  | { status: "connected"; latency_ms?: number }
  | { status: "error"; error?: string }
  | { status: "not_configured" };

export type TokenizerBindingStatus = {
  model: string;
  repo: string;
  using_fallback: boolean;
};

export type ProcessMemoryDetail = {
  /** Physical resident set (VmRSS or process.memoryUsage().rss). */
  rss_kb: number;
  /** Virtual address space (VmSize); JSC Gigacage reservation, not physical RAM. */
  vm_size_kb: number;
  heap_used_kb: number;
  heap_total_kb: number;
  external_kb: number;
  array_buffers_kb: number;
  tokenizer_repos: string[];
  tokenizer_bindings: TokenizerBindingStatus[];
  jieba_loaded: boolean;
  mcp: {
    server_count: number;
    connected_count: number;
    connecting_count: number;
  };
  acp: {
    agent_count: number;
    connected_count: number;
  };
};

export type ExtensionSummaries = {
  mcp: {
    server_count: number;
    connected_count: number;
    connecting_count: number;
    tool_count: number;
  };
  acp: {
    agent_count: number;
    connected_count: number;
    session_count: number;
    tool_count: number;
  };
  commands: number;
};

export type ServiceSnapshot = {
  status: "running";
  pid: number;
  version: string;
  build?: ComponentBuildMeta;
  uptime_seconds: number | null;
  start_time_iso: string;
  config: {
    model?: string;
    api_base?: string;
  };
  tokenizer?: {
    chat?: TokenizerBindingStatus;
    embedding?: TokenizerBindingStatus;
  };
  conversations: {
    total: number;
    by_platform: Record<string, number>;
  };
  tools: number;
  cron_jobs: number;
  extensions: ExtensionSummaries;
  platforms: Record<string, PlatformStatusSnapshot>;
  memory_kb: number;
  memory_detail?: ProcessMemoryDetail;
  memory: {
    files_count: number;
    files_bytes: number;
    semantic_memory_count: number;
    dialogue_message_count: number;
  };
  host?: string;
  port?: number;
  dependencies: {
    postgres: DependencyStatus;
    redis: DependencyStatus;
  };
};

export type ConversationSummary = {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  platform: string;
  archived_at?: Date | null;
  /** 用户未读（assistant 回复尚未被用户读到） */
  unread?: boolean;
};

export type SafeConfigSnapshot = {
  config: Record<string, unknown> & { api_key?: string };
};
