import { useCallback, useEffect, useState } from "react";

import {
  listNotifications,
  markNotificationRead,
  type NotificationRow,
} from "../lib/sap-notifications-api.ts";

const PAGE_SIZE = 20;

type RecipientKind = "user" | "agent";
type ReadFilter = "all" | "unread";

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

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
    <div className="flex items-center justify-between gap-2 pt-2 border-t border-base-300/50 text-xs">
      <span className="text-base-content/60">
        共 {total} 条 · 第 {currentPage} / {pageCount} 页
      </span>
      <div className="join">
        <button
          type="button"
          className="btn btn-xs join-item"
          disabled={currentPage <= 1 || loading}
          onClick={() => onPageChange(currentPage - 1)}
        >
          上一页
        </button>
        <button
          type="button"
          className="btn btn-xs join-item"
          disabled={currentPage >= pageCount || loading}
          onClick={() => onPageChange(currentPage + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}

export function NotificationsPage() {
  const [recipientKind, setRecipientKind] = useState<RecipientKind>("user");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const fetchList = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError("");
      try {
        const data = await listNotifications({
          recipient_kind: recipientKind,
          read_filter: readFilter,
          offset: nextOffset,
          limit: PAGE_SIZE,
        });
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setOffset(nextOffset);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [recipientKind, readFilter],
  );

  useEffect(() => {
    void fetchList(0);
  }, [fetchList]);

  const onPageChange = (page: number) => {
    void fetchList((page - 1) * PAGE_SIZE);
  };

  const handleMarkRead = async (row: NotificationRow) => {
    if (row.read_at) return;
    setMarkingId(row.id);
    setError("");
    try {
      const result = await markNotificationRead(row.id);
      setItems((prev) => prev.map((item) => (item.id === row.id ? result.notification : item)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <h2 className="text-lg font-bold mb-1">通知</h2>
      <p className="text-sm text-base-content/60 mb-4">查看用户与 Agent 收件箱，手动标记已读。</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="join">
          <button
            type="button"
            className={`btn btn-sm join-item ${recipientKind === "user" ? "btn-primary" : ""}`}
            onClick={() => setRecipientKind("user")}
          >
            用户
          </button>
          <button
            type="button"
            className={`btn btn-sm join-item ${recipientKind === "agent" ? "btn-primary" : ""}`}
            onClick={() => setRecipientKind("agent")}
          >
            Agent
          </button>
        </div>
        <div className="join">
          <button
            type="button"
            className={`btn btn-sm join-item ${readFilter === "all" ? "btn-primary" : ""}`}
            onClick={() => setReadFilter("all")}
          >
            全部
          </button>
          <button
            type="button"
            className={`btn btn-sm join-item ${readFilter === "unread" ? "btn-primary" : ""}`}
            onClick={() => setReadFilter("unread")}
          >
            未读
          </button>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={loading}
          onClick={() => void fetchList(offset)}
        >
          刷新
        </button>
      </div>

      {error ? <div className="alert alert-error text-sm mb-4">{error}</div> : null}

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-dots loading-sm" />
        </div>
      ) : items.length === 0 ? (
        <div className="alert alert-info text-sm">暂无通知</div>
      ) : (
        <div className="space-y-2">
          {items.map((row) => {
            const unread = !row.read_at;
            return (
              <button
                key={row.id}
                type="button"
                className={`card bg-base-200 w-full text-left transition-opacity ${
                  unread ? "ring-1 ring-primary/40" : "opacity-80"
                } ${markingId === row.id ? "opacity-60" : "hover:bg-base-300/60"}`}
                disabled={!unread || markingId === row.id}
                onClick={() => void handleMarkRead(row)}
              >
                <div className="card-body py-3 px-4 gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm ${unread ? "font-semibold" : ""}`}>{row.title}</span>
                    {unread ? <span className="badge badge-primary badge-xs">未读</span> : null}
                    {row.source_kind ? (
                      <span className="badge badge-ghost badge-xs">{row.source_kind}</span>
                    ) : null}
                  </div>
                  <p className="text-sm text-base-content/80 whitespace-pre-wrap">{row.body}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-base-content/60">
                    <span>创建：{formatDateTime(row.created_at)}</span>
                    <span>已读：{formatDateTime(row.read_at)}</span>
                  </div>
                  {unread ? <p className="text-xs text-primary/80">点击标记为已读</p> : null}
                </div>
              </button>
            );
          })}
          <ListPagination
            total={total}
            pageSize={PAGE_SIZE}
            currentPage={currentPage}
            loading={loading}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
