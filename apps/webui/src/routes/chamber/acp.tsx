import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "@/lib/trpc.ts";

const ACP_START_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

export const Route = createFileRoute("/chamber/acp")({
  loader: () => trpc.acp.status.query().catch(() => null),
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

function statusLabel(s: string) {
  if (s === "connected") return "已连接";
  if (s === "starting") return "连接中";
  if (s === "error") return "错误";
  if (s === "disabled") return "已禁用";
  return "未连接";
}

function statusBadgeClass(s: string) {
  if (s === "connected") return "badge-success";
  if (s === "starting") return "badge-warning";
  if (s === "error") return "badge-error";
  if (s === "disabled") return "badge-ghost opacity-60";
  return "badge-ghost";
}

function AcpPage() {
  const initial = Route.useLoaderData() as AcpStatus | null;

  const [status, setStatus] = useState<AcpStatus | null>(initial);
  const [bulkActing, setBulkActing] = useState(false);
  const [acting, setActing] = useState<Record<string, string>>({});
  const [error, setError] = useState(initial ? "" : "加载失败");

  const canStart = (agent: AcpAgent) =>
    agent.status !== "connected" && agent.status !== "starting" && agent.status !== "disabled";

  const canStop = (agent: AcpAgent) => agent.status === "connected" || agent.status === "starting";

  const controlAgent = async (name: string, action: "start" | "stop") => {
    setError("");
    setActing((a) => ({ ...a, [name]: action }));
    try {
      const req =
        action === "start" ? trpc.acp.start.mutate({ name }) : trpc.acp.stop.mutate({ name });
      const result =
        action === "start"
          ? await withTimeout(
              req,
              ACP_START_TIMEOUT_MS,
              "连接超时（30s），请检查 agent 是否已 login、command 路径是否正确",
            )
          : await req;
      setStatus(result as AcpStatus);
    } catch (e) {
      setError(
        `${name} ${action === "start" ? "连接" : "断开"}失败: ${e instanceof Error ? e.message : String(e)}`,
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
      const req = action === "start-all" ? trpc.acp.startAll.mutate() : trpc.acp.stopAll.mutate();
      const result =
        action === "start-all"
          ? await withTimeout(
              req,
              ACP_START_TIMEOUT_MS,
              "全部连接超时（30s），请检查各 agent 配置与 login 状态",
            )
          : await req;
      setStatus(result as AcpStatus);
    } catch (e) {
      setError(
        action === "start-all"
          ? `全部连接失败: ${e instanceof Error ? e.message : String(e)}`
          : `全部断开失败: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setBulkActing(false);
    }
  };

  if (!status) {
    return (
      <div>
        <h2 className="text-lg font-bold">🤝 ACP</h2>
        <div className="alert alert-error text-sm mt-4">{error || "加载失败"}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">🤝 ACP</h2>
          <p className="text-sm text-base-content/60 mt-1">
            Agent Client Protocol 代理：配置、连接状态与逸灵风侧活跃 session。
          </p>
        </div>
        {status.agents.length > 0 ? (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={bulkActing}
              onClick={() => void controlAll("start-all")}
            >
              连接全部
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              disabled={bulkActing}
              onClick={() => void controlAll("stop-all")}
            >
              断开全部
            </button>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            ["已配置", status.agent_count],
            ["已连接", status.connected_count],
            ["活跃 Session", status.session_count],
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

        {status.agents.map((agent) => (
          <div key={agent.name} className="card bg-base-200">
            <div className="card-body">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-mono font-bold">{agent.name}</h3>
                  <span className={`badge badge-sm ${statusBadgeClass(agent.status)}`}>
                    {statusLabel(agent.status)}
                  </span>
                </div>
                <div className="flex gap-2">
                  {canStart(agent) ? (
                    <button
                      type="button"
                      className="btn btn-xs btn-primary"
                      disabled={!!acting[agent.name] || bulkActing}
                      onClick={() => void controlAgent(agent.name, "start")}
                    >
                      连接
                    </button>
                  ) : null}
                  {canStop(agent) ? (
                    <button
                      type="button"
                      className="btn btn-xs btn-outline"
                      disabled={!!acting[agent.name] || bulkActing}
                      onClick={() => void controlAgent(agent.name, "stop")}
                    >
                      断开
                    </button>
                  ) : null}
                </div>
              </div>
              {agent.error ? (
                <div className="alert alert-error text-xs py-2 mb-3">{agent.error}</div>
              ) : null}
              <details open>
                <summary className="text-sm font-medium cursor-pointer mb-2">配置</summary>
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(agent.config, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        ))}
      </div>

      <div className="alert alert-warning text-xs mt-6">
        <p className="font-medium">说明</p>
        <ul className="list-disc list-inside mt-1 space-y-0.5 text-base-content/70">
          <li>逸灵风启动时会自动连接 enabled !== false 的 agent（与 MCP 一致）。</li>
          <li>「连接」仅完成 ACP initialize 握手，不创建 session。</li>
        </ul>
      </div>

      {error ? <div className="alert alert-error text-sm mt-4">{error}</div> : null}
    </div>
  );
}
