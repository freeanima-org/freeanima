import { TUNNEL_PASS_PATHS, type TunnelConfigFields } from "@freeanima/core/config";
import { credential, FileConfig } from "@freeanima/platform/config";
import {
  ensureTunnelCnameRecord,
  findZoneForHostname,
  listZones,
  manualDnsDashboardSteps,
  normalizeApiToken,
  resolveTunnelApiToken,
} from "@freeanima/platform/connectors/tunnel";
import { writeStatusLine } from "../service-common.ts";

function loadTunnelFromConfig(): TunnelConfigFields {
  const tunnel = FileConfig.open().data.tunnel;
  if (!tunnel?.hostname) throw new Error("tunnel.hostname 未配置 — 先运行 anima tunnel setup");
  if (!tunnel.cloudflare?.tunnel_id) {
    throw new Error("tunnel.cloudflare.tunnel_id 未配置 — 先运行 anima tunnel setup");
  }
  if (!tunnel.cloudflare?.account_id) {
    throw new Error("tunnel.cloudflare.account_id 未配置");
  }
  return tunnel;
}

function resolveApiToken(tunnel: TunnelConfigFields): string {
  if (tunnel.credentials?.api_token) {
    return resolveTunnelApiToken(tunnel.credentials.api_token);
  }
  return normalizeApiToken(credential(TUNNEL_PASS_PATHS.apiToken, "token"));
}

export async function runTunnelDnsEnsure(): Promise<void> {
  const tunnel = loadTunnelFromConfig();
  const apiToken = resolveApiToken(tunnel);
  const cloudflare = tunnel.cloudflare;
  const hostname = tunnel.hostname;
  const accountId = cloudflare?.account_id;
  const tunnelId = cloudflare?.tunnel_id;
  if (accountId === undefined || tunnelId === undefined || hostname === undefined) {
    throw new Error("tunnel 配置不完整 — 先运行 anima tunnel setup");
  }
  const apiOpts = { apiToken, accountId };

  let zoneId = tunnel.cloudflare?.zone_id;
  let zoneName: string | undefined;

  const zones = await listZones(apiToken);
  if (zoneId) {
    zoneName = zones.find((z) => z.id === zoneId)?.name;
  }
  if (!zoneId || !zoneName) {
    const zone = findZoneForHostname(zones, hostname);
    if (!zone) {
      console.error(`未找到 ${hostname} 的 Cloudflare Zone`);
      const guessZone = hostname.split(".").slice(-2).join(".");
      for (const step of manualDnsDashboardSteps(hostname, tunnelId, guessZone)) {
        console.log(`  ${step}`);
      }
      process.exit(1);
    }
    zoneId = zone.id;
    zoneName = zone.name;
  }

  console.log(`配置 DNS: ${hostname} → ${tunnelId}.cfargotunnel.com (zone ${zoneName})`);
  const result = await ensureTunnelCnameRecord(apiOpts, zoneId, zoneName, hostname, tunnelId);
  if (result.ok) {
    writeStatusLine("ok", result.created ? "CNAME 已创建" : "CNAME 已存在");
    console.log(`  公网: https://${hostname}`);
    return;
  }

  console.error("DNS 配置失败:");
  for (const line of result.reason.split("\n")) {
    if (line.trim()) console.error(`  ${line}`);
  }
  console.error("");
  console.error("手动步骤:");
  for (const step of result.manualSteps) {
    console.log(`  ${step}`);
  }
  process.exit(1);
}
