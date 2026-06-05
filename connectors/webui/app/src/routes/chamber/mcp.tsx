import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "@/lib/trpc.ts";

export const Route = createFileRoute("/chamber/mcp")({
  loader: () => trpc.mcp.status.query().catch(() => null),
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

function statusLabel(s: string) {
  if (s === "connected") return "已连接";
  if (s === "connecting") return "连接中";
  if (s === "disabled") return "已禁用";
  if (s === "error") return "错误";
  return "未启动";
}

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
  const [error, setError] = useState(initial ? "" : "加载失败");

  const canStart = (srv: McpServer) =>
    srv.config.enabled !== false && srv.status !== "connected" && srv.status !== "connecting";

  const canStop = (srv: McpServer) => srv.status === "connected" || srv.status === "connecting";

  const controlServer = async (name: string, action: "start" | "stop") => {
    setError("");
    setActing((a) => ({ ...a, [name]: action }));
    try {
      const fn = action === "start" ? trpc.mcp.start : trpc.mcp.stop;
      setStatus((await fn.mutate({ name })) as McpStatus);
    } catch (e) {
      setError(
        `${name} ${action === "start" ? "启动" : "停止"}失败: ${e instanceof Error ? e.message : String(e)}`,
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
      const fn = action === "start-all" ? trpc.mcp.startAll : trpc.mcp.stopAll;
      setStatus((await fn.mutate()) as McpStatus);
    } catch (e) {
      setError(
        action === "start-all"
          ? `全部启动失败: ${e instanceof Error ? e.message : String(e)}`
          : `全部停止失败: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setBulkActing(false);
    }
  };

  if (!status) {
    return (
      <div>
        <h2 className="text-lg font-bold">🔌 MCP</h2>
        <div className="alert alert-error text-sm mt-4">{error || "加载失败"}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">🔌 MCP</h2>
          <p className="text-sm text-base-content/60 mt-1">
            MCP 服务器配置与运行时状态（工具、资源、Prompt）。
          </p>
        </div>
        {status.servers.length > 0 ? (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={bulkActing}
              onClick={() => void controlAll("start-all")}
            >
              启动全部
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              disabled={bulkActing}
              onClick={() => void controlAll("stop-all")}
            >
              停止全部
            </button>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            ["已配置", status.server_count],
            ["已连接", status.connected_count],
            ["连接中", status.connecting_count ?? 0],
            ["注册工具", status.tool_count],
          ].map(([label, value]) => (
            <div key={String(label)} className="card bg-base-200">
              <div className="card-body py-4">
                <h3 className="text-sm text-base-content/60">{label}</h3>
                <p className="text-2xl font-mono">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {status.servers.length === 0 ? (
          <div className="alert alert-info text-sm">
            未配置 MCP 服务器。在 <code className="text-xs">~/.anima/config.yaml</code> 的
            <code className="text-xs"> mcp_servers</code> 中添加。
          </div>
        ) : null}

        {status.servers.map((srv) => (
          <div key={srv.name} className="card bg-base-200">
            <div className="card-body">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-mono font-bold">{srv.name}</h3>
                  <span className={`badge badge-sm ${statusBadgeClass(srv.status)}`}>
                    {statusLabel(srv.status)}
                  </span>
                  <span className="badge badge-ghost badge-sm">{String(srv.config.transport)}</span>
                </div>
                <div className="flex gap-2">
                  {canStart(srv) ? (
                    <button
                      type="button"
                      className="btn btn-xs btn-primary"
                      disabled={!!acting[srv.name] || bulkActing}
                      onClick={() => void controlServer(srv.name, "start")}
                    >
                      启动
                    </button>
                  ) : null}
                  {canStop(srv) ? (
                    <button
                      type="button"
                      className="btn btn-xs btn-outline"
                      disabled={!!acting[srv.name] || bulkActing}
                      onClick={() => void controlServer(srv.name, "stop")}
                    >
                      停止
                    </button>
                  ) : null}
                </div>
              </div>
              {srv.error ? (
                <div className="alert alert-error text-xs py-2 mb-3">{srv.error}</div>
              ) : null}
              <details open className="mb-3">
                <summary className="text-sm font-medium cursor-pointer mb-2">配置</summary>
                <pre className="text-xs overflow-x-auto">{JSON.stringify(srv.config, null, 2)}</pre>
              </details>
              <details className="mb-2">
                <summary className="text-sm font-medium cursor-pointer">
                  工具 ({srv.tools.length})
                </summary>
                <pre className="text-xs mt-2 overflow-x-auto">
                  {JSON.stringify(srv.tools, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        ))}
      </div>

      {error ? <div className="alert alert-error text-sm mt-4">{error}</div> : null}
    </div>
  );
}
