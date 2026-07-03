import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardContent } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";

import * as m from "../../../../messages/paraglide/messages.js";
import { fetchDreamList, type DreamEntryRow } from "./lib/api.ts";
import { formatDreamDateTime, formatDreamDay } from "./lib/format-dream.ts";

const PAGE_SIZE = 20;

function ListPagination({
  total,
  pageSize,
  currentPage,
  loading,
  onPageChange,
}: {
  total: number;
  pageSize: number;
  currentPage: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  return (
    <div className="border/50 flex items-center justify-between gap-2 border-t pt-2 text-xs">
      <span className="text-muted-foreground">
        共 {total} 条 · 第 {currentPage} / {pageCount} 页
      </span>
      <div className="inline-flex overflow-hidden rounded-md border shadow-xs">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-none border-0 px-2.5 text-xs"
          disabled={currentPage <= 1 || loading}
          onClick={() => onPageChange(currentPage - 1)}
        >
          上一页
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-none border-0 border-l px-2.5 text-xs"
          disabled={currentPage >= pageCount || loading}
          onClick={() => onPageChange(currentPage + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}

export function DreamApp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<DreamEntryRow[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const fetchList = useCallback(async (nextOffset: number) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchDreamList({ offset: nextOffset, limit: PAGE_SIZE });
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setOffset(nextOffset);
      setLoaded(true);
    } catch (e) {
      setError(
        m.console_common_load_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchList(0);
  }, [fetchList]);

  const onPageChange = (page: number) => {
    void fetchList((page - 1) * PAGE_SIZE);
  };

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-bold">{m.console_nav_dream()}</h1>
        <p className="text-sm text-muted-foreground">{m.console_dream_desc()}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => void fetchList(offset)} disabled={loading}>
          {loading ? m.console_common_loading() : m.console_common_refresh()}
        </Button>
      </div>

      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}

      {loaded && items.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">{m.console_dream_empty()}</p>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-3 overflow-y-auto">
          {items.map((row) => {
            const dreamDay = formatDreamDay(row.dream_day);
            const expanded = expandedDay === dreamDay;
            return (
              <Card key={row.id} className="bg-muted py-0 shadow-sm">
                <CardContent className="gap-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold">{dreamDay}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {formatDreamDateTime(row.created_at)}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setExpandedDay(expanded ? null : dreamDay)}
                    >
                      {expanded ? m.console_common_collapse() : m.console_common_expand()}
                    </Button>
                  </div>
                  {expanded ? (
                    <>
                      <pre className="font-sans text-sm whitespace-pre-wrap">{row.content}</pre>
                      {row.source_limbic_ids.length > 0 ? (
                        <p className="text-muted-foreground text-xs">
                          {m.console_dream_source_limbic()}: {row.source_limbic_ids.join(", ")}
                        </p>
                      ) : null}
                      {row.source_conversation_ids.length > 0 ? (
                        <p className="text-muted-foreground text-xs">
                          {m.console_dream_source_conversations()}:{" "}
                          {row.source_conversation_ids.join(", ")}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-muted-foreground line-clamp-3 text-sm">{row.content}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {total > PAGE_SIZE ? (
        <ListPagination
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
          total={total}
          loading={loading}
          onPageChange={onPageChange}
        />
      ) : null}
    </div>
  );
}
