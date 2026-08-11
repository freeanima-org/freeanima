import { useCallback, useEffect, useState } from "react";
import { usePortalRead } from "@freeanima/client/portal-sdk/portal-query";
import { useSubjectScope, SubjectScopeToggle } from "@freeanima/client/portal-sdk/react.tsx";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  Spinner,
} from "@freeanima/ui-kit";
import { formatDateTime } from "@freeanima/ui-kit/lib/datetime-local.ts";
import { m } from "@paraglide/messages";

import {
  listNotifications,
  markNotificationRead,
  getNotificationRecipients,
  type NotificationRow,
} from "./lib/api.ts";
import { useNotificationUnreadStore } from "./stores/notification-unread.ts";

const PAGE_SIZE = 20;

type RecipientIds = { user: string; agent: string };
type ReadFilter = "all" | "unread";

async function resolveRecipientIds(cached: RecipientIds | null): Promise<RecipientIds> {
  if (cached) return cached;
  const remote = await getNotificationRecipients();
  return { user: remote.user_subject_id, agent: remote.agent_subject_id };
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
          isDisabled={currentPage <= 1 || loading}
          onClick={() => onPageChange(currentPage - 1)}
        >
          上一页
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-none border-0 border-l px-2.5 text-xs"
          isDisabled={currentPage >= pageCount || loading}
          onClick={() => onPageChange(currentPage + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}

export function NotificationApp() {
  const { kind: recipientKind } = useSubjectScope();
  const [recipientIds, setRecipientIds] = useState<RecipientIds | null>(null);
  const [readFilter, setReadFilter] = useState<ReadFilter>("unread");
  const [offset, setOffset] = useState(0);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const listQuery = usePortalRead({
    queryKey:
      recipientIds == null
        ? null
        : [
            "notifications",
            recipientKind,
            recipientKind === "user" ? recipientIds.user : recipientIds.agent,
            readFilter,
            offset,
          ],
    queryFn: async () => {
      const ids = recipientIds;
      if (!ids) throw new Error("recipient ids missing");
      const recipient_id = recipientKind === "user" ? ids.user : ids.agent;
      return listNotifications({
        recipient_kind: recipientKind,
        recipient_id,
        read_filter: readFilter,
        offset,
        limit: PAGE_SIZE,
      });
    },
    enabled: recipientIds != null,
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const loading = listQuery.loading;

  useEffect(() => {
    if (listQuery.error) setError(listQuery.error.message);
  }, [listQuery.error]);

  const fetchList = useCallback(async (nextOffset: number) => {
    setError("");
    setOffset(nextOffset);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const ids = await resolveRecipientIds(null);
        setRecipientIds(ids);
        setOffset(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [recipientKind]);

  const onPageChange = (page: number) => {
    setOffset((page - 1) * PAGE_SIZE);
  };

  const handleMarkRead = async (row: NotificationRow) => {
    if (row.read_at) return;
    setMarkingId(row.id);
    setError("");
    try {
      const result = await markNotificationRead(row.id);
      if (readFilter === "unread") {
        listQuery.setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.filter((item) => item.id !== row.id),
            total: Math.max(0, prev.total - 1),
          };
        });
      } else {
        listQuery.setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map((item) => (item.id === row.id ? result.notification : item)),
          };
        });
      }
      void useNotificationUnreadStore.getState().refreshCount();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <h2 className="mb-1 text-lg font-bold">通知</h2>
      <p className="text-muted-foreground mb-4 text-sm">默认显示未读；点击「标记已读」确认处理。</p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SubjectScopeToggle />
        <div className="inline-flex overflow-hidden rounded-md border shadow-xs">
          <Button
            type="button"
            variant={readFilter === "unread" ? "default" : "outline"}
            size="sm"
            className="rounded-none border-0"
            onClick={() => setReadFilter("unread")}
          >
            未读
          </Button>
          <Button
            type="button"
            variant={readFilter === "all" ? "default" : "outline"}
            size="sm"
            className="rounded-none border-0 border-l"
            onClick={() => setReadFilter("all")}
          >
            全部
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          isDisabled={loading}
          aria-label={m.habitat_common_refresh()}
          onClick={() => void fetchList(offset)}
        >
          {loading ? m.habitat_common_refreshing() : m.habitat_common_refresh()}
        </Button>
      </div>

      {error ? (
        <Alert variant="error" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-8">
          <Spinner className="size-4" />
        </div>
      ) : items.length === 0 ? (
        <Alert variant="info">
          <AlertDescription>暂无通知</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-2">
          {items.map((row) => {
            const unread = !row.read_at;
            return (
              <Card
                key={row.id}
                className={`bg-muted w-full gap-0 py-0 shadow-none ${
                  unread ? "ring-1 ring-primary/40" : "opacity-80"
                }`}
              >
                <CardContent className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm ${unread ? "font-semibold" : ""}`}>{row.title}</span>
                    {unread ? (
                      <Badge variant="default" className="text-[10px]">
                        未读
                      </Badge>
                    ) : null}
                    {row.source_kind ? (
                      <Badge variant="ghost" className="text-[10px]">
                        {row.source_kind}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-sm whitespace-pre-wrap">{row.body}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span>创建：{formatDateTime(row.created_at)}</span>
                      <span>已读：{formatDateTime(row.read_at)}</span>
                    </div>
                    {unread ? (
                      <Button
                        type="button"
                        size="sm"
                        isDisabled={markingId === row.id}
                        onClick={() => void handleMarkRead(row)}
                      >
                        {markingId === row.id ? <Spinner className="size-3.5" /> : "标记已读"}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
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
