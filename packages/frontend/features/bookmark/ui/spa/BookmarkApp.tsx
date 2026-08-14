import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, ExternalLink, Folder, Search } from "lucide-react";
import { useSubjectScope, SubjectScopeToggle } from "@freeanima/client/portal-sdk/react.tsx";
import { Button, Input, Spinner } from "@freeanima/ui-kit";
import { EmptyState, StatusAlert, PullToRefresh } from "@freeanima/ui-kit/composite";

import { deleteBookmarkRemote, fetchBookmarks, type BookmarkRow } from "./lib/api.ts";

function isHttpUrl(url: string | null): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url);
}

export function BookmarkApp() {
  const { kind: subjectKind } = useSubjectScope();
  const [items, setItems] = useState<BookmarkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [folderStack, setFolderStack] = useState<{ id: number; title: string }[]>([]);

  const currentParentId = folderStack.length === 0 ? null : (folderStack.at(-1)?.id ?? null);

  const load = useCallback(async () => {
    setError("");
    try {
      const q = searchQuery.trim();
      const rows = await fetchBookmarks(
        subjectKind,
        q ? { query: q, limit: 200 } : { parent_id: currentParentId, limit: 2000 },
      );
      setItems(rows.filter((r) => !r.deleted_at));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [subjectKind, searchQuery, currentParentId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const folders = useMemo(() => items.filter((i) => i.kind === "folder"), [items]);
  const urls = useMemo(() => items.filter((i) => i.kind === "url"), [items]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">书签</h1>
          <p className="text-sm text-muted-foreground">
            栖息地中的书签实体；与浏览器扩展双向同步。
          </p>
        </div>
        <SubjectScopeToggle />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            value={searchQuery}
            placeholder="搜索标题或 URL"
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setFolderStack([]);
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void load();
          }}
        >
          刷新
        </Button>
      </div>

      {!searchQuery.trim() && folderStack.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <Button type="button" variant="ghost" size="sm" onClick={() => setFolderStack([])}>
            根目录
          </Button>
          {folderStack.map((f, idx) => (
            <span key={f.id} className="flex items-center gap-1">
              <span className="text-muted-foreground">/</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFolderStack(folderStack.slice(0, idx + 1))}
              >
                {f.title || "未命名"}
              </Button>
            </span>
          ))}
        </div>
      ) : null}

      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <PullToRefresh
          className="min-h-0 flex-1 overflow-auto"
          onRefresh={async () => {
            await load();
          }}
        >
          {items.length === 0 ? (
            <EmptyState message="暂无书签。在浏览器扩展中开启书签同步后，节点会出现在这里。" />
          ) : (
            <ul className="divide-y divide-border rounded-md border">
              {folders.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
                    onClick={() => {
                      if (searchQuery.trim()) setSearchQuery("");
                      setFolderStack((prev) => [...prev, { id: item.id, title: item.title }]);
                    }}
                  >
                    <Folder className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {item.title || "未命名文件夹"}
                    </span>
                  </button>
                </li>
              ))}
              {urls.map((item) => (
                <li key={item.id} className="flex items-center gap-2 px-3 py-2.5">
                  <Bookmark className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{item.title || "未命名书签"}</div>
                    {item.url ? (
                      <div className="truncate text-xs text-muted-foreground">{item.url}</div>
                    ) : null}
                  </div>
                  {isHttpUrl(item.url) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="打开"
                      onClick={() => {
                        const href = item.url;
                        if (href) window.open(href, "_blank", "noopener,noreferrer");
                      }}
                    >
                      <ExternalLink className="size-4" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => {
                      void (async () => {
                        try {
                          await deleteBookmarkRemote(subjectKind, item.id);
                          await load();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : String(e));
                        }
                      })();
                    }}
                  >
                    删除
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </PullToRefresh>
      )}
    </div>
  );
}
