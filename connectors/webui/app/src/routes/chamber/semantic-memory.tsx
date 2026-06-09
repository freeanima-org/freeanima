import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { MemoryListPagination } from "@/components/chamber/MemoryListPagination.tsx";
import { listSemanticMemories } from "@/lib/api.ts";

const PAGE_SIZE = 20;

const SEMANTIC_TYPES = [
  "world",
  "experience",
  "opinion",
  "observation",
  "preference",
  "procedural",
  "imprint",
] as const;

type SemanticRow = {
  id: string;
  type: string;
  pinned: boolean;
  content: string;
  source_sessions: string[];
  status: string;
  updated: string;
  rank?: number;
};

export const Route = createFileRoute("/chamber/semantic-memory")({
  component: SemanticMemoryPage,
});

function SemanticMemoryPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [sourceSession, setSourceSession] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<SemanticRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const fetchList = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError("");
      try {
        const data = (await listSemanticMemories({
          query: query.trim() || undefined,
          offset: nextOffset,
          limit: PAGE_SIZE,
          types: typeFilter ? [typeFilter] : undefined,
          status: statusFilter === "all" ? "all" : statusFilter,
          source_session: sourceSession.trim() || undefined,
        })) as { items: SemanticRow[]; total: number };
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setOffset(nextOffset);
        setLoaded(true);
      } catch (e) {
        setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setLoading(false);
      }
    },
    [query, typeFilter, statusFilter, sourceSession],
  );

  const runSearch = () => {
    void fetchList(0);
  };

  const onPageChange = (page: number) => {
    const nextOffset = (page - 1) * PAGE_SIZE;
    void fetchList(nextOffset);
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">📝 语义记忆</h2>
      <p className="text-sm text-base-content/60 mb-4">
        浏览 PG semantic_memory 表，支持 FTS 搜索与过滤。
      </p>

      <form
        className="card bg-base-200 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
      >
        <div className="card-body gap-3">
          <div className="form-control">
            <label className="label py-0">
              <span className="label-text text-xs">搜索词（可选，FTS）</span>
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              className="input input-bordered input-sm"
              placeholder="关键词…"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="form-control">
              <label className="label py-0">
                <span className="label-text text-xs">类型</span>
              </label>
              <select
                className="select select-bordered select-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">全部</option>
                {SEMANTIC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label py-0">
                <span className="label-text text-xs">状态</span>
              </label>
              <select
                className="select select-bordered select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="active">active</option>
                <option value="deprecated">deprecated</option>
                <option value="all">全部</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label py-0">
                <span className="label-text text-xs">来源 session（可选）</span>
              </label>
              <input
                value={sourceSession}
                onChange={(e) => setSourceSession(e.target.value)}
                type="text"
                className="input input-bordered input-sm font-mono"
                placeholder="session id"
              />
            </div>
          </div>
          <button type="submit" className="btn btn-sm btn-primary" disabled={loading}>
            {loading ? <span className="loading loading-spinner loading-xs" /> : null}
            查询
          </button>
        </div>
      </form>

      {error ? <div className="alert alert-error text-sm mb-4">{error}</div> : null}

      {loaded ? (
        <div className="space-y-3">
          {loading && items.length === 0 ? (
            <div className="flex justify-center py-6">
              <span className="loading loading-dots loading-sm" />
            </div>
          ) : items.length === 0 ? (
            <div className="alert alert-info text-sm">无匹配记录。</div>
          ) : (
            <div className="space-y-2">
              {items.map((row) => (
                <div key={row.id} className="card bg-base-200">
                  <div className="card-body py-3 px-4 gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold">{row.id}</span>
                      <span className="badge badge-outline badge-xs">{row.type}</span>
                      <span className="badge badge-ghost badge-xs">{row.status}</span>
                      {row.pinned ? (
                        <span className="badge badge-primary badge-xs">pinned</span>
                      ) : null}
                      {row.rank != null ? (
                        <span className="badge badge-ghost badge-xs">
                          rank {Number(row.rank).toFixed(4)}
                        </span>
                      ) : null}
                      <span className="text-base-content/50">
                        {String(row.updated).slice(0, 19)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{row.content}</p>
                    {row.source_sessions?.length ? (
                      <p className="text-xs text-base-content/50 font-mono">
                        sessions: {row.source_sessions.join(", ")}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
          <MemoryListPagination
            total={total}
            pageSize={PAGE_SIZE}
            currentPage={currentPage}
            loading={loading}
            onPageChange={onPageChange}
          />
        </div>
      ) : (
        <p className="text-sm text-base-content/50">点击「查询」加载列表。</p>
      )}
    </div>
  );
}
