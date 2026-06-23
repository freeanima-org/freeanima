import { parseBindHosts } from "@freeanima/platform/bind-hosts";
import { prettyDuration, writeStatusLine } from "./status.ts";

type MemoryDetail = {
  heap_used_kb?: number;
  external_kb?: number;
  vm_size_kb?: number;
  tokenizer_repos?: string[];
  jieba_loaded?: boolean;
  mcp?: { server_count?: number; connected_count?: number };
  acp?: { agent_count?: number; connected_count?: number };
};

function formatMb(kb: number): string {
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatVirtualKb(kb: number): string {
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1)} GB`;
  return formatMb(kb);
}

function shortRepo(repo: string): string {
  const slash = repo.lastIndexOf("/");
  return slash >= 0 ? repo.slice(slash + 1) : repo;
}

function printSection(title: string): void {
  console.log("");
  console.log(`  ${title}`);
}

function printField(label: string, value: string): void {
  console.log(`    ${label.padEnd(12)}${value}`);
}

function formatPlatformLine(ps: Record<string, unknown>): string {
  const status = String(ps.status ?? "unknown");
  const extras: string[] = [];
  if (ps.bot_name) extras.push(String(ps.bot_name));
  return extras.length ? `${status} · ${extras.join(" · ")}` : status;
}

function formatConnectorSummary(detail: MemoryDetail | undefined): string | null {
  if (!detail) return null;
  const parts: string[] = [];
  const mcp = detail.mcp;
  if (mcp && (mcp.server_count ?? 0) > 0) {
    parts.push(`MCP ${mcp.connected_count ?? 0}/${mcp.server_count ?? 0}`);
  } else if (mcp && (mcp.connected_count ?? 0) > 0) {
    parts.push(`MCP ${mcp.connected_count} connected`);
  }
  const acp = detail.acp;
  if (acp && (acp.agent_count ?? 0) > 0) {
    parts.push(`ACP ${acp.connected_count ?? 0}/${acp.agent_count ?? 0}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

/** Render `anima service status` body when HTTP is up. */
export function printServiceRunningStatus(opts: {
  body: Record<string, unknown> | null;
  statusFile: Record<string, unknown>;
  host: string;
  port: number;
  healthMs: number;
  systemd: string | null;
  pidOverride?: number | null;
  tunnel?: {
    running: boolean;
    publicUrl: string | null;
    chamberUrl: string | null;
  } | null;
}): void {
  const api = opts.body ?? {};
  const pid = api.pid ?? opts.statusFile.pid ?? opts.pidOverride ?? "?";
  const version = api.version ?? opts.statusFile.version ?? "?";

  let uptime = api.uptime_seconds as number | undefined;
  if (uptime == null && opts.statusFile.start_time) {
    uptime = Date.now() / 1000 - Number(opts.statusFile.start_time);
  }
  const uptimeS = uptime != null ? prettyDuration(uptime) : "";

  const runtimeParts = [`PID ${pid}`, uptimeS ? `uptime ${uptimeS}` : "", `v${version}`].filter(
    Boolean,
  );

  console.log(`Free Anima · running · health ${opts.healthMs.toFixed(0)}ms`);
  if (opts.systemd) writeStatusLine("info", `systemd ${opts.systemd}`);

  printSection("runtime");
  printField("process", runtimeParts.join(" · "));
  for (const h of parseBindHosts(opts.host)) {
    printField("http", `http://${h}:${opts.port}`);
    printField("webui", `http://${h}:${opts.port}/webui`);
  }

  const apiTunnel = opts.body?.tunnel as
    | { public_url?: string; chamber_url?: string; webui_url?: string }
    | undefined;
  const tunnelPublic = opts.tunnel?.publicUrl ?? apiTunnel?.public_url ?? null;
  const tunnelChamber = opts.tunnel?.chamberUrl ?? apiTunnel?.chamber_url ?? null;
  if (tunnelPublic) {
    printSection("tunnel");
    if (opts.tunnel) {
      printField("running", opts.tunnel.running ? "yes" : "no — run: anima tunnel start");
    }
    printField("public", tunnelPublic);
    if (tunnelChamber) printField("chamber", tunnelChamber);
    if (apiTunnel?.webui_url) printField("webui", apiTunnel.webui_url);
  }

  const config = (api.config as Record<string, unknown>) ?? {};
  const model = config.model ?? opts.statusFile.model;
  const apiBase = config.api_base ?? opts.statusFile.api_base;
  if (model || apiBase) {
    printSection("llm");
    if (model) printField("model", String(model));
    if (apiBase) printField("provider", String(apiBase));
  }

  const platforms = (api.platforms as Record<string, Record<string, unknown>>) ?? {};
  const platformNames = Object.keys(platforms).toSorted();
  if (platformNames.length) {
    printSection(`gateways (${platformNames.length})`);
    for (const name of platformNames) {
      printField(name, formatPlatformLine(platforms[name] ?? {}));
    }
  }

  const sessions = api.sessions as Record<string, unknown> | undefined;
  const tools = api.tools;
  const cronJobs = api.cron_jobs;
  const workload: string[] = [];
  if (sessions && "total" in sessions) workload.push(`${sessions.total} sessions`);
  if (typeof tools === "number") workload.push(`${tools} tools`);
  if (typeof cronJobs === "number" && cronJobs > 0) workload.push(`${cronJobs} cron`);
  if (workload.length) {
    printSection("workload");
    printField("counts", workload.join(" · "));
  }

  const memKb = api.memory_kb;
  const memDetail = api.memory_detail as MemoryDetail | undefined;
  if (memKb) {
    printSection("memory");
    printField("rss (phys)", formatMb(Number(memKb)));
    if (memDetail?.heap_used_kb != null) {
      printField("heap (jsc)", formatMb(memDetail.heap_used_kb));
    }
    if (memDetail?.external_kb != null) {
      printField("native", formatMb(memDetail.external_kb));
    }
    if (memDetail?.vm_size_kb != null && memDetail.vm_size_kb > 0) {
      printField("virtual", formatVirtualKb(memDetail.vm_size_kb));
    }
    const repos = memDetail?.tokenizer_repos ?? [];
    if (repos.length) {
      const shortNames = repos.map(shortRepo).join(", ");
      printField("tokenizers", `${repos.length} loaded (${shortNames})`);
    }
    if (memDetail?.jieba_loaded != null) {
      printField("jieba", memDetail.jieba_loaded ? "loaded" : "idle");
    }
    const connectors = formatConnectorSummary(memDetail);
    if (connectors) printField("connectors", connectors);
  }
}
