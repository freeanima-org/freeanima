import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import type { DreamMemoryRow } from "@freeanima/admin-api/api";
import { MemoryListPagination } from "@admin/components/admin/MemoryListPagination.tsx";
import { listDreamMemories } from "@admin/lib/api.ts";
import { formatDisplayDate, formatDisplayDateTime } from "@admin/lib/format-datetime.ts";
import { m } from "@admin/lib/i18n.ts";
import { logCaughtError } from "@admin/lib/log-caught-error.ts";
import { useAdminOffsetPagination } from "@admin/lib/use-admin-offset-pagination.ts";

const PAGE_SIZE = 20;

type DreamRow = DreamMemoryRow;

export const Route = createFileRoute("/_sidebar/dream")({
  component: DreamMemoryPage,
});

function DreamMemoryPage() {
  const { setOffset, currentPage, offsetForPage } = useAdminOffsetPagination(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<DreamRow[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchList = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError("");
      try {
        const data = (await listDreamMemories({
          offset: nextOffset,
          limit: PAGE_SIZE,
        })) as { items: DreamRow[]; total: number };
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setOffset(nextOffset);
        setLoaded(true);
      } catch (e) {
        logCaughtError("routes/_sidebar/dream", e);
        setError(
          m.admin_common_load_failed({
            detail: e instanceof Error ? e.message : String(e),
          }),
        );
      } finally {
        setLoading(false);
      }
    },
    [setOffset],
  );

  const runSearch = () => {
    void fetchList(0);
  };

  const onPageChange = (page: number) => {
    void fetchList(offsetForPage(page));
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{m.admin_nav_dream()}</h2>
      <p className="text-sm text-base-content/60 mb-4">{m.admin_dream_desc()}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={runSearch}
          disabled={loading}
        >
          {loading ? m.admin_common_loading() : m.admin_common_refresh()}
        </button>
      </div>

      {error ? <div className="alert alert-error text-sm mb-4">{error}</div> : null}

      {loaded && !items.length && !loading ? (
        <p className="text-sm text-base-content/60">{m.admin_dream_empty()}</p>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((row) => {
            const dreamDay = formatDisplayDate(row.dream_day);
            const expanded = expandedDay === dreamDay;
            return (
              <div key={row.id} className="card bg-base-200 shadow-sm">
                <div className="card-body p-4 gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold">{dreamDay}</span>
                      <span className="text-xs text-base-content/50 ml-2">
                        {formatDisplayDateTime(row.created_at)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => setExpandedDay(expanded ? null : dreamDay)}
                    >
                      {expanded ? m.admin_common_collapse() : m.admin_common_expand()}
                    </button>
                  </div>
                  {expanded ? (
                    <>
                      <pre className="whitespace-pre-wrap text-sm font-sans">{row.content}</pre>
                      {row.source_limbic_ids.length ? (
                        <p className="text-xs text-base-content/60">
                          {m.admin_dream_source_limbic()}: {row.source_limbic_ids.join(", ")}
                        </p>
                      ) : null}
                      {row.source_conversation_ids.length ? (
                        <p className="text-xs text-base-content/60">
                          {m.admin_dream_source_conversations()}:{" "}
                          {row.source_conversation_ids.join(", ")}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-base-content/80 line-clamp-3">{row.content}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {total > PAGE_SIZE ? (
        <MemoryListPagination
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={onPageChange}
        />
      ) : null}
    </div>
  );
}
