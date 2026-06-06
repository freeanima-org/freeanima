/** AnimaService 内部快照类型（非 HTTP 契约） */

export type HealthSnapshot = {
  status: "ok";
  version: string;
};

export type PlatformStatusSnapshot = {
  status: string;
  since?: number;
  [key: string]: unknown;
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
    facts_count: number;
    l2_index_rows: number;
  };
  host?: string;
  port?: number;
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
