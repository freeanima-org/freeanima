import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { m } from "@/lib/i18n.ts";
import { getMcpStatus, startAllMcp, startMcp, stopAllMcp, stopMcp } from "@/lib/api.ts";
import { mcpStatusLabel } from "@/lib/webui-status.ts";

export const Route = createFileRoute("/chamber/mcp")({
  loader: () => getMcpStatus().catch(() => null),
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

function statusBadgeClass(s: string) {
  if (s === "connected") return "badge-success";
  if (s === "connecting") return "badge-warning";
  if (s === "disabled") return "badge-ghost";
  if (s === "error") return "badge-error";
  return "badge-ghost";
}

function McpPage() {
  const initial = Route.useLoaderData() as McpStatus | null;

  const [status, setStatus] = useState<McpStatus | null>(initial);
  const [bulkActing, setBulkActing] = useState(false);
  const [acting, setActing] = useState<Record<string, string>>({});
  const [error, setError] = useState(initial ? "" : m.webui_common_load_failed_short());

  const canStart = (srv: McpServer) =>
    srv.config.enabled !== false && srv.status !== "connected" && srv.status !== "connecting";

  const canStop = (srv: McpServer) => srv.status === "connected" || srv.status === "connecting";

  const controlServer = async (name: string, action: "start" | "stop") => {
    setError("");
    setActing((a) => ({ ...a, [name]: action }));
    try {
      const result = action === "start" ? await startMcp(name) : await stopMcp(name);
      setStatus(result as McpStatus);
    } catch (e) {
      setError(
        m.webui_chamber_mcp_action_failed({
          name,
          action: action === "start" ? m.webui_action_start() : m.webui_action_stop(),
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
      const detail = e instanceof Error ? e.message : String(e);
      setError(
        action === "start-all"
          ? m.webui_chamber_mcp_start_all_failed({ detail })
          : m.webui_chamber_mcp_stop_all_failed({ detail }),
      );
    } finally {
      setBulkActing(false);
    }
  };

  if (!status) {
    return (
      <div>
        <h2 className="text-lg font-bold">{m.webui_chamber_nav_mcp()}</h2>
        <div className="alert alert-error text-sm mt-4">
          {error || m.webui_common_load_failed_short()}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">{m.webui_chamber_nav_mcp()}</h2>
          <p className="text-sm text-base-content/60 mt-1">{m.webui_chamber_mcp_desc()}</p>
        </div>
        {status.servers.length > 0 ? (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={bulkActing}
              onClick={() => void controlAll("start-all")}
            >
              {m.webui_common_start_all()}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={bulkActing}
              onClick={() => void controlAll("stop-all")}
            >
              {m.webui_common_stop_all()}
            </button>
          </div>
        ) : null}
      </div>

      {error ? <div className="alert alert-error text-sm mb-4">{error}</div> : null}

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            [m.webui_chamber_mcp_configured(), status.server_count],
            [m.webui_common_connected(), status.connected_count],
            [m.webui_common_connecting(), status.connecting_count ?? 0],
            [m.webui_chamber_mcp_registered_tools(), status.tool_count],
          ] as const
        ).map(([label, count]) => (
          <span key={label} className="badge badge-outline">
            {label} {count}
          </span>
        ))}
      </div>

      {status.servers.length === 0 ? (
        <div className="alert alert-info text-sm">{m.webui_chamber_mcp_empty_hint()}</div>
      ) : (
        <div className="space-y-4">
          {status.servers.map((srv) => (
            <div key={srv.name} className="card bg-base-200">
              <div className="card-body gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{srv.name}</span>
                    <span className={`badge badge-sm ${statusBadgeClass(srv.status)}`}>
                      {mcpStatusLabel(srv.status)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-xs btn-primary"
                      disabled={!canStart(srv) || !!acting[srv.name]}
                      onClick={() => void controlServer(srv.name, "start")}
                    >
                      {m.webui_common_start()}
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      disabled={!canStop(srv) || !!acting[srv.name]}
                      onClick={() => void controlServer(srv.name, "stop")}
                    >
                      {m.webui_common_stop()}
                    </button>
                  </div>
                </div>
                {srv.error ? <p className="text-xs text-error">{srv.error}</p> : null}
                <details>
                  <summary className="text-sm font-medium cursor-pointer mb-2">
                    {m.webui_common_config()}
                  </summary>
                  <pre className="text-xs overflow-x-auto bg-base-300 rounded p-2">
                    {JSON.stringify(srv.config, null, 2)}
                  </pre>
                </details>
                <p className="text-sm font-medium">
                  {m.webui_chamber_mcp_tools_count({ count: String(srv.tools.length) })}
                </p>
                <ul className="text-xs font-mono space-y-1">
                  {srv.tools.map((t, i) => (
                    <li key={i}>{(t as { name?: string }).name ?? JSON.stringify(t)}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
