import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { PromptDebugResponse } from "@freeanima/connectors-webui/api";
import { useEffect, useMemo, useState } from "react";
import { getPromptDebug } from "@/lib/api.ts";
import { useChamberSessionsStore } from "@/stores/chamber-sessions.ts";

type TabId = "parts" | "full" | "tools";

const PART_LABELS = {
  self: "自我层",
  resident: "常驻记忆",
  agents: "AGENTS.md",
} as const;

const PART_BREAKDOWN_KEY = {
  self: "system_self",
  resident: "system_resident",
  agents: "system_agents",
} as const;

function formatTokenK(tokens: number): string {
  if (tokens <= 0) return "0";
  if (tokens < 1000) return `${tokens}`;
  const k = tokens / 1000;
  return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
}

function estimateChars(text: string): number {
  return text.length;
}

export const Route = createFileRoute("/chamber/system-prompt")({
  validateSearch: (search: Record<string, unknown>): { session?: string } => ({
    session: typeof search.session === "string" && search.session ? search.session : undefined,
  }),
  component: SystemPromptPage,
});

function ToolSchemaCard({ tool }: { tool: PromptDebugResponse["tools"]["items"][number] }) {
  return (
    <div className="card bg-base-200">
      <div className="card-body py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-mono text-sm font-bold break-all">{tool.name}</h3>
          {tool.toolset ? (
            <span className="badge badge-ghost badge-xs shrink-0">{tool.toolset}</span>
          ) : null}
        </div>
        {tool.description ? (
          <p className="text-xs text-base-content/60">{tool.description}</p>
        ) : null}
        <details className="mt-1">
          <summary className="text-xs cursor-pointer text-base-content/50">参数 schema</summary>
          <pre className="text-xs mt-1 bg-base-300 p-2 rounded overflow-x-auto">
            {JSON.stringify(tool.parameters, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}

function BreakdownBar({ data }: { data: PromptDebugResponse["system"]["breakdown"] }) {
  const systemTotal = data.system_self + data.system_agents + data.system_resident;
  return (
    <div className="card bg-base-200">
      <div className="card-body py-3 px-4 gap-2">
        <h3 className="text-sm font-semibold">Token 分项（粗估）</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div>
            <span className="text-base-content/50">系统提示词</span>
            <div className="font-mono">~{formatTokenK(systemTotal)}</div>
          </div>
          <div>
            <span className="text-base-content/50">会话消息</span>
            <div className="font-mono">~{formatTokenK(data.messages)}</div>
          </div>
          <div>
            <span className="text-base-content/50">工具 schema</span>
            <div className="font-mono">~{formatTokenK(data.tools)}</div>
          </div>
          <div>
            <span className="text-base-content/50">合计</span>
            <div className="font-mono font-semibold">~{formatTokenK(data.total)}</div>
          </div>
        </div>
        {(data.system_self > 0 || data.system_agents > 0 || data.system_resident > 0) && (
          <div className="flex flex-wrap gap-2 text-xs text-base-content/60">
            {data.system_self > 0 ? <span>自我层 ~{formatTokenK(data.system_self)}</span> : null}
            {data.system_resident > 0 ? (
              <span>常驻记忆 ~{formatTokenK(data.system_resident)}</span>
            ) : null}
            {data.system_agents > 0 ? (
              <span>AGENTS.md ~{formatTokenK(data.system_agents)}</span>
            ) : null}
            {data.summary > 0 ? <span>摘要 ~{formatTokenK(data.summary)}</span> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function SystemPromptPage() {
  const { session: sessionFromUrl } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const sessionsStore = useChamberSessionsStore();
  const [tab, setTab] = useState<TabId>("parts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<PromptDebugResponse | null>(null);
  const [toolQuery, setToolQuery] = useState("");
  const [copyHint, setCopyHint] = useState("");

  const selectedSession = sessionFromUrl ?? "";

  useEffect(() => {
    const state = useChamberSessionsStore.getState();
    if (!state.sessions.length && !state.loadingSessions) {
      void state.fetchSessions();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void getPromptDebug(selectedSession || undefined)
      .then((result) => {
        if (!cancelled) setData(result as PromptDebugResponse);
      })
      .catch((e) => {
        if (!cancelled) {
          setData(null);
          setError(String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSession]);

  const sortedSessions = sessionsStore.sortedSessions();

  const filteredTools = useMemo(() => {
    const items = data?.tools.items ?? [];
    const q = toolQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.toolset?.toLowerCase().includes(q) ?? false),
    );
  }, [data?.tools.items, toolQuery]);

  const handleSessionChange = (value: string) => {
    void navigate({
      search: value ? { session: value } : {},
    });
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint(`已复制${label}`);
      setTimeout(() => setCopyHint(""), 2000);
    } catch {
      setCopyHint("复制失败");
      setTimeout(() => setCopyHint(""), 2000);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">📋 系统提示词</h2>
      <p className="text-sm text-base-content/60 mb-4">
        查看系统提示词分解、完整文本与会话有效工具 schema。默认全局模板；可选 session 对比 PG
        持久化与实时重建结果。
      </p>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="form-control w-full max-w-xl">
          <span className="label-text text-xs mb-1">Session（可选）</span>
          <select
            className="select select-bordered select-sm w-full font-mono text-xs"
            value={selectedSession}
            onChange={(e) => handleSessionChange(e.target.value)}
          >
            <option value="">— 全局模板 —</option>
            {sortedSessions.map((s) => (
              <option key={s.id} value={s.id}>
                {(s.title || "（无标题）").slice(0, 24)} · {s.id.slice(0, 20)}…
              </option>
            ))}
          </select>
        </label>
        {selectedSession ? (
          <Link
            to="/chamber/sessions/$sessionId"
            params={{ sessionId: selectedSession }}
            className="btn btn-ghost btn-xs"
          >
            会话详情 →
          </Link>
        ) : null}
        <Link to="/chamber/self-layer" className="btn btn-ghost btn-xs">
          自我层 →
        </Link>
        <Link to="/chamber/tools" className="btn btn-ghost btn-xs">
          工具列表 →
        </Link>
      </div>

      {loading ? <div className="text-sm text-base-content/60">加载中…</div> : null}
      {error ? <div className="alert alert-error text-sm">{error}</div> : null}

      {data && !loading ? (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="badge badge-ghost badge-sm">
              {data.mode === "global" ? "全局模板" : "Session 对比"}
            </span>
            <span className="badge badge-ghost badge-sm">
              工具 {data.tools.count} 个（
              {data.tools.mode === "registry" ? "全量注册表" : "会话有效"}）
            </span>
            {data.mode === "session" && data.system.in_sync !== undefined ? (
              <span
                className={`badge badge-sm ${data.system.in_sync ? "badge-success" : "badge-warning"}`}
              >
                {data.system.in_sync ? "stored 与 live 一致" : "stored 与 live 不一致"}
              </span>
            ) : null}
            {copyHint ? <span className="text-xs text-success">{copyHint}</span> : null}
          </div>

          {data.meta ? (
            <div className="text-xs text-base-content/60 mb-4 space-y-1">
              {data.meta.cwd ? (
                <div>
                  cwd: <code className="text-xs">{data.meta.cwd}</code>
                </div>
              ) : null}
              {data.meta.capability_mask?.presets.length ? (
                <div>capability_mask: {data.meta.capability_mask.presets.join(", ")}</div>
              ) : null}
              {data.meta.tool_names?.length ? (
                <div>session_meta.tools: {data.meta.tool_names.length} 个名称</div>
              ) : null}
            </div>
          ) : null}

          <div className="mb-4">
            <BreakdownBar data={data.system.breakdown} />
          </div>

          <div role="tablist" className="tabs tabs-boxed tabs-sm mb-4 w-fit">
            {(
              [
                ["parts", "分项"],
                ["full", "完整文本"],
                ["tools", "工具 schema"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                className={`tab ${tab === id ? "tab-active" : ""}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "parts" ? (
            <div className="space-y-4">
              {(Object.keys(PART_LABELS) as Array<keyof typeof PART_LABELS>).map((key) => {
                const text = data.system.parts[key];
                return (
                  <details key={key} className="group card bg-base-200" open>
                    <summary className="cursor-pointer list-none card-body py-3 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-sm">{PART_LABELS[key]}</h3>
                        <span className="text-xs text-base-content/50">
                          {estimateChars(text)} 字符 · ~
                          {formatTokenK(data.system.breakdown[PART_BREAKDOWN_KEY[key]])}
                        </span>
                      </div>
                    </summary>
                    <div className="px-4 pb-4">
                      <pre className="text-xs whitespace-pre-wrap bg-base-300 p-3 rounded max-h-96 overflow-auto">
                        {text.trim() || "（空）"}
                      </pre>
                    </div>
                  </details>
                );
              })}
            </div>
          ) : null}

          {tab === "full" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={() => void copyText(data.system.composed, " live prompt")}
                >
                  复制 live 全文
                </button>
                {data.system.stored != null ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    onClick={() => void copyText(data.system.stored ?? "", " stored prompt")}
                  >
                    复制 stored 全文
                  </button>
                ) : null}
              </div>
              {data.mode === "session" && data.system.stored != null ? (
                <div className="grid lg:grid-cols-2 gap-4">
                  <section>
                    <h3 className="text-sm font-semibold mb-2">Live（实时重建）</h3>
                    <pre className="text-xs whitespace-pre-wrap bg-base-300 p-3 rounded max-h-[32rem] overflow-auto">
                      {data.system.composed || "（空）"}
                    </pre>
                  </section>
                  <section>
                    <h3 className="text-sm font-semibold mb-2">Stored（PG 持久化）</h3>
                    <pre className="text-xs whitespace-pre-wrap bg-base-300 p-3 rounded max-h-[32rem] overflow-auto">
                      {data.system.stored || "（空）"}
                    </pre>
                  </section>
                </div>
              ) : (
                <pre className="text-xs whitespace-pre-wrap bg-base-300 p-3 rounded max-h-[32rem] overflow-auto">
                  {data.system.composed || "（空）"}
                </pre>
              )}
            </div>
          ) : null}

          {tab === "tools" ? (
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <input
                  type="search"
                  className="input input-bordered input-sm w-full max-w-sm"
                  placeholder="搜索工具名 / 描述 / toolset"
                  value={toolQuery}
                  onChange={(e) => setToolQuery(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={() =>
                    void copyText(JSON.stringify(data.tools.items, null, 2), "工具 schema JSON")
                  }
                >
                  复制 JSON
                </button>
                <span className="text-xs text-base-content/50">
                  显示 {filteredTools.length} / {data.tools.count} · ~
                  {formatTokenK(data.tools.tokens_est)} tokens
                </span>
              </div>
              <div className="space-y-2">
                {filteredTools.map((tool) => (
                  <ToolSchemaCard key={tool.name} tool={tool} />
                ))}
                {!filteredTools.length ? (
                  <div className="text-sm text-base-content/50">无匹配工具</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
