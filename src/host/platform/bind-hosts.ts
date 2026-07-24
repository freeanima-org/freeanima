/** Default HTTP bind address (comma-separated; pass via CLI --host) */
export const DEFAULT_BIND_HOSTS = ["127.0.0.1"] as const;

export const DEFAULT_BIND_HOST = DEFAULT_BIND_HOSTS.join(",");

const ALL_IPV4 = "0.0.0.0";
const ALL_IPV6 = "::";

export function parseBindHosts(host: string): string[] {
  const hosts = host
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  if (hosts.length === 0) return [...DEFAULT_BIND_HOSTS];
  return hosts;
}

/**
 * 合并监听地址：0.0.0.0/:: 覆盖其余；去重。
 * 多地址会各占一个 socket（同端口不同网卡），勿与 0.0.0.0 混用。
 */
export function coalesceBindHosts(hosts: string[]): string[] {
  const normalized = hosts.map((h) => h.trim()).filter(Boolean);
  if (normalized.length === 0) return [...DEFAULT_BIND_HOSTS];
  if (normalized.includes(ALL_IPV4)) return [ALL_IPV4];
  if (normalized.includes(ALL_IPV6) || normalized.includes("[::]")) return [ALL_IPV6];
  return [...new Set(normalized)];
}

/** For status / health probes: prefer loopback */
export function resolveProbeHost(host: string): string {
  const hosts = parseBindHosts(host);
  if (hosts.includes("127.0.0.1")) return "127.0.0.1";
  if (hosts.includes("localhost")) return "127.0.0.1";
  const h = hosts[0] ?? "127.0.0.1";
  if (h === "0.0.0.0" || h === "::" || h === "[::]") return "127.0.0.1";
  return h;
}
