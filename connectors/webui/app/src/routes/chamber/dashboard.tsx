import { createFileRoute, Link } from "@tanstack/react-router";
import type { DependencyStatus, ServiceStatus } from "@freeanima/connectors-webui/api";
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
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function dependencyBadgeClass(status: DependencyStatus["status"]) {
  if (status === "connected") return "badge-success";
  if (status === "error") return "badge-error";
  return "badge-ghost";
}

function dependencyLabel(dep: DependencyStatus) {
  if (dep.status === "connected") return "已连接";
  if (dep.status === "error") return "异常";
  return "未配置";
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
      {name} {dependencyLabel(dep)}
      {latency}
    </span>
  );
}

function DashboardPage() {
  const { status, mcpData, acpData, cmdData, tools, cronJobs } = Route.useLoaderData();
  const [restarting, setRestarting] = useState(false);

  const svc = status as ServiceStatus | null;
  const mcpError = mcpData ? "" : "MCP 状态加载失败";
  const acpError = acpData ? "" : "ACP 状态加载失败";

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
  const processMemoryLabel = !processMemoryKb
    ? "—"
    : processMemoryKb / 1024 >= 1
      ? `${(processMemoryKb / 1024).toFixed(1)} MB`
      : `${processMemoryKb} KB`;

  const mcpSummary = [
    `${mcp.server_count} 服务器`,
    `${mcp.connected_count} 已连接`,
    ...(mcp.connecting_count > 0 ? [`${mcp.connecting_count} 连接中`] : []),
    `${mcp.tool_count} 工具`,
  ].join(" · ");

  const acpSummary = [
    `${acp.agent_count} 代理`,
    `${acp.connected_count} 已连接`,
    `${acp.session_count} 会话`,
    `${acp.tool_count} 工具`,
  ].join(" · ");

  const confirmRestart = async () => {
    if (!confirm("确定要重启服务吗？正在进行的对话将被中断。")) return;
    setRestarting(true);
    try {
      const res = await restartService();
      alert((res as { message?: string }).message || "服务正在重启...");
    } catch (err) {
      alert(`重启失败: ${err instanceof Error ? err.message : String(err)}`);
      setRestarting(false);
    }
  };

  if (!svc) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-2">📊 仪表盘</h2>
        <div className="alert alert-error text-sm">加载服务状态失败</div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-2">📊 仪表盘</h2>
      <div className="space-y-4">
        <section>
          <h3 className="text-sm font-semibold text-base-content/60 mb-1.5">运行态</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <RuntimeCard
              svc={svc}
              processMemoryLabel={processMemoryLabel}
              postgres={postgres}
              redis={redis}
              restarting={restarting}
              onRestart={() => void confirmRestart()}
            />
            <PlatformConnectionsCard platforms={platforms} />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-base-content/60 mb-1.5">会话与工具</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-stretch">
            <SessionStatCard total={svc.sessions?.total ?? 0} platformRows={sessionPlatformRows} />
            <CompactExtensionCard
              title="ACP"
              href="/chamber/acp"
              summary={acpSummary}
              error={acpError}
            />
            <StatCard title="工具">
              <p className="text-xl font-mono mt-1">{toolCount}</p>
              <p className="text-xs text-base-content/50">已注册</p>
            </StatCard>
            <CompactExtensionCard
              title="MCP"
              href="/chamber/mcp"
              summary={mcpSummary}
              error={mcpError}
            />
            <StatCard
              title="定时任务"
              action={
                <Link to="/chamber/cron" className="text-xs link link-hover">
                  管理
                </Link>
              }
            >
              <p className="text-xl font-mono mt-1">{cronCount}</p>
              <p className="text-xs text-base-content/50">{cronCount > 0 ? "已配置" : "无"}</p>
            </StatCard>
            <StatCard title="Slash 命令">
              <p className="text-xl font-mono mt-1">{commandCount ?? "—"}</p>
              <p className="text-xs text-base-content/50">全平台</p>
            </StatCard>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <h3 className="text-sm font-semibold text-base-content/60">记忆</h3>
            <Link to="/chamber/memory" className="link link-hover text-xs">
              记忆台
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatCard title="语义记忆">
              <p className="text-xl font-mono mt-1">{semanticMemoryCount}</p>
            </StatCard>
            <StatCard title="对话消息">
              <p className="text-xl font-mono mt-1">{dialogueMessageCount}</p>
              <p className="text-xs text-base-content/50">条消息</p>
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
  postgres,
  redis,
  restarting,
  onRestart,
}: {
  svc: ServiceStatus;
  processMemoryLabel: string;
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
            <h4 className="text-sm text-base-content/60">服务状态</h4>
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
            <h4 className="text-sm text-base-content/60">运行时长</h4>
            <p className="text-xl font-mono mt-1">{formatUptime(svc.uptime_seconds) || "—"}</p>
          </div>
          <div>
            <h4 className="text-sm text-base-content/60">进程内存</h4>
            <p className="text-xl font-mono mt-1">{processMemoryLabel}</p>
          </div>
          <div>
            <h4 className="text-sm text-base-content/60">当前模型</h4>
            <p className="text-base font-mono mt-1 truncate" title={svc.config?.model}>
              {svc.config?.model || "—"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-base-content/50 border-t border-base-300 pt-2 mt-2">
          {svc.start_time_iso ? <span>启动于 {svc.start_time_iso}</span> : null}
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
              {restarting ? "重启中…" : "重启服务"}
            </button>
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
        <h3 className="text-sm text-base-content/60">平台连接</h3>
        {entries.length === 0 ? (
          <div className="text-xs text-base-content/50 mt-1">无平台接入</div>
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
      <StatCard title="会话">
        <p className="text-xl font-mono mt-1">{total}</p>
        <p className="text-xs text-base-content/50">悬停查看分平台</p>
      </StatCard>
      <div
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden min-w-[10rem] rounded-lg bg-neutral px-3 py-2 text-xs text-neutral-content shadow-lg group-hover/session:block"
      >
        {platformRows.length === 0 ? (
          <p className="text-left">暂无分平台数据</p>
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
            管理
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
