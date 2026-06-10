/** Default HTTP bind address (comma-separated; pass via CLI --host) */
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

/** For status / health probes: prefer loopback */
export function resolveProbeHost(host: string): string {
  const hosts = parseBindHosts(host);
  if (hosts.includes("127.0.0.1")) return "127.0.0.1";
  if (hosts.includes("localhost")) return "127.0.0.1";
  const h = hosts[0] ?? "127.0.0.1";
  if (h === "0.0.0.0" || h === "::" || h === "[::]") return "127.0.0.1";
  return h;
}
