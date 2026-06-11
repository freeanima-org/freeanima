/** AnimaService internal snapshot types */

export type HealthSnapshot = {
  status: "ok";
  version: string;
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

export type ServiceSnapshot = {
  status: "running";
  pid: number;
  version: string;
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
  sessions: {
    total: number;
    by_platform: Record<string, number>;
  };
  tools: number;
  cron_jobs: number;
  platforms: Record<string, PlatformStatusSnapshot>;
  memory_kb: number;
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

export type SessionSummary = {
  id: string;
  title: string;
  created: string;
  platform: string;
};

export type SafeConfigSnapshot = {
  config: Record<string, unknown> & { api_key?: string };
};
