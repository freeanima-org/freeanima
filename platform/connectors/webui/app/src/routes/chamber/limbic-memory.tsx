import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { MemoryListPagination } from "@/components/chamber/MemoryListPagination.tsx";
import { listLimbicMemories } from "@/lib/api.ts";
import { formatDisplayDateTime } from "@/lib/format-datetime.ts";
import { m } from "@/lib/i18n.ts";

const PAGE_SIZE = 20;

const LIMBIC_KINDS = ["conversation_mood", "turning_point", "spike"] as const;

type LimbicRow = {
  id: string;
  conversation_id: string;
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
  const [conversationId, setSessionId] = useState("");
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
          conversation_id: conversationId.trim() || undefined,
          kind: kindFilter || undefined,
        })) as { items: LimbicRow[]; total: number };
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setOffset(nextOffset);
        setLoaded(true);
      } catch (e) {
        setError(
          m.webui_common_load_failed({
            detail: e instanceof Error ? e.message : String(e),
          }),
        );
      } finally {
        setLoading(false);
      }
    },
    [query, conversationId, kindFilter],
  );

  const runSearch = () => {
    void fetchList(0);
  };

  const onPageChange = (page: number) => {
    void fetchList((page - 1) * PAGE_SIZE);
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{m.webui_chamber_nav_limbic()}</h2>
      <p className="text-sm text-base-content/60 mb-4">{m.webui_chamber_limbic_desc()}</p>

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
              <span className="label-text text-xs">{m.webui_chamber_limbic_search()}</span>
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              className="input input-bordered input-sm"
              placeholder={m.webui_common_keyword_placeholder()}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label py-0">
                <span className="label-text text-xs">conversation_id</span>
              </label>
              <input
                value={conversationId}
                onChange={(e) => setSessionId(e.target.value)}
                type="text"
                className="input input-bordered input-sm font-mono"
                placeholder={m.webui_common_optional()}
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
                <option value="">{m.webui_common_all()}</option>
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
            {m.webui_common_query()}
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
            <div className="alert alert-info text-sm">{m.webui_common_no_results()}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>{m.webui_common_time()}</th>
                    <th>kind</th>
                    <th>session</th>
                    <th>{m.webui_chamber_limbic_intensity()}</th>
                    <th>{m.webui_chamber_limbic_content()}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td className="text-xs whitespace-nowrap">
                        {formatDisplayDateTime(row.created)}
                      </td>
                      <td className="text-xs">{row.kind}</td>
                      <td className="font-mono text-xs max-w-32 truncate">{row.conversation_id}</td>
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
        <p className="text-sm text-base-content/50">{m.webui_common_click_query_hint()}</p>
      )}
    </div>
  );
}
