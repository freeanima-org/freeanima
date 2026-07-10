import { createFileRoute, Link } from "@tanstack/react-router";
import type { DependencyStatus, ServiceSnapshot } from "@freeanima/platform/ports/schemas/snapshot";
import { Badge, Button, Card, CardContent } from "@freeanima/frontend/ui-kit";
import { ConfirmDialog, showAlert, StatusAlert } from "@freeanima/frontend/ui-kit/composite";
import { useState } from "react";
import { getStatus, restartService } from "@freeanima/features/console/ui/console/lib/api.ts";
import { m } from "@freeanima/features/console/ui/console/lib/i18n.ts";
import { formatDisplayDateTime } from "@freeanima/features/console/ui/console/lib/format-datetime.ts";
import { translateApiPayload } from "@freeanima/features/console/ui/console/lib/api-errors.ts";
import { dependencyStatusLabel } from "@freeanima/features/console/ui/console/lib/console-status.ts";
import {
  catchWithFallback,
  logCaughtError,
} from "@freeanima/features/console/ui/console/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/dashboard")({
  loader: async () => {
    const status = await getStatus().catch(catchWithFallback("dashboard/getStatus", null));
    return { status };
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
  const { status } = Route.useLoaderData();
  const [restarting, setRestarting] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  const svc = status as ServiceSnapshot | null;
  const extensions = svc?.extensions;

  const mcp = extensions?.mcp ?? {
    server_count: 0,
    connected_count: 0,
    connecting_count: 0,
    tool_count: 0,
  };

  const acp = extensions?.acp ?? {
    agent_count: 0,
    connected_count: 0,
    session_count: 0,
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
    .map(([platform, count]) => ({ platform, count: count as number }))
    .toSorted((a, b) => b.count - a.count);

  const processMemoryKb = svc?.memory_kb ?? 0;
  const heapUsedKb = svc?.memory_detail?.heap_used_kb;
  const processMemoryLabel = processMemoryKb ? formatProcessMemoryKb(processMemoryKb) : "—";
  const heapMemoryHint =
    heapUsedKb != null
      ? m.console_dashboard_jsc_heap({ size: formatProcessMemoryKb(heapUsedKb) })
      : null;

  const mcpSummary = m.console_dashboard_mcp_summary({
    servers: String(mcp.server_count),
    connected: String(mcp.connected_count),
    connecting: String(mcp.connecting_count),
    tools: String(mcp.tool_count),
  });

  const acpSummary = m.console_dashboard_acp_summary({
    agents: String(acp.agent_count),
    connected: String(acp.connected_count),
    sessions: String(acp.session_count),
    tools: String(acp.tool_count),
  });

  const runRestart = async () => {
    setShowRestartConfirm(false);
    setRestarting(true);
    try {
      const res = await restartService();
      await showAlert({
        description: translateApiPayload(res as { code?: string; message?: string }),
      });
    } catch (err) {
      logCaughtError("dashboard/restartService", err);
      await showAlert({
        description: m.console_dashboard_restart_failed({
          detail: err instanceof Error ? err.message : String(err),
        }),
      });
      setRestarting(false);
    }
  };

  if (!svc) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-2">{m.console_dashboard_title()}</h2>
        <StatusAlert variant="error">{m.console_dashboard_load_failed()}</StatusAlert>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-2">{m.console_dashboard_title()}</h2>
      <div className="space-y-4">
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground mb-1.5">
            {m.console_dashboard_runtime()}
          </h3>
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
          {svc.tunnel ? <TunnelLinksCard tunnel={svc.tunnel} /> : null}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-muted-foreground mb-1.5">
            {m.console_dashboard_conversations_tools()}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-stretch">
            <ConversationStatCard
              total={svc.conversations?.total ?? 0}
              platformRows={conversationPlatformRows}
            />
            <CompactExtensionCard title="ACP" href="/acp" summary={acpSummary} />
            <StatCard title={m.console_common_tools()}>
              <p className="text-xl font-mono mt-1">{toolCount}</p>
              <p className="text-xs text-muted-foreground">
                {m.console_dashboard_tools_registered()}
              </p>
            </StatCard>
            <CompactExtensionCard title="MCP" href="/mcp" summary={mcpSummary} />
            <StatCard
              title={m.console_dashboard_cron()}
              action={
                <Link
                  to="/cron"
                  className="text-primary underline-offset-4 hover:underline text-xs"
                >
                  {m.console_dashboard_manage()}
                </Link>
              }
            >
              <p className="text-xl font-mono mt-1">{cronCount}</p>
              <p className="text-xs text-muted-foreground">
                {cronCount > 0
                  ? m.console_dashboard_cron_configured()
                  : m.console_dashboard_cron_none()}
              </p>
            </StatCard>
            <StatCard title={m.console_dashboard_slash_commands()}>
              <p className="text-xl font-mono mt-1">{commandCount ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{m.console_dashboard_all_platforms()}</p>
            </StatCard>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {m.console_dashboard_memory()}
            </h3>
            <Link to="/memory" className="text-primary underline-offset-4 hover:underline text-xs">
              {m.console_dashboard_memory_desk()}
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatCard title={m.console_dashboard_semantic_memory()}>
              <p className="text-xl font-mono mt-1">{semanticMemoryCount}</p>
            </StatCard>
            <StatCard title={m.console_dashboard_dialogue_messages()}>
              <p className="text-xl font-mono mt-1">{dialogueMessageCount}</p>
              <p className="text-xs text-muted-foreground">
                {m.console_dashboard_messages_count()}
              </p>
            </StatCard>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={showRestartConfirm}
        title={m.console_common_restart_service()}
        description={m.console_dashboard_restart_confirm()}
        confirmLabel={m.console_common_restart_service()}
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
            <h4 className="text-sm text-muted-foreground">
              {m.console_dashboard_service_status()}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={svc.status === "running" ? "success" : "destructive"}>
                {svc.status}
              </Badge>
              <span className="text-xs text-muted-foreground">v{svc.version || "?"}</span>
            </div>
          </div>
          <div>
            <h4 className="text-sm text-muted-foreground">{m.console_dashboard_uptime()}</h4>
            <p className="text-xl font-mono mt-1">{formatUptime(svc.uptime_seconds) || "—"}</p>
          </div>
          <div>
            <h4 className="text-sm text-muted-foreground">
              {m.console_dashboard_process_memory()}
            </h4>
            <p className="text-xl font-mono mt-1">{processMemoryLabel}</p>
            {heapMemoryHint ? (
              <p className="text-xs text-muted-foreground mt-0.5">{heapMemoryHint}</p>
            ) : null}
          </div>
          <div>
            <h4 className="text-sm text-muted-foreground">{m.console_dashboard_current_model()}</h4>
            <p className="text-base font-mono mt-1 truncate" title={svc.config?.model}>
              {svc.config?.model || "—"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground border-t border pt-2 mt-2">
          {svc.start_time_iso ? (
            <span>
              {m.console_dashboard_started_at({
                time: formatDisplayDateTime(svc.start_time_iso),
              })}
            </span>
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
              disabled={restarting}
              onClick={onRestart}
            >
              {restarting ? m.console_common_restarting() : m.console_common_restart_service()}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TunnelLinksCard({ tunnel }: { tunnel: NonNullable<ServiceSnapshot["tunnel"]> }) {
  return (
    <Card className="bg-muted py-0 lg:col-span-3">
      <CardContent className="py-3 px-4">
        <h3 className="text-sm text-muted-foreground">{m.console_dashboard_tunnel()}</h3>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">{m.console_dashboard_tunnel_public()}: </span>
            <a
              href={tunnel.public_url}
              className="text-primary underline-offset-4 hover:underline text-xs font-mono"
              target="_blank"
              rel="noreferrer"
            >
              {tunnel.public_url}
            </a>
          </div>
          <div>
            <span className="text-muted-foreground">{m.console_dashboard_tunnel()}: </span>
            <a
              href={tunnel.api_url}
              className="text-primary underline-offset-4 hover:underline text-xs font-mono"
              target="_blank"
              rel="noreferrer"
            >
              {tunnel.api_url}
            </a>
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
        <h3 className="text-sm text-muted-foreground">
          {m.console_dashboard_platform_connections()}
        </h3>
        {entries.length === 0 ? (
          <div className="text-xs text-muted-foreground mt-1">
            {m.console_dashboard_no_platforms()}
          </div>
        ) : (
          <div className="mt-1 space-y-1 max-h-24 overflow-y-auto">
            {entries.map(([name, ps]) => (
              <div key={name} className="flex items-center gap-2 text-sm">
                <Badge
                  variant={(ps as { status?: string }).status === "connected" ? "success" : "ghost"}
                  className="size-2 rounded-full p-0"
                />
                <span className="truncate">{name}</span>
                {(ps as { bot_name?: string }).bot_name ? (
                  <span className="text-xs text-muted-foreground truncate">
                    ({(ps as { bot_name?: string }).bot_name})
                  </span>
                ) : null}
              </div>
            ))}
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
      <StatCard title={m.console_dashboard_conversations()}>
        <p className="text-xl font-mono mt-1">{total}</p>
        <p className="text-xs text-muted-foreground">{m.console_dashboard_hover_platforms()}</p>
      </StatCard>
      <div
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden min-w-[10rem] rounded-lg bg-neutral px-3 py-2 text-xs text-neutral-content shadow-lg group-hover/session:block"
      >
        {platformRows.length === 0 ? (
          <p className="text-left">{m.console_dashboard_no_platform_data()}</p>
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
            {m.console_dashboard_manage()}
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
