import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { MemoryListPagination } from "@/components/chamber/MemoryListPagination.tsx";
import { listLimbicMemories } from "@/lib/api.ts";

const PAGE_SIZE = 20;

const LIMBIC_KINDS = ["session_mood", "turning_point", "spike"] as const;

type LimbicRow = {
  id: string;
  session_id: string;
  kind: string;
  valence: number | null;
  arousal: number | null;
  content: string;
  intensity: number;
  created: string;
};

export const Route = createFileRoute("/chamber/limbic-memory")({
  component: LimbicMemoryPage,
});

function LimbicMemoryPage() {
  const [query, setQuery] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<LimbicRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const fetchList = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError("");
      try {
        const data = (await listLimbicMemories({
          query: query.trim() || undefined,
          offset: nextOffset,
          limit: PAGE_SIZE,
          session_id: sessionId.trim() || undefined,
          kind: kindFilter || undefined,
        })) as { items: LimbicRow[]; total: number };
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
    [query, sessionId, kindFilter],
  );

  const runSearch = () => {
    void fetchList(0);
  };

  const onPageChange = (page: number) => {
    void fetchList((page - 1) * PAGE_SIZE);
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">💗 情感记忆</h2>
      <p className="text-sm text-base-content/60 mb-4">
        浏览 limbic_memory（边缘系统 / 情感强度记录）。
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
              <span className="label-text text-xs">搜索词（可选，内容 ILIKE）</span>
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              className="input input-bordered input-sm"
              placeholder="关键词…"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label py-0">
                <span className="label-text text-xs">session_id</span>
              </label>
              <input
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                type="text"
                className="input input-bordered input-sm font-mono"
                placeholder="可选"
              />
            </div>
            <div className="form-control">
              <label className="label py-0">
                <span className="label-text text-xs">kind</span>
              </label>
              <select
                className="select select-bordered select-sm"
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
              >
                <option value="">全部</option>
                {LIMBIC_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
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
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>kind</th>
                    <th>session</th>
                    <th>强度</th>
                    <th>内容</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td className="text-xs whitespace-nowrap">
                        {String(row.created).slice(0, 19)}
                      </td>
                      <td className="text-xs">{row.kind}</td>
                      <td className="font-mono text-xs max-w-32 truncate">{row.session_id}</td>
                      <td className="text-xs">{row.intensity.toFixed(2)}</td>
                      <td className="text-sm max-w-md whitespace-pre-wrap">{row.content}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
