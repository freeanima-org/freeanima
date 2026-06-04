import { createFileRoute, Link } from "@tanstack/react-router";
import type { ServiceStatus } from "@freeanima/legacy-api";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/chamber/dashboard")({
  loader: async () => {
    const [status, mcpData, acpData, cmdData, tools, cronJobs] = await Promise.all([
      trpc.status.get.query().catch(() => null),
      trpc.mcp.status.query().catch(() => null),
      trpc.acp.status.query().catch(() => null),
      trpc.sessions.commands.query({ all: true }).catch(() => null),
      trpc.status.tools.query().catch(() => null),
      trpc.status.cronJobs.query().catch(() => null),
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

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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

  const memoryStats = {
    files_count: svc?.memory?.files_count ?? 0,
    files_bytes: svc?.memory?.files_bytes ?? 0,
    facts_count: svc?.memory?.facts_count ?? 0,
    l2_index_rows: svc?.memory?.l2_index_rows ?? 0,
  };

  const sessionByPlatform = svc?.sessions?.by_platform ?? {};
  const platforms = svc?.platforms ?? {};

  const sessionPlatformRows = Object.entries(sessionByPlatform)
    .map(([platform, count]) => ({ platform, count: count as number }))
    .toSorted((a, b) => b.count - a.count);

  const processMemoryKb = svc?.memory_kb ?? 0;
  const processMemoryLabel = !processMemoryKb
    ? "—"
    : processMemoryKb / 1024 >= 1
      ? `${(processMemoryKb / 1024).toFixed(1)} MB`
      : `${processMemoryKb} KB`;

  const confirmRestart = async () => {
    if (!confirm("确定要重启服务吗？正在进行的对话将被中断。")) return;
    setRestarting(true);
    try {
      const res = await trpc.status.restart.mutate();
      alert((res as { message?: string }).message || "服务正在重启...");
    } catch (err) {
      alert(`重启失败: ${err instanceof Error ? err.message : String(err)}`);
      setRestarting(false);
    }
  };

  if (!svc) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-4">📊 仪表盘</h2>
        <div className="alert alert-error text-sm">加载服务状态失败</div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">📊 仪表盘</h2>
      <div className="space-y-6">
        <section>
          <h3 className="text-sm font-semibold text-base-content/60 mb-2">运行态</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="服务状态">
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`badge ${svc.status === "running" ? "badge-success" : "badge-error"}`}
                >
                  {svc.status}
                </span>
                <span className="text-xs text-base-content/50">v{svc.version || "?"}</span>
              </div>
            </StatCard>
            <StatCard title="运行时长">
              <p className="text-2xl font-mono mt-1">{formatUptime(svc.uptime_seconds) || "—"}</p>
            </StatCard>
            <StatCard title="进程内存">
              <p className="text-2xl font-mono mt-1">{processMemoryLabel}</p>
            </StatCard>
            <StatCard title="当前模型">
              <p className="text-lg font-mono mt-1 truncate" title={svc.config?.model}>
                {svc.config?.model || "—"}
              </p>
            </StatCard>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-base-content/60 mb-2">会话与工具</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="会话">
              <p className="text-2xl font-mono mt-1">{svc.sessions?.total ?? 0}</p>
              <p className="text-xs text-base-content/50">全平台总计</p>
            </StatCard>
            <StatCard title="工具">
              <p className="text-2xl font-mono mt-1">{toolCount}</p>
              <p className="text-xs text-base-content/50">已注册</p>
            </StatCard>
            <StatCard title="定时任务">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm text-base-content/60">定时任务</h4>
                <Link to="/chamber/cron" className="text-xs link link-hover">
                  管理
                </Link>
              </div>
              <p className="text-2xl font-mono mt-1">{cronCount}</p>
              <p className="text-xs text-base-content/50">{cronCount > 0 ? "已配置" : "无"}</p>
            </StatCard>
            <StatCard title="Slash 命令">
              <p className="text-2xl font-mono mt-1">{commandCount ?? "—"}</p>
              <p className="text-xs text-base-content/50">全平台</p>
            </StatCard>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-base-content/60">记忆</h3>
            <div className="flex gap-2 text-xs">
              <Link to="/chamber/memory-files" className="link link-hover">
                记忆文件
              </Link>
              <span className="text-base-content/30">·</span>
              <Link to="/chamber/memory" className="link link-hover">
                记忆台
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="记忆文件">
              <p className="text-2xl font-mono mt-1">{memoryStats.files_count}</p>
            </StatCard>
            <StatCard title="记忆文件体积">
              <p className="text-2xl font-mono mt-1">{formatBytes(memoryStats.files_bytes)}</p>
            </StatCard>
            <StatCard title="L3 事实">
              <p className="text-2xl font-mono mt-1">{memoryStats.facts_count}</p>
            </StatCard>
            <StatCard title="L2 索引">
              <p className="text-2xl font-mono mt-1">{memoryStats.l2_index_rows}</p>
              <p className="text-xs text-base-content/50">条消息</p>
            </StatCard>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-base-content/60">MCP</h3>
            <Link to="/chamber/mcp" className="text-xs link link-hover">
              管理
            </Link>
          </div>
          {mcpError ? (
            <div className="alert alert-warning text-sm mb-2 py-2">{mcpError}</div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="已配置">
              <p className="text-2xl font-mono mt-1">{mcp.server_count}</p>
            </StatCard>
            <StatCard title="已连接">
              <p className="text-2xl font-mono mt-1">{mcp.connected_count}</p>
            </StatCard>
            <StatCard title="连接中">
              <p className="text-2xl font-mono mt-1">{mcp.connecting_count}</p>
            </StatCard>
            <StatCard title="注册工具">
              <p className="text-2xl font-mono mt-1">{mcp.tool_count}</p>
            </StatCard>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-base-content/60">ACP</h3>
            <Link to="/chamber/acp" className="text-xs link link-hover">
              管理
            </Link>
          </div>
          {acpError ? (
            <div className="alert alert-warning text-sm mb-2 py-2">{acpError}</div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="已配置">
              <p className="text-2xl font-mono mt-1">{acp.agent_count}</p>
            </StatCard>
            <StatCard title="已连接">
              <p className="text-2xl font-mono mt-1">{acp.connected_count}</p>
            </StatCard>
            <StatCard title="活跃 Session">
              <p className="text-2xl font-mono mt-1">{acp.session_count}</p>
            </StatCard>
            <StatCard title="注册工具">
              <p className="text-2xl font-mono mt-1">{acp.tool_count}</p>
            </StatCard>
          </div>
        </section>

        <div className="card bg-base-200">
          <div className="card-body">
            <h3 className="card-title text-sm">会话按平台</h3>
            {sessionPlatformRows.length === 0 ? (
              <div className="text-sm text-base-content/50 mt-1">无会话</div>
            ) : (
              <div className="flex flex-wrap gap-2 mt-2">
                {sessionPlatformRows.map((row) => (
                  <span key={row.platform} className="badge badge-ghost badge-lg font-mono">
                    {row.platform}: {row.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card bg-base-200">
          <div className="card-body">
            <h3 className="card-title text-sm">平台连接</h3>
            {Object.keys(platforms).length === 0 ? (
              <div className="text-sm text-base-content/50 mt-1">无平台接入</div>
            ) : (
              <div className="mt-2 space-y-1">
                {Object.entries(platforms).map(([name, ps]) => (
                  <div key={name} className="flex items-center gap-2 text-sm">
                    <span
                      className={`badge badge-xs ${(ps as { status?: string }).status === "connected" ? "badge-success" : "badge-ghost"}`}
                    />
                    <span>{name}</span>
                    {(ps as { bot_name?: string }).bot_name ? (
                      <span className="text-xs text-base-content/50">
                        ({(ps as { bot_name?: string }).bot_name})
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card bg-base-200">
          <div className="card-body">
            <h3 className="card-title text-sm">系统</h3>
            <div className="text-sm space-y-1 mt-1">
              <p>逸灵风 v{svc.version || "?"}</p>
              {svc.start_time_iso ? (
                <p className="text-xs text-base-content/50">启动于 {svc.start_time_iso}</p>
              ) : null}
              {svc.pid ? <p className="text-xs text-base-content/50">PID {svc.pid}</p> : null}
              <div className="mt-3 pt-3 border-t border-base-300">
                <button
                  type="button"
                  className="btn btn-outline btn-warning btn-sm"
                  disabled={restarting}
                  onClick={() => void confirmRestart()}
                >
                  {restarting ? "重启中…" : "重启服务"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card bg-base-200">
      <div className="card-body py-4">
        <h4 className="text-sm text-base-content/60">{title}</h4>
        {children}
      </div>
    </div>
  );
}
