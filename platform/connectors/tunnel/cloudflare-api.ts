import { normalizeApiToken, validateApiTokenShape } from "./token-guide.ts";
import { cfFetch, type CloudflareApiOptions } from "./cloudflare-fetch.ts";

export type { CloudflareApiOptions } from "./cloudflare-fetch.ts";
export { describeApiTokenForLog, formatCloudflareApiFailure } from "./cloudflare-fetch.ts";

export type CloudflareApiError = {
  code: number;
  message: string;
};

export async function verifyApiToken(apiToken: string): Promise<{ id: string; status: string }> {
  const token = normalizeApiToken(apiToken);
  const shape = validateApiTokenShape(token);
  if (!shape.ok) {
    throw new Error(shape.reason);
  }
  return cfFetch(
    { operation: "验证 API Token", method: "GET", path: "/user/tokens/verify" },
    { apiToken: token },
    { method: "GET" },
  );
}

export async function listAccounts(apiToken: string): Promise<Array<{ id: string; name: string }>> {
  const result = await cfFetch<Array<{ id: string; name: string }>>(
    { operation: "获取 Cloudflare 账号列表", method: "GET", path: "/accounts" },
    { apiToken },
  );
  return result ?? [];
}

export async function listZones(
  apiToken: string,
): Promise<Array<{ id: string; name: string; status: string }>> {
  const result = await cfFetch<Array<{ id: string; name: string; status: string }>>(
    { operation: "列出 DNS Zone", method: "GET", path: "/zones?per_page=50" },
    { apiToken },
  );
  return result ?? [];
}

export type TunnelCreateResult = {
  id: string;
  name: string;
  credentials_file?: { AccountTag: string; TunnelID: string; TunnelSecret: string };
};

export async function createTunnel(
  options: CloudflareApiOptions,
  name: string,
): Promise<TunnelCreateResult> {
  if (!options.accountId) throw new Error("accountId 必填");
  return cfFetch(
    {
      operation: "创建 Cloudflare Tunnel",
      method: "POST",
      path: `/accounts/${options.accountId}/cfd_tunnel`,
    },
    options,
    {
      method: "POST",
      body: JSON.stringify({ name, config_src: "cloudflare" }),
    },
  );
}

export async function getTunnelToken(
  options: CloudflareApiOptions,
  tunnelId: string,
): Promise<string> {
  if (!options.accountId) throw new Error("accountId 必填");
  const result = await cfFetch<string>(
    {
      operation: "获取 Tunnel 连接器令牌",
      method: "GET",
      path: `/accounts/${options.accountId}/cfd_tunnel/${tunnelId}/token`,
    },
    options,
    { method: "GET" },
  );
  return result;
}

export type TunnelIngressConfig = {
  ingress: Array<{
    hostname?: string;
    service: string;
    originRequest?: Record<string, unknown>;
  }>;
};

export async function putTunnelConfig(
  options: CloudflareApiOptions,
  tunnelId: string,
  config: TunnelIngressConfig,
): Promise<void> {
  if (!options.accountId) throw new Error("accountId 必填");
  await cfFetch(
    {
      operation: "配置 Tunnel ingress",
      method: "PUT",
      path: `/accounts/${options.accountId}/cfd_tunnel/${tunnelId}/configurations`,
    },
    options,
    {
      method: "PUT",
      body: JSON.stringify({ config }),
    },
  );
}

export function tunnelCnameTarget(tunnelId: string): string {
  return `${tunnelId}.cfargotunnel.com`;
}

/** Cloudflare DNS 记录名（相对 zone，如 anima.example.com + example.com → anima） */
export function dnsRecordName(hostname: string, zoneName: string): string {
  if (hostname === zoneName) return "@";
  const suffix = `.${zoneName}`;
  if (hostname.endsWith(suffix)) return hostname.slice(0, -suffix.length);
  return hostname.includes(".") ? hostname.split(".")[0]! : hostname;
}

export type DnsRecordSnapshot = {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
};

