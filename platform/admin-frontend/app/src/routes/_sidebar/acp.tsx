import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Button, Card, CardContent } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { getAcpStatus, startAllAcp, startAcp, stopAllAcp, stopAcp } from "@admin/lib/api.ts";
import { m } from "@admin/lib/i18n.ts";
import { acpStatusLabel } from "@admin/lib/admin-status.ts";
import { catchWithFallback, logCaughtError } from "@admin/lib/log-caught-error.ts";

const ACP_START_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

export const Route = createFileRoute("/_sidebar/acp")({
  loader: () => getAcpStatus().catch(catchWithFallback("acp/getAcpStatus", null)),
  component: AcpPage,
});

type AcpAgent = Record<string, unknown> & {
  name: string;
  status: string;
  config: Record<string, unknown>;
  tool?: { name: string; description?: string };
  sessions: Record<string, unknown>[];
  error?: string;
};

type AcpStatus = {
  agent_count: number;
  connected_count: number;
  session_count: number;
  tool_count: number;
  agents: AcpAgent[];
};

type BadgeVariant = "success" | "warning" | "destructive" | "ghost";

function statusBadgeVariant(s: string): BadgeVariant {
  if (s === "connected") return "success";
  if (s === "starting") return "warning";
  if (s === "error") return "destructive";
  return "ghost";
}

function canStartAcpAgent(agent: AcpAgent): boolean {
  return agent.status !== "connected" && agent.status !== "starting" && agent.status !== "disabled";
}

function canStopAcpAgent(agent: AcpAgent): boolean {
  return agent.status === "connected" || agent.status === "starting";
}

function AcpPage() {
  const initial = Route.useLoaderData() as AcpStatus | null;

  const [status, setStatus] = useState<AcpStatus | null>(initial);
  const [bulkActing, setBulkActing] = useState(false);
  const [acting, setActing] = useState<Record<string, string>>({});
  const [error, setError] = useState(initial ? "" : m.admin_common_load_failed_short());

  const controlAgent = async (name: string, action: "start" | "stop") => {
    setError("");
    setActing((a) => ({ ...a, [name]: action }));
    try {
      const req = action === "start" ? startAcp(name) : stopAcp(name);
      const result =
        action === "start"
          ? await withTimeout(req, ACP_START_TIMEOUT_MS, m.admin_acp_start_timeout())
          : await req;
      setStatus(result as AcpStatus);
    } catch (e) {
      logCaughtError("routes/_sidebar/acp", e);
      setError(
        m.admin_acp_action_failed({
          name,
          action: action === "start" ? m.admin_acp_connect() : m.admin_acp_disconnect(),
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
      const req = action === "start-all" ? startAllAcp() : stopAllAcp();
      const result =
        action === "start-all"
          ? await withTimeout(req, ACP_START_TIMEOUT_MS, m.admin_acp_start_all_timeout())
          : await req;
      setStatus(result as AcpStatus);
    } catch (e) {
      logCaughtError("routes/_sidebar/acp", e);
      setError(
        action === "start-all"
          ? m.admin_acp_start_all_failed({
              detail: e instanceof Error ? e.message : String(e),
            })
          : m.admin_acp_stop_all_failed({
              detail: e instanceof Error ? e.message : String(e),
            }),
      );
    } finally {
      setBulkActing(false);
    }
  };

  if (!status) {
    return (
      <div>
        <h2 className="text-lg font-bold">{m.admin_nav_acp()}</h2>
        <StatusAlert variant="error" className="mt-4">
          {error || m.admin_common_load_failed_short()}
        </StatusAlert>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">{m.admin_nav_acp()}</h2>
          <p className="text-sm text-muted-foreground mt-1">{m.admin_acp_desc()}</p>
        </div>
        {status.agents.length > 0 ? (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={bulkActing}
              onClick={() => void controlAll("start-all")}
            >
              {m.admin_acp_connect_all()}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={bulkActing}
              onClick={() => void controlAll("stop-all")}
            >
              {m.admin_acp_disconnect_all()}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            [m.admin_acp_configured(), status.agent_count],
            [m.admin_common_connected(), status.connected_count],
            [m.admin_acp_active_sessions(), status.session_count],
            [m.admin_acp_registered_tools(), status.tool_count],
          ].map(([label, value]) => (
            <Card key={String(label)} className="bg-muted py-0">
              <CardContent className="py-4 px-4">
                <h3 className="text-sm text-muted-foreground">{label}</h3>
                <p className="text-2xl font-mono">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {status.agents.map((agent) => (
          <Card key={agent.name} className="bg-muted py-0">
            <CardContent className="py-4 px-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-mono font-bold">{agent.name}</h3>
                  <Badge
                    variant={statusBadgeVariant(agent.status)}
                    className={`text-xs ${agent.status === "disabled" ? "opacity-60" : ""}`}
                  >
                    {acpStatusLabel(agent.status)}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {canStartAcpAgent(agent) ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!!acting[agent.name] || bulkActing}
                      onClick={() => void controlAgent(agent.name, "start")}
                    >
                      {m.admin_acp_connect()}
                    </Button>
                  ) : null}
                  {canStopAcpAgent(agent) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!!acting[agent.name] || bulkActing}
                      onClick={() => void controlAgent(agent.name, "stop")}
                    >
                      {m.admin_acp_disconnect()}
                    </Button>
                  ) : null}
                </div>
              </div>
              {agent.error ? (
                <StatusAlert variant="error" className="text-xs py-2 mb-3">
                  {agent.error}
                </StatusAlert>
              ) : null}
              <details open>
                <summary className="text-sm font-medium cursor-pointer mb-2">
                  {m.admin_common_config()}
                </summary>
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(agent.config, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>

      <StatusAlert variant="warning" className="text-xs mt-6">
        <p className="font-medium">{m.admin_acp_notes_title()}</p>
        <ul className="list-disc list-inside mt-1 space-y-0.5 text-muted-foreground">
          <li>{m.admin_acp_note_auto_connect()}</li>
          <li>{m.admin_acp_note_handshake()}</li>
        </ul>
      </StatusAlert>

      {error ? (
        <StatusAlert variant="error" className="mt-4">
          {error}
        </StatusAlert>
      ) : null}
    </div>
  );
}
