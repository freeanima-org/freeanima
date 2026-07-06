import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Button, Card, CardContent } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { m } from "@console/lib/i18n.ts";
import { getMcpStatus, startAllMcp, startMcp, stopAllMcp, stopMcp } from "@console/lib/api.ts";
import { mcpStatusLabel } from "@console/lib/console-status.ts";
import { catchWithFallback, logCaughtError } from "@console/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/mcp")({
  loader: () => getMcpStatus().catch(catchWithFallback("mcp/getMcpStatus", null)),
  component: McpPage,
});

type McpServer = Record<string, unknown> & {
  name: string;
  status: string;
  config: Record<string, unknown>;
  tools: Record<string, unknown>[];
  resources: Record<string, unknown>[];
  prompts: Record<string, unknown>[];
  registered_tools: unknown[];
  error?: string;
};

type McpStatus = {
  server_count: number;
  connected_count: number;
  connecting_count: number;
  tool_count: number;
  servers: McpServer[];
};

type BadgeVariant = "success" | "warning" | "destructive" | "ghost";

function statusBadgeVariant(s: string): BadgeVariant {
  if (s === "connected") return "success";
  if (s === "connecting") return "warning";
  if (s === "error") return "destructive";
  return "ghost";
}

function canStartMcpServer(srv: McpServer): boolean {
  return srv.config.enabled !== false && srv.status !== "connected" && srv.status !== "connecting";
}

function canStopMcpServer(srv: McpServer): boolean {
  return srv.status === "connected" || srv.status === "connecting";
}

function McpPage() {
  const initial = Route.useLoaderData() as McpStatus | null;

  const [status, setStatus] = useState<McpStatus | null>(initial);
  const [bulkActing, setBulkActing] = useState(false);
  const [acting, setActing] = useState<Record<string, string>>({});
  const [error, setError] = useState(initial ? "" : m.console_common_load_failed_short());

  const controlServer = async (name: string, action: "start" | "stop") => {
    setError("");
    setActing((a) => ({ ...a, [name]: action }));
    try {
      const result = action === "start" ? await startMcp(name) : await stopMcp(name);
      setStatus(result as McpStatus);
    } catch (e) {
      logCaughtError("routes/_sidebar/mcp", e);
      setError(
        m.console_mcp_action_failed({
          name,
          action: action === "start" ? m.console_action_start() : m.console_action_stop(),
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setActing((a) => {
        const next = { ...a };
        delete next[name];
        return next;
      });
    }
  };

  const controlAll = async (action: "start-all" | "stop-all") => {
    setError("");
    setBulkActing(true);
    try {
      const result = action === "start-all" ? await startAllMcp() : await stopAllMcp();
      setStatus(result as McpStatus);
    } catch (e) {
      logCaughtError("routes/_sidebar/mcp", e);
      const detail = e instanceof Error ? e.message : String(e);
      setError(
        action === "start-all"
          ? m.console_mcp_start_all_failed({ detail })
          : m.console_mcp_stop_all_failed({ detail }),
      );
    } finally {
      setBulkActing(false);
    }
  };

  if (!status) {
    return (
      <div>
        <h2 className="text-lg font-bold">{m.console_nav_mcp()}</h2>
        <StatusAlert variant="error" className="mt-4">
          {error || m.console_common_load_failed_short()}
        </StatusAlert>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">{m.console_nav_mcp()}</h2>
          <p className="text-sm text-muted-foreground mt-1">{m.console_mcp_desc()}</p>
        </div>
        {status.servers.length > 0 ? (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={bulkActing}
              onClick={() => void controlAll("start-all")}
            >
              {m.console_common_start_all()}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={bulkActing}
              onClick={() => void controlAll("stop-all")}
            >
              {m.console_common_stop_all()}
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <StatusAlert variant="error" className="mb-4">
          {error}
        </StatusAlert>
      ) : null}

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            [m.console_mcp_configured(), status.server_count],
            [m.console_common_connected(), status.connected_count],
            [m.console_common_connecting(), status.connecting_count ?? 0],
            [m.console_mcp_registered_tools(), status.tool_count],
          ] as const
        ).map(([label, count]) => (
          <Badge key={label} variant="outline">
            {label} {count}
          </Badge>
        ))}
      </div>

      {status.servers.length === 0 ? (
        <StatusAlert variant="info">{m.console_mcp_empty_hint()}</StatusAlert>
      ) : (
        <div className="space-y-4">
          {status.servers.map((srv) => (
            <Card key={srv.name} className="bg-muted py-0">
              <CardContent className="gap-3 py-4 px-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{srv.name}</span>
                    <Badge variant={statusBadgeVariant(srv.status)} className="text-xs">
                      {mcpStatusLabel(srv.status)}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!canStartMcpServer(srv) || !!acting[srv.name]}
                      onClick={() => void controlServer(srv.name, "start")}
                    >
                      {m.console_common_start()}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!canStopMcpServer(srv) || !!acting[srv.name]}
                      onClick={() => void controlServer(srv.name, "stop")}
                    >
                      {m.console_common_stop()}
                    </Button>
                  </div>
                </div>
                {srv.error ? <p className="text-xs text-destructive">{srv.error}</p> : null}
                <details>
                  <summary className="text-sm font-medium cursor-pointer mb-2">
                    {m.console_common_config()}
                  </summary>
                  <pre className="text-xs overflow-x-auto bg-muted rounded p-2">
                    {JSON.stringify(srv.config, null, 2)}
                  </pre>
                </details>
                <p className="text-sm font-medium">
                  {m.console_mcp_tools_count({ count: String(srv.tools.length) })}
                </p>
                <ul className="text-xs font-mono space-y-1">
                  {srv.tools.map((t, i) => (
                    <li key={i}>{(t as { name?: string }).name ?? JSON.stringify(t)}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
