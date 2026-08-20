import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import {
  Badge,
  Button,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@freeanima/ui-kit";
import { showConfirm, StatusAlert, toast } from "@freeanima/ui-kit/composite";
import { copyText } from "@freeanima/ui-kit/lib/copy-text.ts";
import { shouldUseNativeShellNavigation } from "@freeanima/client/portal-sdk/shell-runtime.ts";

import {
  deleteConversationShare,
  listConversationShares,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/conversation-shares")({
  component: ConversationSharesPage,
});

type ShareRow = {
  id: string;
  conversation_id: string;
  scope: "full" | "selected";
  title?: string;
  created_at: string;
  expires_at: string;
  message_count: number;
  ttl_remaining_seconds: number | null;
  url_path: string;
  url?: string;
};

function formatTtlRemaining(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds <= 0) return "已过期";
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时`;
  return `${Math.floor(seconds / 86400)} 天`;
}

/** 与 Chat 创建分享一致：有绝对 url 优先，否则相对壳 basepath 拼当前 origin */
function absoluteShareUrl(urlPath: string): string {
  if (shouldUseNativeShellNavigation()) {
    const base = window.location.href.split("#")[0] ?? window.location.origin;
    return `${base}#${urlPath}`;
  }
  const raw = (import.meta.env?.BASE_URL ?? "/").replace(/\/$/, "");
  const basepath = raw && raw !== "." && raw.startsWith("/") ? raw : "";
  return `${window.location.origin}${basepath}${urlPath}`;
}

function resolveShareCopyUrl(row: Pick<ShareRow, "url" | "url_path">): string {
  const absolute = row.url?.trim();
  if (absolute) return absolute;
  return absoluteShareUrl(row.url_path);
}

function ConversationSharesPage() {
  const [items, setItems] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listConversationShares();
      setItems(result.items);
    } catch (e) {
      logCaughtError("conversation-shares.list", e);
      setError(e instanceof Error ? e.message : "加载失败");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onDelete = async (row: ShareRow) => {
    const confirmed = await showConfirm({
      title: "删除分享链接",
      description: `确定删除「${row.title?.trim() || row.id}」？删除后公开链接将立即失效。`,
      confirmLabel: "删除",
      cancelLabel: "取消",
    });
    if (!confirmed) return;
    setDeletingId(row.id);
    try {
      await deleteConversationShare(row.id);
      toast("已删除", { duration: 2000 });
      await refresh();
    } catch (e) {
      logCaughtError("conversation-shares.delete", e);
      toast(e instanceof Error ? e.message : "删除失败", { duration: 4000 });
    } finally {
      setDeletingId(null);
    }
  };

  const onCopy = async (row: ShareRow) => {
    const url = resolveShareCopyUrl(row);
    const ok = await copyText(url);
    toast(ok ? "链接已复制" : "复制失败", { duration: 2000 });
  };

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">{"🔗 临时分享"}</h1>
        <span className="flex-1" />
        <Button
          type="button"
          size="sm"
          variant="outline"
          isDisabled={loading}
          onClick={() => void refresh()}
        >
          {loading ? "刷新中…" : "刷新"}
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        {"聊天室生成的公开临时分享链接（存 Redis，到期自动失效）。可在此查看并手动删除。"}
      </p>

      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}

      {loading && items.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner className="size-6" />
        </div>
      ) : null}

      {!loading && items.length === 0 && !error ? (
        <p className="text-muted-foreground text-sm">{"暂无有效分享链接"}</p>
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{"标题 / ID"}</TableHead>
                <TableHead>{"范围"}</TableHead>
                <TableHead>{"消息数"}</TableHead>
                <TableHead>{"创建"}</TableHead>
                <TableHead>{"过期"}</TableHead>
                <TableHead>{"剩余"}</TableHead>
                <TableHead className="text-right">{"操作"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium">
                        {row.title?.trim() || "（无标题）"}
                      </span>
                      <span className="text-muted-foreground font-mono text-xs">{row.id}</span>
                      <span className="text-muted-foreground truncate font-mono text-[10px]">
                        {row.conversation_id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {row.scope === "full" ? "整段对话" : "所选消息"}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.message_count}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatDisplayDateTime(row.created_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatDisplayDateTime(row.expires_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatTtlRemaining(row.ttl_remaining_seconds)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void onCopy(row)}
                      >
                        {"复制"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        isDisabled={deletingId === row.id}
                        onClick={() => void onDelete(row)}
                      >
                        {deletingId === row.id ? "删除中…" : "删除"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
