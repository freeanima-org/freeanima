import { useCallback, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Badge, Button, Card, CardContent } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";
import {
  getMcpStatus,
  startAllMcp,
  startMcp,
  stopAllMcp,
  stopMcp,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { mcpStatusLabel } from "@freeanima/features/habitat/ui/habitat/lib/habitat-status.ts";
import {
  catchWithFallback,
  logCaughtError,
} from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";
import { McpServersConfigEditor } from "@freeanima/features/habitat/ui/habitat/components/McpServersConfigEditor.tsx";
import {
  McpServerToolsList,
  type McpToolListItem,
} from "@freeanima/features/habitat/ui/habitat/components/McpServerToolsList.tsx";

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
  const [error, setError] = useState(initial ? "" : m.habitat_common_load_failed_short());

  const refreshStatus = useCallback(async () => {
    try {
      const next = await getMcpStatus();
      setStatus(next as McpStatus);
      setError("");
    } catch (e) {
      logCaughtError("routes/_sidebar/mcp/refresh", e);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const controlServer = async (name: string, action: "start" | "stop") => {
    setError("");
    setActing((a) => ({ ...a, [name]: action }));
    try {
      const result = action === "start" ? await startMcp(name) : await stopMcp(name);
      setStatus(result as McpStatus);
    } catch (e) {
      logCaughtError("routes/_sidebar/mcp", e);
      setError(
        m.habitat_mcp_action_failed({
          name,
          action: action === "start" ? m.habitat_action_start() : m.habitat_action_stop(),
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
          ? m.habitat_mcp_start_all_failed({ detail })
          : m.habitat_mcp_stop_all_failed({ detail }),
      );
    } finally {
      setBulkActing(false);
    }
  };

  if (!status) {
    return (
      <div>
        <h2 className="text-lg font-bold">{m.habitat_nav_mcp()}</h2>
        <StatusAlert variant="error" className="mt-4">
          {error || m.habitat_common_load_failed_short()}
        </StatusAlert>
        <div className="mt-4">
          <McpServersConfigEditor onSaved={refreshStatus} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">{m.habitat_nav_mcp()}</h2>
          <p className="text-sm text-muted-foreground mt-1">{m.habitat_mcp_desc()}</p>
        </div>
        {status.servers.length > 0 ? (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={bulkActing}
              onClick={() => void controlAll("start-all")}
            >
              {m.habitat_common_start_all()}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={bulkActing}
              onClick={() => void controlAll("stop-all")}
            >
              {m.habitat_common_stop_all()}
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
            [m.habitat_mcp_configured(), status.server_count],
            [m.habitat_common_connected(), status.connected_count],
            [m.habitat_common_connecting(), status.connecting_count ?? 0],
            [m.habitat_mcp_registered_tools(), status.tool_count],
          ] as const
        ).map(([label, count]) => (
          <Badge key={label} variant="outline">
            {label} {count}
          </Badge>
        ))}
      </div>

      <McpServersConfigEditor onSaved={refreshStatus} />

      <h3 className="text-sm font-semibold mb-3">{m.habitat_mcp_runtime_heading()}</h3>

      {status.servers.length === 0 ? (
        <StatusAlert variant="info">{m.habitat_mcp_empty_hint()}</StatusAlert>
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
                      {m.habitat_common_start()}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!canStopMcpServer(srv) || !!acting[srv.name]}
                      onClick={() => void controlServer(srv.name, "stop")}
                    >
                      {m.habitat_common_stop()}
                    </Button>
                  </div>
                </div>
                {srv.error ? <p className="text-xs text-destructive">{srv.error}</p> : null}
                <details>
                  <summary className="text-sm font-medium cursor-pointer mb-2">
                    {m.habitat_common_config()}
                  </summary>
                  <pre className="text-xs overflow-x-auto bg-muted rounded p-2">
                    {JSON.stringify(srv.config, null, 2)}
                  </pre>
                </details>
                <McpServerToolsList tools={srv.tools as McpToolListItem[]} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
