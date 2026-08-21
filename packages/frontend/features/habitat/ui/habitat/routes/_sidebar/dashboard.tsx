import { createFileRoute, Link } from "@tanstack/react-router";
import type {
  DependencyStatus,
  ServiceSnapshot,
} from "@freeanima/shared/rpc-contract/frames/snapshot.ts";
import { Badge, Button, Card, CardContent } from "@freeanima/ui-kit";
import { ConfirmDialog, showAlert, StatusAlert } from "@freeanima/ui-kit/composite";
import { useState } from "react";
import {
  getStatus,
  getUsageToday,
  restartService,
  type UsageTodayResult,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { formatUsageTriplet } from "@freeanima/shared/llm-usage";
import { asRecord } from "@freeanima/shared/util";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import { translateApiPayload } from "@freeanima/features/habitat/ui/habitat/lib/api-errors.ts";
import { dependencyStatusLabel } from "@freeanima/features/habitat/ui/habitat/lib/habitat-status.ts";
import {
  catchWithFallback,
  logCaughtError,
} from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/dashboard")({
  loader: async () => {
    const [status, usageToday] = await Promise.all([
      getStatus().catch(catchWithFallback("dashboard/getStatus", null)),
      getUsageToday().catch(catchWithFallback("dashboard/getUsageToday", null)),
    ]);
    return { status, usageToday };
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

type BadgeVariant = "success" | "destructive" | "ghost";

function dependencyBadgeVariant(status: DependencyStatus["status"]): BadgeVariant {
  if (status === "connected") return "success";
  if (status === "error") return "destructive";
  return "ghost";
}

function dependencyBadge(dep: DependencyStatus | undefined, name: string) {
  if (!dep) {
    return (
      <Badge variant="ghost" className="text-xs">
        {name} —
      </Badge>
    );
  }
  const latency =
    dep.status === "connected" && dep.latency_ms != null ? ` ${dep.latency_ms}ms` : "";
  const title = dep.status === "error" && dep.error ? dep.error : undefined;
  return (
    <Badge variant={dependencyBadgeVariant(dep.status)} className="text-xs" title={title}>
      {name} {dependencyStatusLabel(dep.status)}
      {latency}
    </Badge>
  );
}

function DashboardPage() {
  const { status, usageToday } = Route.useLoaderData();
  const [restarting, setRestarting] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  const svc = status;
  const extensions = svc?.extensions;

  const mcp = extensions?.mcp ?? {
    server_count: 0,
    connected_count: 0,
    connecting_count: 0,
    tool_count: 0,
  };

  const toolCount = svc?.tools ?? 0;
  const cronCount = svc?.cron_jobs ?? 0;
  const commandCount = extensions?.commands ?? null;

  const semanticMemoryCount = svc?.memory?.semantic_memory_count ?? 0;
  const dialogueMessageCount = svc?.memory?.dialogue_message_count ?? 0;

  const conversationsByPlatform = svc?.conversations?.by_platform ?? {};
  const platforms = svc?.platforms ?? {};
  const postgres = svc?.dependencies?.postgres;
  const redis = svc?.dependencies?.redis;

  const conversationPlatformRows = Object.entries(conversationsByPlatform)
    .map(([platform, count]) => ({ platform, count: count }))
    .toSorted((a, b) => b.count - a.count);

  const processMemoryKb = svc?.memory_kb ?? 0;
  const heapUsedKb = svc?.memory_detail?.heap_used_kb;
  const processMemoryLabel = processMemoryKb ? formatProcessMemoryKb(processMemoryKb) : "—";
  const heapMemoryHint =
    heapUsedKb != null ? `JSC 堆 ${formatProcessMemoryKb(heapUsedKb)}（非物理内存）` : null;

  const mcpSummary = `${String(mcp.server_count)} 服务器 · ${String(mcp.connected_count)} 已连接 · ${String(mcp.connecting_count)} 连接中 · ${String(mcp.tool_count)} 工具`;

  const runRestart = async () => {
    setShowRestartConfirm(false);
    setRestarting(true);
    try {
      const res = await restartService();
      await showAlert({
        description: translateApiPayload(res),
      });
    } catch (err) {
      logCaughtError("dashboard/restartService", err);
      await showAlert({
        description: `重启失败: ${err instanceof Error ? err.message : String(err)}`,
      });
      setRestarting(false);
    }
  };

  if (!svc) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-2">{"仪表盘"}</h2>
        <StatusAlert variant="error">{"服务状态加载失败"}</StatusAlert>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-2">{"仪表盘"}</h2>
      <div className="space-y-4">
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground mb-1.5">{"运行时"}</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <RuntimeCard
              svc={svc}
              processMemoryLabel={processMemoryLabel}
              heapMemoryHint={heapMemoryHint}
              postgres={postgres}
              redis={redis}
              restarting={restarting}
              onRestart={() => setShowRestartConfirm(true)}
            />
            <PlatformConnectionsCard platforms={platforms} />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-muted-foreground mb-1.5">{"对话与工具"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-stretch">
            <ConversationStatCard
              total={svc.conversations?.total ?? 0}
              platformRows={conversationPlatformRows}
            />
            <CompactExtensionCard
              title={"子代理"}
              href="/subagents"
              summary={
                "命名子代理档案存为 entity。allowed_tools 为硬天花板；运行时物化固定 tools 列表（禁止 toolset_load）。"
              }
            />
            <StatCard title={"工具"}>
              <p className="text-xl font-mono mt-1">{toolCount}</p>
              <p className="text-xs text-muted-foreground">{"已注册"}</p>
            </StatCard>
            <CompactExtensionCard title="MCP" href="/mcp" summary={mcpSummary} />
            <StatCard
              title={"定时任务"}
              action={
                <Link
                  to="/cron"
                  className="text-primary underline-offset-4 hover:underline text-xs"
                >
                  {"管理"}
                </Link>
              }
            >
              <p className="text-xl font-mono mt-1">{cronCount}</p>
              <p className="text-xs text-muted-foreground">{cronCount > 0 ? "已配置" : "无"}</p>
            </StatCard>
            <StatCard title={"Slash 命令"}>
              <p className="text-xl font-mono mt-1">{commandCount ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{"全平台"}</p>
            </StatCard>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-muted-foreground mb-1.5">{"用量"}</h3>
          <UsageTodayCard usageToday={usageToday} />
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <h3 className="text-sm font-semibold text-muted-foreground">{"记忆体系"}</h3>
            <Link
              to="/semantic-memory"
              search={{ passive: "1" }}
              className="text-primary underline-offset-4 hover:underline text-xs"
            >
              {"🔎 被动召回调试"}
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatCard title={"语义记忆"}>
              <p className="text-xl font-mono mt-1">{semanticMemoryCount}</p>
            </StatCard>
            <StatCard title={"对话消息"}>
              <p className="text-xl font-mono mt-1">{dialogueMessageCount}</p>
              <p className="text-xs text-muted-foreground">{"对话消息"}</p>
            </StatCard>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={showRestartConfirm}
        title={"重启服务"}
        description={"确定要重启服务吗？正在进行的对话将被中断。"}
        confirmLabel={"重启服务"}
        variant="error"
        onConfirm={() => void runRestart()}
        onCancel={() => setShowRestartConfirm(false)}
      />
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
  svc: ServiceSnapshot;
  processMemoryLabel: string;
  heapMemoryHint: string | null;
  postgres: DependencyStatus | undefined;
  redis: DependencyStatus | undefined;
  restarting: boolean;
  onRestart: () => void;
}) {
  return (
    <Card className="bg-muted py-0 lg:col-span-2">
      <CardContent className="py-3 px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
          <div>
            <h4 className="text-sm text-muted-foreground">{"服务状态"}</h4>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={svc.status === "running" ? "success" : "destructive"}>
                {svc.status}
              </Badge>
              <span className="text-xs text-muted-foreground">v{svc.version || "?"}</span>
            </div>
          </div>
          <div>
            <h4 className="text-sm text-muted-foreground">{"运行时间"}</h4>
            <p className="text-xl font-mono mt-1">{formatUptime(svc.uptime_seconds) || "—"}</p>
          </div>
          <div>
            <h4 className="text-sm text-muted-foreground">{"物理内存（RSS）"}</h4>
            <p className="text-xl font-mono mt-1">{processMemoryLabel}</p>
            {heapMemoryHint ? (
              <p className="text-xs text-muted-foreground mt-0.5">{heapMemoryHint}</p>
            ) : null}
          </div>
          <div>
            <h4 className="text-sm text-muted-foreground">{"当前模型"}</h4>
            <p className="text-base font-mono mt-1 truncate" title={svc.config?.model}>
              {svc.config?.model || "—"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground border-t border pt-2 mt-2">
          {svc.start_time_iso ? (
            <span>{`启动于 ${formatDisplayDateTime(svc.start_time_iso)}`}</span>
          ) : null}
          {svc.pid ? <span>PID {svc.pid}</span> : null}
          {dependencyBadge(postgres, "PG")}
          {dependencyBadge(redis, "Redis")}
          <div className="ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs border-yellow-500/50 text-yellow-700 hover:bg-yellow-500/10 dark:text-yellow-400"
              isDisabled={restarting}
              onClick={onRestart}
            >
              {restarting ? "重启中…" : "重启服务"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformConnectionsCard({ platforms }: { platforms: Record<string, unknown> }) {
  const entries = Object.entries(platforms);

  return (
    <Card className="bg-muted py-0">
      <CardContent className="py-3 px-4">
        <h3 className="text-sm text-muted-foreground">{"平台连接"}</h3>
        {entries.length === 0 ? (
          <div className="text-xs text-muted-foreground mt-1">{"无平台接入"}</div>
        ) : (
          <div className="mt-1 space-y-1 max-h-24 overflow-y-auto">
            {entries.map(([name, ps]) => {
              const info = asRecord(ps) ?? {};
              const status = typeof info.status === "string" ? info.status : undefined;
              const botName = typeof info.bot_name === "string" ? info.bot_name : undefined;
              return (
                <div key={name} className="flex items-center gap-2 text-sm">
                  <Badge
                    variant={status === "connected" ? "success" : "ghost"}
                    className="size-2 rounded-full p-0"
                  />
                  <span className="truncate">{name}</span>
                  {botName ? (
                    <span className="text-xs text-muted-foreground truncate">({botName})</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConversationStatCard({
  total,
  platformRows,
}: {
  total: number;
  platformRows: { platform: string; count: number }[];
}) {
  return (
    <div className="group/session relative h-full">
      <StatCard title={"对话"}>
        <p className="text-xl font-mono mt-1">{total}</p>
        <p className="text-xs text-muted-foreground">{"悬停查看分平台"}</p>
      </StatCard>
      <div
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden min-w-[10rem] rounded-lg bg-neutral px-3 py-2 text-xs text-neutral-content shadow-lg group-hover/session:block"
      >
        {platformRows.length === 0 ? (
          <p className="text-left">{"暂无分平台数据"}</p>
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

function UsageTodayCard({ usageToday }: { usageToday: UsageTodayResult | null }) {
  if (!usageToday) {
    return (
      <StatCard title={"今日用量"}>
        <p className="text-xs text-muted-foreground mt-1">{"加载失败"}</p>
      </StatCard>
    );
  }
  return (
    <StatCard title={`今日用量（${usageToday.day}）`}>
      <p className="text-sm font-mono mt-1">{formatUsageTriplet(usageToday.total)}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {`对话 ${formatUsageTriplet(usageToday.conversation)}`}
      </p>
      <p className="text-xs text-muted-foreground">
        {`Auto LLM ${formatUsageTriplet(usageToday.auto_llm)}`}
      </p>
    </StatCard>
  );
}

function CompactExtensionCard({
  title,
  href,
  summary,
}: {
  title: string;
  href: string;
  summary: string;
}) {
  return (
    <Card className="bg-muted py-0 h-full">
      <CardContent className="flex h-full flex-col py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm text-muted-foreground">{title}</h4>
          <Link to={href} className="text-primary underline-offset-4 hover:underline text-xs">
            {"管理"}
          </Link>
        </div>
        <p className="mt-1 flex-1 text-xs leading-snug text-muted-foreground">{summary}</p>
      </CardContent>
    </Card>
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
    <Card className="bg-muted py-0 h-full">
      <CardContent className="flex h-full flex-col py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm text-muted-foreground">{title}</h4>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
