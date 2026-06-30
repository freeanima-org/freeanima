import { omitUndefined } from "@freeanima/core/util";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import type { AutobiographicalMemoryRow } from "@freeanima/admin-contract/api";
import { FormField, FormFieldLabel, FormFieldset } from "@freeanima/ui-kit/form";
import { MemoryListPagination } from "@admin/components/admin/MemoryListPagination.tsx";
import { listAutobiographicalMemories } from "@admin/lib/api.ts";
import { formatDisplayDateTime } from "@admin/lib/format-datetime.ts";
import { m } from "@admin/lib/i18n.ts";
import { logCaughtError } from "@admin/lib/log-caught-error.ts";
import { useAdminOffsetPagination } from "@admin/lib/use-admin-offset-pagination.ts";

const PAGE_SIZE = 20;

const SIGNIFICANCE_OPTIONS = ["normal", "milestone", "turning_point"] as const;

type AutobiographicalRow = AutobiographicalMemoryRow;

export const Route = createFileRoute("/_sidebar/autobiographical-memory")({
  component: AutobiographicalMemoryPage,
});

function AutobiographicalMemoryPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [significanceFilter, setSignificanceFilter] = useState("");
  const [sourceSession, setSourceSession] = useState("");
  const { setOffset, currentPage, offsetForPage } = useAdminOffsetPagination(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AutobiographicalRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchList = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError("");
      try {
        const data = (await listAutobiographicalMemories(
          omitUndefined({
            query: query.trim() || undefined,
            offset: nextOffset,
            limit: PAGE_SIZE,
            status: statusFilter || undefined,
            significance: significanceFilter || undefined,
            source_conversation: sourceSession.trim() || undefined,
          }),
        )) as { items: AutobiographicalRow[]; total: number };
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setOffset(nextOffset);
        setLoaded(true);
      } catch (e) {
        logCaughtError("routes/_sidebar/autobiographical-memory", e);
        setError(
          m.admin_common_load_failed({
            detail: e instanceof Error ? e.message : String(e),
          }),
        );
      } finally {
        setLoading(false);
      }
    },
    [query, statusFilter, significanceFilter, sourceSession, setOffset],
  );

  const runSearch = () => {
    void fetchList(0);
  };

  const onPageChange = (page: number) => {
    void fetchList(offsetForPage(page));
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{m.admin_nav_autobio()}</h2>
      <p className="text-sm text-base-content/60 mb-4">{m.admin_autobio_desc()}</p>

      <form
        className="card bg-base-200 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
      >
        <div className="card-body gap-3">
          <FormFieldset bordered={false} className="gap-3">
            <FormField label={m.admin_autobio_search()} className="text-xs">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="text"
                className="input input-bordered input-sm"
                placeholder={m.admin_common_keyword_placeholder()}
              />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                </select>
              </div>
              <div>
                <FormFieldLabel className="text-xs py-0">significance</FormFieldLabel>
                <select
                  className="select select-bordered select-sm w-full"
                  value={significanceFilter}
                  onChange={(e) => setSignificanceFilter(e.target.value)}
                >
                  <option value="">{m.admin_common_all()}</option>
                  {SIGNIFICANCE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FormFieldLabel className="text-xs py-0">
                  {m.admin_autobio_source_conversation()}
                </FormFieldLabel>
                <input
                  value={sourceSession}
                  onChange={(e) => setSourceSession(e.target.value)}
                  type="text"
                  className="input input-bordered input-sm font-mono w-full"
                  placeholder="conversation id"
                />
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
            <div className="space-y-2">
              {items.map((row) => (
                <div key={row.id} className="card bg-base-200">
                  <div className="card-body py-3 px-4 gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-sm">{row.title}</span>
                      <span className="badge badge-outline badge-xs">{row.significance}</span>
                      <span className="badge badge-ghost badge-xs">{row.status}</span>
                      <span className="font-mono text-base-content/50">{row.id}</span>
                      <span className="text-base-content/50">
                        {formatDisplayDateTime(row.updated_at)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{row.content}</p>
                    {row.source_conversations?.length ? (
                      <p className="text-xs text-base-content/50 font-mono">
                        conversations: {row.source_conversations.join(", ")}
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
        <p className="text-sm text-base-content/50">{m.admin_common_click_query_hint()}</p>
      )}
    </div>
  );
}
