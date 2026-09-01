import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { FileText, Plus, Search, Trash2 } from "lucide-react";
import { useUserSubjectId, useShellQuickIdSet } from "@freeanima/client/portal-sdk/react.tsx";
import { toggleShellQuick } from "@freeanima/client/portal-sdk/shell-quick.ts";
import { useIdMappingRemap } from "@freeanima/client/portal-sdk/use-id-mapping-remap";
import { openEntityResource } from "@freeanima/client/portal-sdk/open-entity-resource.ts";
import { Button, Input, Spinner, Textarea } from "@freeanima/ui-kit";
import { EmptyState, StatusAlert, PullToRefresh } from "@freeanima/ui-kit/composite";
import { ListDetailLayout } from "@freeanima/ui-kit/layout";
import {
  AUTO_PERSIST_LONG,
  AUTO_PERSIST_SHORT,
  createAutoPersistScheduler,
} from "@freeanima/ui-kit/lib/auto-persist-schedule.ts";
import { renderMarkdownHtml } from "@freeanima/ui-kit/lib/markdown.ts";
import { NOTE_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
import { TagPicker } from "@freeanima/features/tag/ui/spa/components/TagPicker.tsx";
import { TagChips } from "@freeanima/features/tag/ui/spa/components/TagChips.tsx";
import { fetchTags, type TagRow } from "@freeanima/features/tag/ui/spa/lib/api.ts";

import {
  createNote,
  createNoteBlock,
  deleteNote,
  deleteNoteBlock,
  fetchNotes,
  getNote,
  searchNotes,
  updateNote,
  updateNoteBlock,
  registerNoteOfflineModule,
  type NoteRow,
  type NoteTextBlock,
} from "./lib/api.ts";

type PersistStatus = "idle" | "pending" | "saving" | "saved" | "error";

function readUrlNoteId(): number | null {
  const raw = new URLSearchParams(window.location.search).get("id");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n !== 0 ? n : null;
}

function useUrlNoteId(): [number | null, (id: number | null) => void] {
  const [id, setIdState] = useState<number | null>(() => readUrlNoteId());

  useEffect(() => {
    const onPop = () => setIdState(readUrlNoteId());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setId = useCallback((next: number | null) => {
    const url = new URL(window.location.href);
    if (next == null) url.searchParams.delete("id");
    else url.searchParams.set("id", String(next));
    if (url.href !== window.location.href) {
      window.history.replaceState(null, "", url);
    }
    setIdState(next);
  }, []);

  return [id, setId];
}

function persistStatusLabel(status: PersistStatus): string {
  switch (status) {
    case "pending":
      return "待保存…";
    case "saving":
      return "保存中…";
    case "saved":
      return "已保存";
    case "error":
      return "保存失败";
    default:
      return "";
  }
}

function MarkdownBlockEditor({
  block,
  onSave,
  onDelete,
}: {
  block: NoteTextBlock;
  onSave: (content: string) => Promise<void>;
  onDelete: () => Promise<void>;
}): JSX.Element {
  const [draft, setDraft] = useState(block.content);
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState<PersistStatus>("idle");
  const draftRef = useRef(draft);
  const savedRef = useRef(block.content);
  const savingRef = useRef(false);
  draftRef.current = draft;

  const persistNow = useCallback(async () => {
    const next = draftRef.current;
    if (next === savedRef.current || savingRef.current) return;
    savingRef.current = true;
    setStatus("saving");
    try {
      await onSave(next);
      savedRef.current = next;
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      savingRef.current = false;
    }
  }, [onSave]);

  const persistRef = useRef(persistNow);
  persistRef.current = persistNow;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const scheduler = useMemo(
    () =>
      createAutoPersistScheduler({
        ...AUTO_PERSIST_LONG,
        onFire: () => void persistRef.current(),
      }),
    [],
  );

  useEffect(() => {
    return () => {
      scheduler.cancel();
      const next = draftRef.current;
      if (next !== savedRef.current) {
        void onSaveRef.current(next).catch(() => {
          /* unmount: best-effort */
        });
      }
    };
  }, [scheduler]);

  useEffect(() => {
    setDraft(block.content);
    savedRef.current = block.content;
    setStatus("idle");
    scheduler.cancel();
  }, [block.id, block.content, scheduler]);

  const html = useMemo(() => renderMarkdownHtml(draft), [draft]);

  const flushThen = useCallback(
    (fn?: () => void) => {
      scheduler.cancel();
      void persistNow().finally(() => fn?.());
    },
    [persistNow, scheduler],
  );

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={preview ? "outline" : "secondary"}
            onClick={() => flushThen(() => setPreview(false))}
          >
            编辑
          </Button>
          <Button
            type="button"
            size="sm"
            variant={preview ? "secondary" : "outline"}
            onClick={() => flushThen(() => setPreview(true))}
          >
            预览
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {status !== "idle" ? (
            <span
              className={`text-xs ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}
            >
              {persistStatusLabel(status)}
            </span>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              scheduler.cancel();
              void onDelete();
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      {preview ? (
        <div
          className="prose prose-sm dark:prose-invert max-w-none min-h-24"
          dangerouslySetInnerHTML={{ __html: html }}
          onClick={(e) => {
            const t = e.target instanceof HTMLElement ? e.target : null;
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- DOM 事件目标边界
            const a = t?.closest?.(
              "a[data-anima-uri], a[href^='anima:']",
            ) as HTMLAnchorElement | null;
            if (!a) return;
            e.preventDefault();
            const href = a.getAttribute("data-anima-uri") || a.getAttribute("href");
            if (href) void openEntityResource(href);
          }}
        />
      ) : (
        <Textarea
          className="min-h-32 font-mono text-sm"
          value={draft}
          placeholder="Markdown… 可用 [[anima:id]] 引用实体"
          onChange={(e) => {
            const value = e.target.value;
            setDraft(value);
            if (value !== savedRef.current) {
              setStatus("pending");
              scheduler.schedule();
            } else {
              scheduler.cancel();
              setStatus("idle");
            }
          }}
          onBlur={() => {
            scheduler.cancel();
            void persistNow();
          }}
        />
      )}
    </div>
  );
}

export function NoteApp(): JSX.Element {
  const subjectId = useUserSubjectId();
  const quickIds = useShellQuickIdSet();
  const [selectedId, setSelectedId] = useUrlNoteId();
  const [items, setItems] = useState<NoteRow[]>([]);
  const [detail, setDetail] = useState<NoteRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [tagPool, setTagPool] = useState<TagRow[]>([]);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleStatus, setTitleStatus] = useState<PersistStatus>("idle");
  const titleDraftRef = useRef(titleDraft);
  const titleSavedRef = useRef("");
  const titleSavingRef = useRef(false);
  titleDraftRef.current = titleDraft;

  const titleById = useMemo(() => new Map(tagPool.map((t) => [t.id, t.title])), [tagPool]);

  useEffect(() => {
    registerNoteOfflineModule();
  }, []);

  useIdMappingRemap("note", (event) => {
    const { tempId, serverId } = event;
    setItems((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (row.id === tempId) {
          changed = true;
          return {
            ...row,
            id: serverId,
            blocks: row.blocks.map((b) => ({ ...b, parent_id: serverId })),
          };
        }
        const blocks = row.blocks.map((b) => (b.id === tempId ? { ...b, id: serverId } : b));
        if (blocks.some((b, i) => b.id !== row.blocks[i]?.id)) {
          changed = true;
          return { ...row, blocks };
        }
        return row;
      });
      return changed ? next : prev;
    });
    if (selectedId === tempId) setSelectedId(serverId);
    setDetail((prev) => {
      if (!prev) return prev;
      if (prev.id === tempId) {
        return {
          ...prev,
          id: serverId,
          blocks: prev.blocks.map((b) =>
            b.id === tempId
              ? { ...b, id: serverId, parent_id: serverId }
              : { ...b, parent_id: serverId },
          ),
        };
      }
      if (!prev.blocks.some((b) => b.id === tempId)) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === tempId ? { ...b, id: serverId } : b)),
      };
    });
  });

  const loadList = useCallback(async () => {
    setError("");
    try {
      const q = searchQuery.trim();
      const rows = q
        ? await searchNotes(subjectId, q, 50)
        : await fetchNotes(subjectId, { limit: 50 });
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [subjectId, searchQuery]);

  useEffect(() => {
    setLoading(true);
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void fetchTags()
      .then(setTagPool)
      .catch(() => setTagPool([]));
  }, [subjectId]);

  const persistTitle = useCallback(async () => {
    if (!detail) return;
    const next = titleDraftRef.current.trim();
    if (!next || next === titleSavedRef.current || titleSavingRef.current) return;
    titleSavingRef.current = true;
    setTitleStatus("saving");
    try {
      const item = await updateNote(subjectId, detail.id, { title: next });
      titleSavedRef.current = item.title;
      setTitleDraft(item.title);
      setDetail(item);
      setTitleStatus("saved");
      await loadList();
    } catch (e) {
      setTitleStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      titleSavingRef.current = false;
    }
  }, [detail, loadList, subjectId]);

  const persistTitleRef = useRef(persistTitle);
  persistTitleRef.current = persistTitle;

  const titleScheduler = useMemo(
    () =>
      createAutoPersistScheduler({
        ...AUTO_PERSIST_SHORT,
        onFire: () => void persistTitleRef.current(),
      }),
    [],
  );

  useEffect(() => () => titleScheduler.cancel(), [titleScheduler]);

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      titleScheduler.cancel();
      return () => {};
    }
    let cancelled = false;
    setDetailLoading(true);
    titleScheduler.cancel();
    void getNote(subjectId, selectedId)
      .then((row) => {
        if (cancelled) return;
        setDetail(row);
        setTitleDraft(row.title);
        titleSavedRef.current = row.title;
        setTitleStatus("idle");
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId, selectedId, titleScheduler]);

  const selectNote = useCallback(
    (id: number, after?: () => void) => {
      titleScheduler.cancel();
      void persistTitle().finally(() => {
        setSelectedId(id);
        after?.();
      });
    },
    [persistTitle, setSelectedId, titleScheduler],
  );

  const onCreate = async () => {
    try {
      titleScheduler.cancel();
      await persistTitle();
      const item = await createNote(subjectId, {
        title: "未命名笔记",
        content: "",
      });
      setSelectedId(item.id);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const persistTags = async (tagIds: number[]) => {
    if (!detail) return;
    titleScheduler.cancel();
    await persistTitle();
    const item = await updateNote(subjectId, detail.id, { tag_ids: tagIds });
    setDetail(item);
    await loadList();
  };

  const detailTitle = detail?.title || (selectedId != null ? "笔记" : "笔记本");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-end gap-2 border-b px-3 py-2"></div>
      {error ? (
        <div className="px-3 pt-2">
          <StatusAlert variant="error">{error}</StatusAlert>
        </div>
      ) : null}
      <ListDetailLayout
        className="min-h-0 flex-1"
        detailTitle={detailTitle}
        listTitle="笔记本"
        listSubtitle={loading ? "加载中…" : `共 ${items.length} 条`}
        columnSplitKey="note"
        defaultListWidthPx={280}
        detailActions={
          detail ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void toggleShellQuick(detail.id).catch(() => {
                    /* ignore */
                  });
                }}
              >
                {quickIds.has(detail.id) ? "移出快捷" : "加入快捷"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void (async () => {
                    await deleteNote(subjectId, detail.id);
                    setSelectedId(null);
                    await loadList();
                  })();
                }}
              >
                删除
              </Button>
            </div>
          ) : null
        }
        list={(ctx) => (
          <div className="flex h-full min-h-0 flex-col gap-3 p-3">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={searchQuery}
                  placeholder="搜索正文…"
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button type="button" onClick={() => void onCreate()}>
                <Plus className="size-4" />
              </Button>
            </div>
            <PullToRefresh onRefresh={() => loadList()}>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              ) : items.length === 0 ? (
                <EmptyState message="暂无笔记。按主题记录；与日记按日区分。" />
              ) : (
                <ul className="flex flex-col gap-1">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted ${
                          selectedId === item.id ? "bg-muted" : ""
                        }`}
                        onClick={() => {
                          selectNote(item.id, () => ctx.close());
                        }}
                      >
                        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {item.title || "未命名"}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {new Date(item.updated_at).toLocaleString("zh-CN")}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PullToRefresh>
            {ctx.isDrawer ? (
              <Button type="button" variant="ghost" size="sm" onClick={ctx.close}>
                关闭列表
              </Button>
            ) : null}
          </div>
        )}
      >
        {selectedId == null ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
            选择或新建一条笔记
          </div>
        ) : detailLoading || !detail ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="min-w-0 flex-1 text-lg font-semibold"
                value={titleDraft}
                onChange={(e) => {
                  const value = e.target.value;
                  setTitleDraft(value);
                  if (value.trim() !== titleSavedRef.current) {
                    setTitleStatus("pending");
                    titleScheduler.schedule();
                  } else {
                    titleScheduler.cancel();
                    setTitleStatus("idle");
                  }
                }}
                onBlur={() => {
                  titleScheduler.cancel();
                  void persistTitle();
                }}
              />
              {titleStatus !== "idle" ? (
                <span
                  className={`shrink-0 text-xs ${
                    titleStatus === "error" ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {persistStatusLabel(titleStatus)}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TagChips
                tagIds={detail.tag_ids}
                titleById={titleById}
                onRemove={(id) => {
                  void persistTags(detail.tag_ids.filter((t) => t !== id));
                }}
              />
              <TagPicker
                primaryComponent={NOTE_COMPONENT}
                tagIds={detail.tag_ids}
                onChange={(ids) => void persistTags(ids)}
                mode="append"
                triggerOnly
                triggerLabel="添加标签"
              />
            </div>
            <div className="flex flex-col gap-3">
              {detail.blocks.map((block) => (
                <MarkdownBlockEditor
                  key={block.id}
                  block={block}
                  onSave={async (content) => {
                    const updated = await updateNoteBlock(subjectId, block.id, { content });
                    setDetail({
                      ...detail,
                      blocks: detail.blocks.map((b) => (b.id === updated.id ? updated : b)),
                    });
                  }}
                  onDelete={async () => {
                    await deleteNoteBlock(subjectId, block.id);
                    setDetail({
                      ...detail,
                      blocks: detail.blocks.filter((b) => b.id !== block.id),
                    });
                  }}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void (async () => {
                  const block = await createNoteBlock(subjectId, detail.id, "");
                  setDetail({ ...detail, blocks: [...detail.blocks, block] });
                })();
              }}
            >
              <Plus className="size-4" /> 添加段落
            </Button>
          </div>
        )}
      </ListDetailLayout>
    </div>
  );
}
