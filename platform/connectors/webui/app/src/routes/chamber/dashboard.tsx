import { createFileRoute, Link } from "@tanstack/react-router";
import type { DependencyStatus, ServiceStatus } from "@freeanima/platform/connectors/webui/api";
import { useState } from "react";
import {
  getAcpStatus,
  getCronJobs,
  getMcpStatus,
  getStatus,
  getToolsStatus,
  listSessionCommands,
  restartService,
} from "@/lib/api.ts";
import { m } from "@/lib/i18n.ts";
import { formatDisplayDateTime } from "@/lib/format-datetime.ts";
import { translateApiPayload } from "@/lib/api-errors.ts";
import { dependencyStatusLabel } from "@/lib/webui-status.ts";

export const Route = createFileRoute("/chamber/dashboard")({
  loader: async () => {
    const [status, mcpData, acpData, cmdData, tools, cronJobs] = await Promise.all([
      getStatus().catch(() => null),
      getMcpStatus().catch(() => null),
      getAcpStatus().catch(() => null),
      listSessionCommands({ all: true }).catch(() => null),
      getToolsStatus().catch(() => null),
      getCronJobs().catch(() => null),
    ]);
    return { status, mcpData, acpData, cmdData, tools, cronJobs };
  },
  component: DashboardPage,
});

