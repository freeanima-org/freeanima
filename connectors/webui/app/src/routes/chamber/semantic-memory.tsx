import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { MemoryListPagination } from "@/components/chamber/MemoryListPagination.tsx";
import { m } from "@/lib/i18n.ts";
import { listSemanticMemories, updateSemanticMemoryPinned } from "@/lib/api.ts";

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

const BROWSE_SORT_OPTIONS = ["updated", "created", "reference_count"] as const;
type BrowseSortBy = (typeof BROWSE_SORT_OPTIONS)[number];

type SemanticRow = {
  id: string;
  type: string;
  pinned: boolean;
  content: string;
  source_sessions: string[];
  status: string;
  reference_count: number;
  created: string;
  updated: string;
  rank?: number;
};

function formatTimestamp(value: string): string {
  return String(value).slice(0, 19);
}

export const Route = createFileRoute("/chamber/semantic-memory")({
  component: SemanticMemoryPage,
});

function SemanticMemoryPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [sourceSession, setSourceSession] = useState("");
  const [sortBy, setSortBy] = useState<BrowseSortBy>("updated");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<SemanticRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasSearchQuery, setHasSearchQuery] = useState(false);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const fetchList = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError("");
      const trimmedQuery = query.trim();
      const effectiveSortBy = trimmedQuery ? "rank" : sortBy;
      try {
        const data = (await listSemanticMemories({
          query: trimmedQuery || undefined,
          offset: nextOffset,
          limit: PAGE_SIZE,
          types: typeFilter ? [typeFilter] : undefined,
          status: statusFilter === "all" ? "all" : statusFilter,
          source_session: sourceSession.trim() || undefined,
          sort_by: effectiveSortBy,
        })) as { items: SemanticRow[]; total: number };
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setOffset(nextOffset);
        setHasSearchQuery(Boolean(trimmedQuery));
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
    [query, typeFilter, statusFilter, sourceSession, sortBy],
  );

  const runSearch = () => {
    void fetchList(0);
  };

  const onPageChange = (page: number) => {
    void fetchList((page - 1) * PAGE_SIZE);
  };

  const onTogglePinned = async (row: SemanticRow, nextPinned: boolean) => {
    if (row.status !== "active") return;
    setToggling((prev) => ({ ...prev, [row.id]: true }));
    setError("");
    try {
      await updateSemanticMemoryPinned({ id: row.id, pinned: nextPinned });
      setItems((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, pinned: nextPinned } : item)),
      );
    } catch (e) {
      setError(
        m.webui_common_load_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setToggling((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{m.webui_chamber_nav_semantic()}</h2>
      <p className="text-sm text-base-content/60 mb-4">{m.webui_chamber_semantic_desc()}</p>

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
              <span className="label-text text-xs">{m.webui_chamber_semantic_search_fts()}</span>
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              className="input input-bordered input-sm"
              placeholder={m.webui_common_keyword_placeholder()}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="form-control">
              <label className="label py-0">
                <span className="label-text text-xs">{m.webui_common_type_label()}</span>
              </label>
              <select
                className="select select-bordered select-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">{m.webui_common_all()}</option>
                {SEMANTIC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label py-0">
                <span className="label-text text-xs">{m.webui_common_status_label()}</span>
              </label>
              <select
                className="select select-bordered select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="active">active</option>
                <option value="deprecated">deprecated</option>
                <option value="all">{m.webui_common_all()}</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label py-0">
                <span className="label-text text-xs">
                  {m.webui_chamber_semantic_source_session()}
                </span>
              </label>
              <input
                value={sourceSession}
                onChange={(e) => setSourceSession(e.target.value)}
                type="text"
                className="input input-bordered input-sm font-mono"
                placeholder="session id"
              />
            </div>
            <div className="form-control">
              <label className="label py-0">
                <span className="label-text text-xs">{m.webui_chamber_semantic_sort()}</span>
              </label>
              <select
                className="select select-bordered select-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as BrowseSortBy)}
              >
                <option value="updated">{m.webui_chamber_semantic_sort_updated()}</option>
                <option value="created">{m.webui_chamber_semantic_sort_created()}</option>
                <option value="reference_count">
                  {m.webui_chamber_semantic_sort_reference_count()}
                </option>
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
                    <th>id</th>
                    <th>{m.webui_common_type_label()}</th>
                    <th>{m.webui_common_status_label()}</th>
                    <th>{m.webui_chamber_semantic_pinned()}</th>
                    <th>{m.webui_chamber_semantic_created()}</th>
                    <th>{m.webui_chamber_semantic_updated()}</th>
                    <th>{m.webui_chamber_semantic_reference_count()}</th>
                    <th>{m.webui_chamber_limbic_content()}</th>
                    <th>sessions</th>
                    {hasSearchQuery ? <th>{m.webui_chamber_semantic_rank()}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono text-xs whitespace-nowrap">{row.id}</td>
                      <td className="text-xs">{row.type}</td>
                      <td className="text-xs">{row.status}</td>
                      <td className="text-xs">
                        {row.status === "active" ? (
                          <label className="label cursor-pointer gap-2 py-0 justify-start">
                            <span className="label-text text-xs sr-only">
                              {m.webui_chamber_semantic_pin_toggle()}
                            </span>
                            <input
                              type="checkbox"
                              className="toggle toggle-sm toggle-primary"
                              checked={row.pinned}
                              disabled={Boolean(toggling[row.id])}
                              onChange={(e) => void onTogglePinned(row, e.target.checked)}
                            />
                          </label>
                        ) : row.pinned ? (
                          <span className="badge badge-ghost badge-xs">pinned</span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="text-xs whitespace-nowrap">{formatTimestamp(row.created)}</td>
                      <td className="text-xs whitespace-nowrap">{formatTimestamp(row.updated)}</td>
                      <td className="text-xs">{Number(row.reference_count).toFixed(2)}</td>
                      <td className="text-sm max-w-md whitespace-pre-wrap">{row.content}</td>
                      <td className="font-mono text-xs max-w-32 truncate">
                        {row.source_sessions?.length ? row.source_sessions.join(", ") : "-"}
                      </td>
                      {hasSearchQuery ? (
                        <td className="text-xs whitespace-nowrap">
                          {row.rank != null ? Number(row.rank).toFixed(4) : "-"}
                        </td>
                      ) : null}
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
