import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import type { SemanticMemoryRow } from "@freeanima/admin-contract/api";
import { FormField, FormFieldLabel, FormFieldset } from "@freeanima/ui-kit/form";
import { MemoryListPagination } from "@admin/components/admin/MemoryListPagination.tsx";
import { m } from "@admin/lib/i18n.ts";
import { formatDisplayDateTime } from "@admin/lib/format-datetime.ts";
import { listSemanticMemories, updateSemanticMemoryPinned } from "@admin/lib/api.ts";
import { logCaughtError } from "@admin/lib/log-caught-error.ts";

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

const BROWSE_SORT_OPTIONS = ["updated_at", "created_at", "reference_count"] as const;
type BrowseSortBy = (typeof BROWSE_SORT_OPTIONS)[number];

type SemanticRow = SemanticMemoryRow & { rank?: number };

export const Route = createFileRoute("/_sidebar/semantic-memory")({
  component: SemanticMemoryPage,
});

function SemanticMemoryPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [sourceConversation, setSourceConversation] = useState("");
  const [sortBy, setSortBy] = useState<BrowseSortBy>("updated_at");
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
          offset: nextOffset,
          limit: PAGE_SIZE,
          status: statusFilter === "all" ? "all" : statusFilter,
          sort_by: effectiveSortBy,
          ...omitUndefined({
            query: trimmedQuery || undefined,
            types: typeFilter ? [typeFilter] : undefined,
            source_conversation: sourceConversation.trim() || undefined,
          }),
        })) as { items: SemanticRow[]; total: number };
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setOffset(nextOffset);
        setHasSearchQuery(Boolean(trimmedQuery));
        setLoaded(true);
      } catch (e) {
        logCaughtError("routes/_sidebar/semantic-memory", e);
        setError(
          m.admin_common_load_failed({
            detail: e instanceof Error ? e.message : String(e),
          }),
        );
      } finally {
        setLoading(false);
      }
    },
    [query, typeFilter, statusFilter, sourceConversation, sortBy],
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
      logCaughtError("routes/_sidebar/semantic-memory", e);
      setError(
        m.admin_common_load_failed({
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
      <h2 className="text-lg font-bold mb-1">{m.admin_nav_semantic()}</h2>
      <p className="text-sm text-base-content/60 mb-4">{m.admin_semantic_desc()}</p>

      <form
        className="card bg-base-200 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
      >
        <div className="card-body gap-3">
          <FormFieldset bordered={false} className="gap-3">
            <FormField label={m.admin_semantic_search_fts()} className="text-xs">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="text"
                className="input input-bordered input-sm"
                placeholder={m.admin_common_keyword_placeholder()}
              />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <FormFieldLabel className="text-xs py-0">
                  {m.admin_common_type_label()}
                </FormFieldLabel>
                <select
                  className="select select-bordered select-sm w-full"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="">{m.admin_common_all()}</option>
                  {SEMANTIC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FormFieldLabel className="text-xs py-0">
                  {m.admin_common_status_label()}
                </FormFieldLabel>
                <select
                  className="select select-bordered select-sm w-full"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="active">active</option>
                  <option value="deprecated">deprecated</option>
                  <option value="all">{m.admin_common_all()}</option>
                </select>
              </div>
              <div>
                <FormFieldLabel className="text-xs py-0">
                  {m.admin_semantic_source_conversation()}
                </FormFieldLabel>
                <input
                  value={sourceConversation}
                  onChange={(e) => setSourceConversation(e.target.value)}
                  type="text"
                  className="input input-bordered input-sm font-mono w-full"
                  placeholder="conversation id"
                />
              </div>
              <div>
                <FormFieldLabel className="text-xs py-0">{m.admin_semantic_sort()}</FormFieldLabel>
                <select
                  className="select select-bordered select-sm w-full"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as BrowseSortBy)}
                >
                  <option value="updated_at">{m.admin_semantic_sort_updated()}</option>
                  <option value="created_at">{m.admin_semantic_sort_created()}</option>
                  <option value="reference_count">{m.admin_semantic_sort_reference_count()}</option>
                </select>
              </div>
            </div>
          </FormFieldset>
          <button type="submit" className="btn btn-sm btn-primary" disabled={loading}>
            {loading ? <span className="loading loading-spinner loading-xs" /> : null}
            {m.admin_common_query()}
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
            <div className="alert alert-info text-sm">{m.admin_common_no_results()}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>id</th>
                    <th>{m.admin_common_type_label()}</th>
                    <th>{m.admin_common_status_label()}</th>
                    <th>{m.admin_semantic_pinned()}</th>
                    <th>{m.admin_semantic_created()}</th>
                    <th>{m.admin_semantic_updated()}</th>
                    <th>{m.admin_semantic_reference_count()}</th>
                    <th>{m.admin_limbic_content()}</th>
                    <th>conversations</th>
                    {hasSearchQuery ? <th>{m.admin_semantic_rank()}</th> : null}
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
                            <span className="label sr-only text-xs">
                              {m.admin_semantic_pin_toggle()}
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
                      <td className="text-xs whitespace-nowrap">
                        {formatDisplayDateTime(row.created_at)}
                      </td>
                      <td className="text-xs whitespace-nowrap">
                        {formatDisplayDateTime(row.updated_at)}
                      </td>
                      <td className="text-xs">{Number(row.reference_count).toFixed(2)}</td>
                      <td className="text-sm max-w-md whitespace-pre-wrap">{row.content}</td>
                      <td className="font-mono text-xs max-w-32 truncate">
                        {row.source_conversations?.length
                          ? row.source_conversations.join(", ")
                          : "-"}
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
        <p className="text-sm text-base-content/50">{m.admin_common_click_query_hint()}</p>
      )}
    </div>
  );
}
