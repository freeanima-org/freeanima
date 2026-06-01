/** 默认 HTTP 监听地址（逗号分隔可传 CLI --host） */
export const DEFAULT_BIND_HOSTS = ["127.0.0.1"] as const;

export const DEFAULT_BIND_HOST = DEFAULT_BIND_HOSTS.join(",");

export function parseBindHosts(host: string): string[] {
  const hosts = host
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  if (!hosts.length) return [...DEFAULT_BIND_HOSTS];
  return hosts;
}

/** status / health 探测用：优先 loopback */
export function resolveProbeHost(host: string): string {
  const hosts = parseBindHosts(host);
  if (hosts.includes("127.0.0.1")) return "127.0.0.1";
  if (hosts.includes("localhost")) return "127.0.0.1";
  const h = hosts[0] ?? "127.0.0.1";
  if (h === "0.0.0.0" || h === "::" || h === "[::]") return "127.0.0.1";
  return h;
}
