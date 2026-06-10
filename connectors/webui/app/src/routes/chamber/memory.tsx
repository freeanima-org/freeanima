import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { countSemanticMemory, searchMemory } from "@/lib/api.ts";

export const Route = createFileRoute("/chamber/memory")({
  component: MemoryPage,
});

type MemoryRecallHit = {
  memory_type: string;
  score: number;
  semantic_memory_id?: string;
  type?: string;
  pinned?: boolean;
  content?: string;
  source_sessions?: string[];
  observed_at?: string | null;
  occurred_at?: string | null;
  status?: string;
  session_id?: string;
  message_id?: string;
  role?: string;
  timestamp?: string;
  snippet?: string;
  limbic_memory_id?: string;
  kind?: string;
  intensity?: number;
  valence?: number | null;
  arousal?: number | null;
  autobiographical_memory_id?: string;
  title?: string;
  significance?: string;
};

type MemoryResult = {
  query: string;
  limit: number;
  results: MemoryRecallHit[];
  summary: string;
};

const MEMORY_TYPE_LABEL: Record<string, string> = {
  semantic: "语义记忆",
  session: "会话消息",
  limbic: "感性记忆",
  autobiographical: "自传体",
};

function formatToolOutput(data: MemoryResult) {
  if (!data.results?.length) {
    return `未找到与「${data.query}」匹配的记忆。`;
  }
  const lines = [data.summary, ""];
  for (const [idx, hit] of data.results.entries()) {
    const label = MEMORY_TYPE_LABEL[hit.memory_type] ?? hit.memory_type;
    lines.push(`${idx + 1}. [${label}] score ${hit.score.toFixed(4)}`);
    if (hit.memory_type === "semantic") {
      lines.push(`  ${hit.semantic_memory_id} (${hit.type}) ${hit.content}`);
      if (hit.observed_at || hit.occurred_at) {
        const parts: string[] = [];
        if (hit.observed_at) parts.push(`observed=${hit.observed_at.slice(0, 19)}`);
        if (hit.occurred_at) parts.push(`occurred=${hit.occurred_at}`);
        lines.push(`  ${parts.join(" ")}`);
      }
    } else if (hit.memory_type === "session") {
      lines.push(`  ${hit.session_id} / ${hit.message_id} ${hit.role}: ${hit.snippet}`);
    } else if (hit.memory_type === "limbic") {
      lines.push(`  ${hit.limbic_memory_id} (${hit.kind}) ${hit.content}`);
    } else if (hit.memory_type === "autobiographical") {
      lines.push(`  ${hit.autobiographical_memory_id} ${hit.title}: ${hit.snippet}`);
    }
  }
  return lines.join("\n");
}

function RecallHitCard({ hit, index }: { hit: MemoryRecallHit; index: number }) {
  const label = MEMORY_TYPE_LABEL[hit.memory_type] ?? hit.memory_type;
  return (
    <div className="card bg-base-200">
      <div className="card-body py-3 px-4 gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono font-bold">{index + 1}.</span>
          <span className="badge badge-primary badge-xs">{label}</span>
          <span className="badge badge-ghost badge-xs">score {hit.score.toFixed(4)}</span>
          {hit.memory_type === "semantic" ? (
            <>
              <span className="font-mono">{hit.semantic_memory_id}</span>
              <span className="badge badge-outline badge-xs">{hit.type}</span>
              {hit.pinned ? <span className="badge badge-warning badge-xs">pinned</span> : null}
            </>
          ) : null}
          {hit.memory_type === "session" ? (
            <>
              <span className="badge badge-secondary badge-xs">{hit.role}</span>
              <span className="font-mono text-base-content/70">{hit.session_id}</span>
            </>
          ) : null}
          {hit.memory_type === "limbic" ? (
            <span className="badge badge-outline badge-xs">{hit.kind}</span>
          ) : null}
          {hit.memory_type === "autobiographical" ? (
            <span className="badge badge-outline badge-xs">{hit.significance}</span>
          ) : null}
        </div>
        {hit.memory_type === "semantic" ? (
          <>
            <p className="text-sm whitespace-pre-wrap">{hit.content}</p>
            {hit.observed_at || hit.occurred_at ? (
              <p className="text-xs text-base-content/60 font-mono">
                {hit.observed_at ? `observed ${hit.observed_at.slice(0, 19)}` : null}
                {hit.observed_at && hit.occurred_at ? " · " : null}
                {hit.occurred_at ? `occurred ${hit.occurred_at}` : null}
              </p>
            ) : null}
          </>
        ) : null}
        {hit.memory_type === "session" ? (
          <p className="text-sm whitespace-pre-wrap">{hit.snippet}</p>
        ) : null}
        {hit.memory_type === "limbic" ? (
          <p className="text-sm whitespace-pre-wrap">{hit.content}</p>
        ) : null}
        {hit.memory_type === "autobiographical" ? (
          <>
            <p className="text-sm font-medium">{hit.title}</p>
            <p className="text-sm whitespace-pre-wrap text-base-content/80">{hit.snippet}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

function MemoryPage() {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [sessionFilter, setSessionFilter] = useState("");
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [result, setResult] = useState<MemoryResult>({
    query: "",
    limit: 10,
    results: [],
    summary: "",
  });

  const isEmpty = !result.results.length;
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
      const d = (await searchMemory({
        query: q,
        limit,
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
            调试 <code className="text-xs">memory_recall</code>：四源统一召回 + 跨类型重排。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline"
            disabled={busy}
            onClick={() =>
              void postMemoryAction(
                () => countSemanticMemory(),
                "semantic-memory-count",
                "统计 PG semantic_memory 条数（content_fts 自动维护，无需重建）。确定继续？",
              )
            }
          >
            {busyAction === "semantic-memory-count" ? (
              <span className="loading loading-spinner loading-xs" />
            ) : null}
            统计语义记忆
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label py-0">
                <span className="label-text text-xs">返回条数（Top N）</span>
              </label>
              <input
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                type="number"
                min={1}
                max={20}
                className="input input-bordered input-sm"
              />
            </div>
            <div className="form-control">
              <label className="label py-0">
                <span className="label-text text-xs">session 过滤（仅会话消息）</span>
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
                「{lastQuery}」— {result.summary}
              </span>
            ) : null}
          </div>
        </div>
      </form>

      {error ? <div className="alert alert-error text-sm mb-4">{error}</div> : null}

      {searched && !searching && isEmpty ? (
        <div className="alert alert-info text-sm">未找到与「{lastQuery}」匹配的记忆。</div>
      ) : null}

      {searched && !isEmpty ? (
        <div className="space-y-4">
          <section>
            <h3 className="text-sm font-bold mb-2">
              召回结果
              <span className="badge badge-ghost badge-sm ml-1">{result.results.length}</span>
            </h3>
            <div className="space-y-2">
              {result.results.map((hit, idx) => (
                <RecallHitCard key={`${hit.memory_type}-${idx}`} hit={hit} index={idx} />
              ))}
            </div>
          </section>

          <details className="collapse collapse-arrow bg-base-200">
            <summary className="collapse-title text-xs font-mono text-base-content/60 min-h-0 py-3">
              memory_recall 原始输出预览
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