function formatUptime(seconds: number | null | undefined) {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${mins}m`;
  if (mins > 0) return `${mins}m ${s}s`;
  return `${s}s`;
}

function formatProcessMemoryKb(kb: number): string {
  return kb / 1024 >= 1 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

function dependencyBadgeClass(status: DependencyStatus["status"]) {
  if (status === "connected") return "badge-success";
  if (status === "error") return "badge-error";
  return "badge-ghost";
}

function dependencyBadge(dep: DependencyStatus | undefined, name: string) {
  if (!dep) {
    return <span className="badge badge-ghost badge-sm">{name} —</span>;
  }
  const latency =
    dep.status === "connected" && dep.latency_ms != null ? ` ${dep.latency_ms}ms` : "";
  const title = dep.status === "error" && dep.error ? dep.error : undefined;
  return (
    <span className={`badge badge-sm ${dependencyBadgeClass(dep.status)}`} title={title}>
      {name} {dependencyStatusLabel(dep.status)}
      {latency}
    </span>
  );
}

function DashboardPage() {
  const { status, mcpData, acpData, cmdData, tools, cronJobs } = Route.useLoaderData();
  const [restarting, setRestarting] = useState(false);

  const svc = status as ServiceStatus | null;
  const mcpError = mcpData ? "" : m.webui_chamber_dashboard_mcp_load_failed();
  const acpError = acpData ? "" : m.webui_chamber_dashboard_acp_load_failed();

  const mcp = {
    server_count: (mcpData as Record<string, number> | null)?.server_count ?? 0,
    connected_count: (mcpData as Record<string, number> | null)?.connected_count ?? 0,
    connecting_count: (mcpData as Record<string, number> | null)?.connecting_count ?? 0,
    tool_count: (mcpData as Record<string, number> | null)?.tool_count ?? 0,
  };

  const acp = {
    agent_count: (acpData as Record<string, number> | null)?.agent_count ?? 0,
    connected_count: (acpData as Record<string, number> | null)?.connected_count ?? 0,
    session_count: (acpData as Record<string, number> | null)?.session_count ?? 0,
    tool_count: (acpData as Record<string, number> | null)?.tool_count ?? 0,
  };

  const toolCount = svc?.tools ?? (tools as { tools?: unknown[] } | null)?.tools?.length ?? 0;
  const cronCount = svc?.cron_jobs ?? (cronJobs as { jobs?: unknown[] } | null)?.jobs?.length ?? 0;
  const commandCount = (cmdData as { commands?: unknown[] } | null)?.commands?.length ?? null;

  const semanticMemoryCount = svc?.memory?.semantic_memory_count ?? 0;
  const dialogueMessageCount = svc?.memory?.dialogue_message_count ?? 0;

  const sessionByPlatform = svc?.sessions?.by_platform ?? {};
  const platforms = svc?.platforms ?? {};
  const postgres = svc?.dependencies?.postgres;
  const redis = svc?.dependencies?.redis;

  const sessionPlatformRows = Object.entries(sessionByPlatform)
    .map(([platform, count]) => ({ platform, count: count as number }))
    .toSorted((a, b) => b.count - a.count);

  const processMemoryKb = svc?.memory_kb ?? 0;
  const heapUsedKb = svc?.memory_detail?.heap_used_kb;
  const processMemoryLabel = processMemoryKb ? formatProcessMemoryKb(processMemoryKb) : "—";
  const heapMemoryHint =
    heapUsedKb != null
      ? m.webui_chamber_dashboard_jsc_heap({ size: formatProcessMemoryKb(heapUsedKb) })
      : null;

  const mcpSummary = m.webui_chamber_dashboard_mcp_summary({
    servers: String(mcp.server_count),
    connected: String(mcp.connected_count),
    connecting: String(mcp.connecting_count),
    tools: String(mcp.tool_count),
  });

  const acpSummary = m.webui_chamber_dashboard_acp_summary({
    agents: String(acp.agent_count),
    connected: String(acp.connected_count),
    sessions: String(acp.session_count),
    tools: String(acp.tool_count),
  });

  const confirmRestart = async () => {
    if (!confirm(m.webui_chamber_dashboard_restart_confirm())) return;
    setRestarting(true);
    try {
      const res = await restartService();
      alert(translateApiPayload(res as { code?: string; message?: string }));
    } catch (err) {
      alert(
        m.webui_chamber_dashboard_restart_failed({
          detail: err instanceof Error ? err.message : String(err),
        }),
      );
      setRestarting(false);
    }
  };

  if (!svc) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-2">{m.webui_chamber_dashboard_title()}</h2>
        <div className="alert alert-error text-sm">{m.webui_chamber_dashboard_load_failed()}</div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-2">{m.webui_chamber_dashboard_title()}</h2>
      <div className="space-y-4">
        <section>
          <h3 className="text-sm font-semibold text-base-content/60 mb-1.5">
            {m.webui_chamber_dashboard_runtime()}
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <RuntimeCard
              svc={svc}
              processMemoryLabel={processMemoryLabel}
              heapMemoryHint={heapMemoryHint}
              postgres={postgres}
              redis={redis}
              restarting={restarting}
              onRestart={() => void confirmRestart()}
            />
            <PlatformConnectionsCard platforms={platforms} />
          </div>
          {svc.tunnel ? <TunnelLinksCard tunnel={svc.tunnel} /> : null}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-base-content/60 mb-1.5">
            {m.webui_chamber_dashboard_sessions_tools()}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-stretch">
            <SessionStatCard total={svc.sessions?.total ?? 0} platformRows={sessionPlatformRows} />
            <CompactExtensionCard
              title="ACP"
              href="/chamber/acp"
              summary={acpSummary}
              error={acpError}
            />
            <StatCard title={m.webui_common_tools()}>
              <p className="text-xl font-mono mt-1">{toolCount}</p>
              <p className="text-xs text-base-content/50">
                {m.webui_chamber_dashboard_tools_registered()}
              </p>
            </StatCard>
            <CompactExtensionCard
              title="MCP"
              href="/chamber/mcp"
              summary={mcpSummary}
              error={mcpError}
            />
            <StatCard
              title={m.webui_chamber_dashboard_cron()}
              action={
                <Link to="/chamber/cron" className="text-xs link link-hover">
                  {m.webui_chamber_dashboard_manage()}
                </Link>
              }
            >
              <p className="text-xl font-mono mt-1">{cronCount}</p>
              <p className="text-xs text-base-content/50">
                {cronCount > 0
                  ? m.webui_chamber_dashboard_cron_configured()
                  : m.webui_chamber_dashboard_cron_none()}
              </p>
            </StatCard>
            <StatCard title={m.webui_chamber_dashboard_slash_commands()}>
              <p className="text-xl font-mono mt-1">{commandCount ?? "—"}</p>
              <p className="text-xs text-base-content/50">
                {m.webui_chamber_dashboard_all_platforms()}
              </p>
            </StatCard>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <h3 className="text-sm font-semibold text-base-content/60">
              {m.webui_chamber_dashboard_memory()}
            </h3>
            <Link to="/chamber/memory" className="link link-hover text-xs">
              {m.webui_chamber_dashboard_memory_desk()}
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatCard title={m.webui_chamber_dashboard_semantic_memory()}>
              <p className="text-xl font-mono mt-1">{semanticMemoryCount}</p>
            </StatCard>
            <StatCard title={m.webui_chamber_dashboard_dialogue_messages()}>
              <p className="text-xl font-mono mt-1">{dialogueMessageCount}</p>
              <p className="text-xs text-base-content/50">
                {m.webui_chamber_dashboard_messages_count()}
              </p>
            </StatCard>
          </div>
        </section>
      </div>
    </div>
  );
}

function RuntimeCard({
  svc,
  processMemoryLabel,
  heapMemoryHint,
  postgres,
  redis,
  restarting,
  onRestart,
}: {
  svc: ServiceStatus;
  processMemoryLabel: string;
  heapMemoryHint: string | null;
  postgres: DependencyStatus | undefined;
  redis: DependencyStatus | undefined;
  restarting: boolean;
  onRestart: () => void;
}) {
  return (
    <div className="card bg-base-200 lg:col-span-2">
      <div className="card-body py-3 px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
          <div>
            <h4 className="text-sm text-base-content/60">
              {m.webui_chamber_dashboard_service_status()}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`badge ${svc.status === "running" ? "badge-success" : "badge-error"}`}
              >
                {svc.status}
              </span>
              <span className="text-xs text-base-content/50">v{svc.version || "?"}</span>
            </div>
          </div>
          <div>
            <h4 className="text-sm text-base-content/60">{m.webui_chamber_dashboard_uptime()}</h4>
            <p className="text-xl font-mono mt-1">{formatUptime(svc.uptime_seconds) || "—"}</p>
          </div>
          <div>
            <h4 className="text-sm text-base-content/60">
              {m.webui_chamber_dashboard_process_memory()}
            </h4>
            <p className="text-xl font-mono mt-1">{processMemoryLabel}</p>
            {heapMemoryHint ? (
              <p className="text-xs text-base-content/50 mt-0.5">{heapMemoryHint}</p>
            ) : null}
          </div>
          <div>
            <h4 className="text-sm text-base-content/60">
              {m.webui_chamber_dashboard_current_model()}
            </h4>
            <p className="text-base font-mono mt-1 truncate" title={svc.config?.model}>
              {svc.config?.model || "—"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-base-content/50 border-t border-base-300 pt-2 mt-2">
          {svc.start_time_iso ? (
            <span>
              {m.webui_chamber_dashboard_started_at({
                time: formatDisplayDateTime(svc.start_time_iso),
              })}
            </span>
          ) : null}
          {svc.pid ? <span>PID {svc.pid}</span> : null}
          {dependencyBadge(postgres, "PG")}
          {dependencyBadge(redis, "Redis")}
          <div className="ml-auto">
            <button
              type="button"
              className="btn btn-outline btn-warning btn-xs"
              disabled={restarting}
              onClick={onRestart}
            >
              {restarting ? m.webui_common_restarting() : m.webui_common_restart_service()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TunnelLinksCard({ tunnel }: { tunnel: NonNullable<ServiceStatus["tunnel"]> }) {
  return (
    <div className="card bg-base-200 lg:col-span-3">
      <div className="card-body py-3 px-4">
        <h3 className="text-sm text-base-content/60">{m.webui_chamber_dashboard_tunnel()}</h3>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-base-content/50">
              {m.webui_chamber_dashboard_tunnel_public()}:{" "}
            </span>
            <a
              href={tunnel.public_url}
              className="link link-primary font-mono text-xs"
              target="_blank"
              rel="noreferrer"
            >
              {tunnel.public_url}
            </a>
          </div>
          <div>
            <span className="text-base-content/50">
              {m.webui_chamber_dashboard_tunnel_chamber()}:{" "}
            </span>
            <a
              href={tunnel.chamber_url}
              className="link link-primary font-mono text-xs"
              target="_blank"
              rel="noreferrer"
            >
              {tunnel.chamber_url}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlatformConnectionsCard({ platforms }: { platforms: Record<string, unknown> }) {
  const entries = Object.entries(platforms);

  return (
    <div className="card bg-base-200">
      <div className="card-body py-3 px-4">
        <h3 className="text-sm text-base-content/60">
          {m.webui_chamber_dashboard_platform_connections()}
        </h3>
        {entries.length === 0 ? (
          <div className="text-xs text-base-content/50 mt-1">
            {m.webui_chamber_dashboard_no_platforms()}
          </div>
        ) : (
          <div className="mt-1 space-y-1 max-h-24 overflow-y-auto">
            {entries.map(([name, ps]) => (
              <div key={name} className="flex items-center gap-2 text-sm">
                <span
                  className={`badge badge-xs ${(ps as { status?: string }).status === "connected" ? "badge-success" : "badge-ghost"}`}
                />
                <span className="truncate">{name}</span>
                {(ps as { bot_name?: string }).bot_name ? (
                  <span className="text-xs text-base-content/50 truncate">
                    ({(ps as { bot_name?: string }).bot_name})
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionStatCard({
  total,
  platformRows,
}: {
  total: number;
  platformRows: { platform: string; count: number }[];
}) {
  return (
    <div className="group/session relative h-full">
      <StatCard title={m.webui_chamber_dashboard_sessions()}>
        <p className="text-xl font-mono mt-1">{total}</p>
        <p className="text-xs text-base-content/50">
          {m.webui_chamber_dashboard_hover_platforms()}
        </p>
      </StatCard>
      <div
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden min-w-[10rem] rounded-lg bg-neutral px-3 py-2 text-xs text-neutral-content shadow-lg group-hover/session:block"
      >
        {platformRows.length === 0 ? (
          <p className="text-left">{m.webui_chamber_dashboard_no_platform_data()}</p>
        ) : (
          <ul className="list-none space-y-0.5 text-left">
            {platformRows.map((row) => (
              <li key={row.platform} className="font-mono whitespace-nowrap">
                {row.platform}: {row.count}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CompactExtensionCard({
  title,
  href,
  summary,
  error,
}: {
  title: string;
  href: string;
  summary: string;
  error?: string;
}) {
  return (
    <div className="card bg-base-200 h-full">
      <div className="card-body flex h-full flex-col py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm text-base-content/60">{title}</h4>
          <Link to={href} className="text-xs link link-hover">
            {m.webui_chamber_dashboard_manage()}
          </Link>
        </div>
        {error ? (
          <p className="mt-1 text-xs text-warning">{error}</p>
        ) : (
          <p className="mt-1 flex-1 text-xs leading-snug text-base-content/70">{summary}</p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="card bg-base-200 h-full">
      <div className="card-body flex h-full flex-col py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm text-base-content/60">{title}</h4>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}
