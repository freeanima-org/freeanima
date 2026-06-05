import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc.ts";

export const Route = createFileRoute("/chamber/memory")({
  component: MemoryPage,
});

type MemoryResult = { query: string; l3: Record<string, unknown>[]; l2: Record<string, unknown>[] };

function pct(n: unknown) {
  return `${Math.round(Number(n ?? 0) * 100)}%`;
}

function formatToolOutput(data: MemoryResult) {
  const sections: string[] = [];
  if (data.l3?.length) {
    const lines = [`找到 ${data.l3.length} 条匹配事实：`];
    for (const r of data.l3) {
      lines.push(
        `  [${r.fact_id}] (${pct(r.confidence)}/ ${pct(r.importance)}/ ${pct(r.recall)}) ${r.content}`,
      );
      if (Array.isArray(r.domains) && r.domains.length) {
        lines.push(`       领域: ${(r.domains as string[]).join(", ")}`);
      }
    }
    sections.push(`## L3 事实\n${lines.join("\n")}`);
  }
  if (data.l2?.length) {
    const lines = [`找到 ${data.l2.length} 条匹配对话：`];
    data.l2.forEach((r, idx) => {
      const sid = String(r.session_id).slice(0, 16);
      const ts = String(r.timestamp).slice(0, 19) || "?";
      const content = String(r.content).slice(0, 400);
      lines.push(`\n--- ${idx + 1}. [${sid}] ${r.role} (${ts}) ---`);
      lines.push(`  → ${content.slice(0, 200)}${content.length > 200 ? "…" : ""}`);
    });
    sections.push(`## 历史对话\n${lines.join("\n")}`);
  }
  if (!sections.length) {
    return `未找到与「${data.query}」匹配的事实或历史对话（L2 仅含已蒸馏并索引的 session）。`;
  }
  return sections.join("\n\n");
}

