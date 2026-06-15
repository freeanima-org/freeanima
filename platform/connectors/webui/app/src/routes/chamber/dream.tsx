import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { MemoryListPagination } from "@/components/chamber/MemoryListPagination.tsx";
import { listDreamMemories } from "@/lib/api.ts";
import { m } from "@/lib/i18n.ts";

const PAGE_SIZE = 20;

function formatDreamDay(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function formatCreated(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 19);
  return String(value).slice(0, 19);
}

type DreamRow = {
  id: string;
  dream_day: string | Date;
  content: string;
  source_limbic_ids: string[];
  source_session_ids: string[];
  created: string | Date;
};

export const Route = createFileRoute("/chamber/dream")({
  component: DreamMemoryPage,
});

function DreamMemoryPage() {
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<DreamRow[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const fetchList = useCallback(async (nextOffset: number) => {
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
      setError(
        m.webui_common_load_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const runSearch = () => {
    void fetchList(0);
  };

  const onPageChange = (page: number) => {
    void fetchList((page - 1) * PAGE_SIZE);
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{m.webui_chamber_nav_dream()}</h2>
      <p className="text-sm text-base-content/60 mb-4">{m.webui_chamber_dream_desc()}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={runSearch}
          disabled={loading}
        >
          {loading ? m.webui_common_loading() : m.webui_common_refresh()}
        </button>
      </div>

      {error ? <div className="alert alert-error text-sm mb-4">{error}</div> : null}

      {loaded && !items.length && !loading ? (
        <p className="text-sm text-base-content/60">{m.webui_chamber_dream_empty()}</p>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((row) => {
            const dreamDay = formatDreamDay(row.dream_day);
            const expanded = expandedDay === dreamDay;
            return (
              <div key={row.id} className="card bg-base-200 shadow-sm">
                <div className="card-body p-4 gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold">{dreamDay}</span>
                      <span className="text-xs text-base-content/50 ml-2">
                        {formatCreated(row.created)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => setExpandedDay(expanded ? null : dreamDay)}
                    >
                      {expanded ? m.webui_common_collapse() : m.webui_common_expand()}
                    </button>
                  </div>
                  {expanded ? (
                    <>
                      <pre className="whitespace-pre-wrap text-sm font-sans">{row.content}</pre>
                      {row.source_limbic_ids.length ? (
                        <p className="text-xs text-base-content/60">
                          {m.webui_chamber_dream_source_limbic()}:{" "}
                          {row.source_limbic_ids.join(", ")}
                        </p>
                      ) : null}
                      {row.source_session_ids.length ? (
                        <p className="text-xs text-base-content/60">
                          {m.webui_chamber_dream_source_sessions()}:{" "}
                          {row.source_session_ids.join(", ")}
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