export async function listDnsRecordsForHostname(
  options: CloudflareApiOptions,
  zoneId: string,
  hostname: string,
): Promise<DnsRecordSnapshot[]> {
  const result = await cfFetch<DnsRecordSnapshot[]>(
    {
      operation: "查询 DNS 记录",
      method: "GET",
      path: `/zones/${zoneId}/dns_records?name=${encodeURIComponent(hostname)}`,
    },
    options,
  );
  return result ?? [];
}

export function manualDnsDashboardSteps(
  hostname: string,
  tunnelId: string,
  zoneName: string,
): string[] {
  const recordLabel = dnsRecordName(hostname, zoneName);
  const nameHint = recordLabel === "@" ? zoneName : `${recordLabel}.${zoneName}`;
  return [
    `1. Cloudflare Dashboard → 选择 Zone「${zoneName}」→ DNS → Records → Add record`,
    `2. Type: CNAME · Name: ${recordLabel}（完整域名 ${nameHint}）`,
    `3. Target: ${tunnelCnameTarget(tunnelId)} · Proxy: Proxied（橙色云朵）`,
    `4. API Token 需含 Zone · DNS · Edit（范围含 ${zoneName}）`,
    `5. 保存后可用 anima tunnel dns 验证，或 dig @8.8.8.8 ${hostname}`,
  ];
}

export type EnsureTunnelDnsResult =
  | { ok: true; created: boolean }
  | { ok: false; reason: string; manualSteps: string[] };

function normalizeDnsContent(content: string): string {
  return content.replace(/\.$/, "").toLowerCase();
}

/** 幂等：查已有 CNAME，缺失则创建，并验证公网 DNS 记录存在 */
export async function ensureTunnelCnameRecord(
  options: CloudflareApiOptions,
  zoneId: string,
  zoneName: string,
  hostname: string,
  tunnelId: string,
): Promise<EnsureTunnelDnsResult> {
  const target = tunnelCnameTarget(tunnelId);
  const manualSteps = manualDnsDashboardSteps(hostname, tunnelId, zoneName);

  let existing: DnsRecordSnapshot[];
  try {
    existing = await listDnsRecordsForHostname(options, zoneId, hostname);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, reason, manualSteps };
  }

  const cname = existing.find((r) => r.type === "CNAME");
  if (cname) {
    const content = normalizeDnsContent(cname.content);
    if (content === target.toLowerCase()) {
      return { ok: true, created: false };
    }
    return {
      ok: false,
      reason: `已有 CNAME 指向 ${cname.content}，与 Tunnel 目标 ${target} 不一致`,
      manualSteps,
    };
  }

  try {
    await createCnameRecord(options, zoneId, zoneName, hostname, tunnelId);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, reason, manualSteps };
  }

  const after = await listDnsRecordsForHostname(options, zoneId, hostname);
  if (
    !after.some(
      (r) => r.type === "CNAME" && normalizeDnsContent(r.content) === target.toLowerCase(),
    )
  ) {
    return {
      ok: false,
      reason: "API 未报错但未查到 CNAME — 请检查 Token 的 Zone · DNS · Edit 权限",
      manualSteps,
    };
  }
  return { ok: true, created: true };
}

export async function createCnameRecord(
  options: CloudflareApiOptions,
  zoneId: string,
  zoneName: string,
  hostname: string,
  tunnelId: string,
): Promise<void> {
  const recordName = dnsRecordName(hostname, zoneName);
  await cfFetch(
    { operation: "创建 DNS CNAME 记录", method: "POST", path: `/zones/${zoneId}/dns_records` },
    options,
    {
      method: "POST",
      body: JSON.stringify({
        type: "CNAME",
        name: recordName,
        content: tunnelCnameTarget(tunnelId),
        proxied: true,
      }),
    },
  );
}

export function findZoneForHostname(
  zones: Array<{ id: string; name: string }>,
  hostname: string,
): { id: string; name: string } | null {
  for (const zone of zones.toSorted((a, b) => b.name.length - a.name.length)) {
    if (hostname === zone.name || hostname.endsWith(`.${zone.name}`)) {
      return zone;
    }
  }
  return null;
}

export function tunnelCredentialsJson(token: string): string {
  return token;
}