function MemoryPage() {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(5);
  const [sessionLimit, setSessionLimit] = useState(10);
  const [sessionFilter, setSessionFilter] = useState("");
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [result, setResult] = useState<MemoryResult>({ query: "", l3: [], l2: [] });

  const isEmpty = !result.l3.length && !result.l2.length;
  const toolPreview = useMemo(() => formatToolOutput(result), [result]);

  const postMemoryAction = async (
    fn: () => Promise<unknown>,
    action: string,
    confirmText: string,
  ) => {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setBusyAction(action);
    setStatusMessage("");
    setError("");
    try {
      const d = (await fn()) as { message?: string };
      setStatusMessage(d.message || "完成");
    } catch (e) {
      setError(`操作失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      setBusyAction("");
    }
  };

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError("");
    try {
      const d = (await trpc.memory.search.mutate({
        query: q,
        limit,
        session_limit: sessionLimit,
        session: sessionFilter.trim() || undefined,
      })) as MemoryResult;
      setResult(d);
      setLastQuery(q);
      setSearched(true);
    } catch (e) {
      setError(`检索失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">🧠 记忆台</h2>
          <p className="text-sm text-base-content/60 mt-1">
            调试 <code className="text-xs">recall</code> 召回效果：L3 事实 FTS + L2 历史对话 FTS。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline btn-warning"
            disabled={busy}
            onClick={() =>
              void postMemoryAction(
                () => trpc.memory.l2Distill.mutate(),
                "l2-distill",
                "从全部 L1 session 重新生成 processed/（L2），不更新 FTS 索引。数据量大时可能耗时较久，确定继续？",
              )
            }
          >
            {busyAction === "l2-distill" ? (
              <span className="loading loading-spinner loading-xs" />
            ) : null}
            L2 蒸馏
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            disabled={busy}
            onClick={() =>
              void postMemoryAction(
                () => trpc.memory.l2Reindex.mutate(),
                "l2-reindex",
                "清空并重建 L2 FTS 索引（index/l2.db），不重新蒸馏。确定继续？",
              )
            }
          >
            {busyAction === "l2-reindex" ? (
              <span className="loading loading-spinner loading-xs" />
            ) : null}
            重建 L2 索引
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            disabled={busy}
            onClick={() =>
              void postMemoryAction(
                () => trpc.memory.l3Reindex.mutate(),
                "l3-reindex",
                "清空并重建 L3 FTS 索引（index/l3.db），不修改 memory/*.md 事实文件。确定继续？",
              )
            }
          >
            {busyAction === "l3-reindex" ? (
              <span className="loading loading-spinner loading-xs" />
            ) : null}
            重建 L3 索引
          </button>
        </div>
      </div>

      {statusMessage ? (
        <div className="alert alert-success text-sm mb-4">{statusMessage}</div>
      ) : null}

      <form
        className="card bg-base-200 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
      >
        <div className="card-body gap-4">
          <div className="form-control">
            <label className="label py-0">
              <span className="label-text text-xs">搜索词</span>
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              className="input input-bordered input-sm font-mono"
              placeholder="输入关键词…"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="form-control">
              <label className="label py-0">
                <span className="label-text text-xs">L3 条数</span>
              </label>
              <input
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                type="number"
                min={1}
                max={50}
                className="input input-bordered input-sm"
              />
            </div>
            <div className="form-control">
              <label className="label py-0">
                <span className="label-text text-xs">L2 条数</span>
              </label>
              <input
                value={sessionLimit}
                onChange={(e) => setSessionLimit(Number(e.target.value))}
                type="number"
                min={1}
                max={50}
                className="input input-bordered input-sm"
              />
            </div>
            <div className="form-control">
              <label className="label py-0">
                <span className="label-text text-xs">L2 session 过滤（可选）</span>
              </label>
              <input
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                type="text"
                className="input input-bordered input-sm font-mono"
                placeholder="session id"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={searching || !query.trim()}
            >
              {searching ? <span className="loading loading-spinner loading-xs" /> : null}
              检索
            </button>
            {searched && !searching ? (
              <span className="text-xs text-base-content/50">
                「{lastQuery}」— L3 {result.l3.length} 条，L2 {result.l2.length} 条
              </span>
            ) : null}
          </div>
        </div>
      </form>

      {error ? <div className="alert alert-error text-sm mb-4">{error}</div> : null}

      {searched && !searching && isEmpty ? (
        <div className="alert alert-info text-sm">
          未找到与「{lastQuery}」匹配的事实或历史对话（L2 仅含已蒸馏并索引的 session）。
        </div>
      ) : null}

      {searched && !isEmpty ? (
        <div className="space-y-4">
          {result.l3.length > 0 ? (
            <section>
              <h3 className="text-sm font-bold mb-2">
                L3 事实
                <span className="badge badge-ghost badge-sm ml-1">{result.l3.length}</span>
              </h3>
              <div className="space-y-2">
                {result.l3.map((hit, idx) => (
                  <div key={String(hit.fact_id)} className="card bg-base-200">
                    <div className="card-body py-3 px-4 gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-bold">
                          {idx + 1}. {String(hit.fact_id)}
                        </span>
                        <span className="badge badge-ghost badge-xs">
                          rank {Number(hit.rank).toFixed(4)}
                        </span>
                        <span className="badge badge-primary badge-xs">
                          score {Number(hit.score).toFixed(3)}
                        </span>
                        <span className="badge badge-outline badge-xs">{String(hit.type)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{String(hit.content)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.l2.length > 0 ? (
            <section>
              <h3 className="text-sm font-bold mb-2">
                L2 历史对话
                <span className="badge badge-ghost badge-sm ml-1">{result.l2.length}</span>
              </h3>
              <div className="space-y-2">
                {result.l2.map((hit, idx) => (
                  <div
                    key={`${hit.session_id}-${hit.timestamp}-${idx}`}
                    className="card bg-base-200"
                  >
                    <div className="card-body py-3 px-4 gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-bold">{idx + 1}.</span>
                        <span className="badge badge-secondary badge-xs">{String(hit.role)}</span>
                        <span className="badge badge-ghost badge-xs">
                          {String(hit.timestamp).slice(0, 19) || "?"}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{String(hit.content)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <details className="collapse collapse-arrow bg-base-200">
            <summary className="collapse-title text-xs font-mono text-base-content/60 min-h-0 py-3">
              recall 原始输出预览
            </summary>
            <div className="collapse-content">
              <pre className="text-xs bg-base-300 p-3 rounded-lg whitespace-pre-wrap overflow-x-auto">
                {toolPreview}
              </pre>
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}
