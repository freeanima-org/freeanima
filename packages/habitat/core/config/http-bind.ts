import type { HttpConfig } from "./schemas/http.ts";
import { DEFAULT_HABITAT_HTTP_PORT } from "./schemas/http-ports.ts";

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

/** 从 `http.allowed_hosts` 收集 TLS SAN 额外条目（去重、去空） */
export function collectHttpAllowedHosts(http?: HttpConfig | null): string[] {
  const raw = http?.allowed_hosts;
  if (!raw?.length) return [];
  return [...new Set(raw.map((entry) => entry.trim()).filter(Boolean))];
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
  if (fromConfig.length > 0) return formatHttpBindHosts(fromConfig);
  return fallback;
}

/** CLI `--port` 优先，否则读 `http.port`，最后回退默认 2658 */
export function resolveHttpPort(
  cliPort: number | undefined,
  http?: HttpConfig | null,
  fallback = DEFAULT_HABITAT_HTTP_PORT,
): number {
  if (cliPort != null && Number.isFinite(cliPort) && cliPort > 0) return Math.trunc(cliPort);
  const fromConfig = http?.port;
  if (fromConfig != null && fromConfig > 0) return fromConfig;
  return fallback;
}
