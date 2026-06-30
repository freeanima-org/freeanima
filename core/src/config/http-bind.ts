import type { HttpConfig } from "./schemas/http.ts";

export const DEFAULT_HTTP_BIND_HOST = "127.0.0.1";

/** 解析逗号分隔的监听地址（与 CLI `--host` 一致） */
export function parseHttpBindHostInput(host: string): string[] {
  return host
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** 从 `http.host` 收集监听地址（字符串或数组） */
export function collectHttpBindHosts(http?: HttpConfig | null): string[] {
  const raw = http?.host;
  if (!raw) return [];
  if (typeof raw === "string") return parseHttpBindHostInput(raw);
  return raw.map((entry) => entry.trim()).filter(Boolean);
}

export function formatHttpBindHosts(hosts: string[]): string {
  return hosts.join(",");
}

/** CLI `--host` 优先，否则读 `http.host`，最后回退默认 loopback */
export function resolveHttpBindHost(
  cliHost: string | undefined,
  http?: HttpConfig | null,
  fallback = DEFAULT_HTTP_BIND_HOST,
): string {
  const fromCli = cliHost?.trim();
  if (fromCli) return fromCli;
  const fromConfig = collectHttpBindHosts(http);
  if (fromConfig.length) return formatHttpBindHosts(fromConfig);
  return fallback;
}
