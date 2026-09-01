import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUserSubjectId, useShellQuickIdSet } from "@freeanima/client/portal-sdk/react.tsx";
import { toggleShellQuick } from "@freeanima/client/portal-sdk/shell-quick.ts";
import { useIdMappingRemap } from "@freeanima/client/portal-sdk/use-id-mapping-remap";
import { usePortalInfiniteQuery } from "@freeanima/client/portal-sdk/portal-query";
import { useModuleOutboxSummary } from "@freeanima/client/portal-sdk/use-outbox-summary";
import { registerDiaryOfflineModule } from "./lib/offline-store.ts";
import {
  createDiaryBlock,
  createDiaryEntry,
  deleteDiaryBlock,
  fetchDiaryBlockTemplates,
  fetchDiaryEntries,
  getDiaryEntry,
  reorderDiaryBlocks,
  searchDiaryEntries,
  updateDiaryBlock,
  updateDiaryEntry,
  type DiaryBlockTemplateRow,
} from "./lib/api.ts";
import { mergeDraftAfterSave } from "@freeanima/ui-kit/lib/merge-draft-after-save.ts";
import {
  AUTO_PERSIST_LONG,
  createAutoPersistScheduler,
} from "@freeanima/ui-kit/lib/auto-persist-schedule.ts";
import { Button, Input, Spinner } from "@freeanima/ui-kit";
import { PullToRefresh } from "@freeanima/ui-kit/composite";
import { ListDetailLayout } from "@freeanima/ui-kit/layout";
import { randomPublicId } from "@freeanima/shared/util";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@freeanima/ui-kit/components/ui/dropdown-menu.tsx";
import { PlusIcon } from "lucide-react";

import { DiaryBlockTemplateDialog } from "./components/DiaryBlockTemplateDialog.tsx";
import { EntryEditor, type EntrySaveStatus } from "./components/EntryEditor.tsx";
import { EntryDetailTagChips, EntryTagAddMenu } from "./components/EntryTagHeader.tsx";
import { EntryTimeline, findEntryByDayLocal } from "./components/EntryTimeline.tsx";
import {
  entryDraftFromRow,
  isEntryDraftDirty,
  isEntryDraftEqual,
  isEntryMetaDirty,
  type BlockDraft,
  type EntryDraft,
} from "./lib/entry-draft-dirty.ts";
import type { DiaryEntryRow } from "./lib/format-diary.ts";
import {
  dateLocalToEntryAtIso,
  defaultEntryDateLocal,
  formatEntryDate,
  titleFromDateLocal,
} from "./lib/format-diary.ts";
import { sortOrderUpdates } from "./lib/reorder.ts";
import { subscribeShellConfigChanges } from "@freeanima/shared/rpc-contract/bundled-rpc-stream-browser.ts";

function sortEntries(items: DiaryEntryRow[]): DiaryEntryRow[] {
  return items.toSorted((a, b) => b.entry_at.localeCompare(a.entry_at));
}

const DIARY_PAGE_SIZE = 20;

function readUrlDiaryId(): number | null {
  const raw = new URLSearchParams(window.location.search).get("id");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function writeUrlDiaryId(id: number | null): void {
  const url = new URL(window.location.href);
  if (id == null) url.searchParams.delete("id");
  else url.searchParams.set("id", String(id));
  if (url.href !== window.location.href) {
    window.history.replaceState(null, "", url);
  }
}

function applyEntryToList(prev: DiaryEntryRow[], item: DiaryEntryRow): DiaryEntryRow[] {
  const next = prev.filter((e) => e.id !== item.id);
  next.push(item);
  return sortEntries(next);
}

export function DiaryApp() {
  const subjectId = useUserSubjectId();
  const quickIds = useShellQuickIdSet();
  const { pending: pendingOps } = useModuleOutboxSummary("diary");
  const writesDisabled = false;
  const [selectedId, setSelectedIdState] = useState<number | null>(() => readUrlDiaryId());
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [draftBaseline, setDraftBaseline] = useState<EntryDraft | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<EntrySaveStatus>("idle");
  const [error, setError] = useState("");
  const [templates, setTemplates] = useState<DiaryBlockTemplateRow[]>([]);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIdRef = useRef<number | null>(null);
  const initialTodayOpenedRef = useRef(false);
  const urlOpenAttemptedRef = useRef(false);

  const setSelectedId = useCallback(
    (next: number | null | ((prev: number | null) => number | null)) => {
      setSelectedIdState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        writeUrlDiaryId(resolved);
        return resolved;
      });
    },
    [],
  );

  selectedIdRef.current = selectedId;

  useEffect(() => {
    const onPop = () => setSelectedIdState(readUrlDiaryId());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const searchTrimmed = searchQuery.trim();
  const diaryListQuery = usePortalInfiniteQuery<DiaryEntryRow[]>({
    queryKey: searchTrimmed
      ? ["diary", "search", subjectId, searchTrimmed]
      : ["diary", "list", subjectId],
    queryFn: async ({ pageParam }) => {
      const offset = typeof pageParam === "number" ? pageParam : 0;
      if (searchTrimmed) {
        return searchDiaryEntries(subjectId, searchTrimmed);
      }
      return fetchDiaryEntries(subjectId, { limit: DIARY_PAGE_SIZE, offset });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      if (searchTrimmed) return undefined;
      if (lastPage.length < DIARY_PAGE_SIZE) return undefined;
      return pages.reduce((n, p) => n + p.length, 0);
    },
  });

  const entries = useMemo(() => {
    const pages = diaryListQuery.data?.pages ?? [];
    const flat = pages.flat();
    return searchTrimmed ? flat : sortEntries(flat);
  }, [diaryListQuery.data?.pages, searchTrimmed]);

  const loading = diaryListQuery.loading;
  const loadingMore = diaryListQuery.loadingMore;
  const hasMore = diaryListQuery.hasNextPage;

  const setDataInfinite = diaryListQuery.setData;
  const setEntries = useCallback(
    (updater: DiaryEntryRow[] | ((prev: DiaryEntryRow[]) => DiaryEntryRow[])) => {
      setDataInfinite((prev) => {
        const flat = prev?.pages.flat() ?? [];
        const next = typeof updater === "function" ? updater(flat) : updater;
        return {
          pages: [searchTrimmed ? next : sortEntries(next)],
          pageParams: [0],
        };
      });
    },
    [searchTrimmed, setDataInfinite],
  );

  useEffect(() => {
    if (diaryListQuery.error) {
      setError(diaryListQuery.error.message);
    }
  }, [diaryListQuery.error]);

  useEffect(() => {
    const currentSelectedId = selectedIdRef.current;
    if (currentSelectedId != null && !entries.some((e) => e.id === currentSelectedId)) {
      setSelectedId(null);
      setDraft(null);
      setDraftBaseline(null);
    }
  }, [entries]);

  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? null,
    [entries, selectedId],
  );

  const markSaved = useCallback(() => {
    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    setSaveStatus("saved");
    saveStatusTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
  }, []);

  const reloadDiary = diaryListQuery.reload;
  const fetchNextDiaryPage = diaryListQuery.fetchNextPage;

  const reload = useCallback(async () => {
    setError("");
    await reloadDiary();
  }, [reloadDiary]);

  const loadMore = useCallback(async () => {
    if (searchTrimmed || !hasMore) return;
    setError("");
    try {
      await fetchNextDiaryPage();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [fetchNextDiaryPage, hasMore, searchTrimmed]);

  const handleManualRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, reload]);

  useEffect(() => {
    registerDiaryOfflineModule();
  }, []);

  useIdMappingRemap("diary", (event) => {
    const { tempId, serverId } = event;
    setEntries((prev) => {
      let changed = false;
      const next = prev.map((e) => {
        if (e.id === tempId) {
          changed = true;
          return {
            ...e,
            id: serverId,
            blocks: e.blocks.map((b) => ({ ...b, parent_id: serverId })),
          };
        }
        const blocks = e.blocks.map((b) => (b.id === tempId ? { ...b, id: serverId } : b));
        if (blocks.some((b, i) => b.id !== e.blocks[i]?.id)) {
          changed = true;
          return { ...e, blocks };
        }
        return e;
      });
      return changed ? sortEntries(next) : prev;
    });
    setSelectedId((prev) => (prev === tempId ? serverId : prev));
    setDraft((prev) => {
      if (!prev) return prev;
      if (!prev.blocks.some((b) => b.id === tempId)) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === tempId ? { ...b, id: serverId } : b)),
      };
    });
    setDraftBaseline((prev) => {
      if (!prev) return prev;
      if (!prev.blocks.some((b) => b.id === tempId)) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === tempId ? { ...b, id: serverId } : b)),
      };
    });
  });

  useEffect(() => subscribeShellConfigChanges(), []);

  useEffect(() => {
    let cancelled = false;
    void fetchDiaryBlockTemplates(subjectId)
      .then((items) => {
        if (!cancelled) setTemplates(items);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  useEffect(() => {
    setSelectedId(null);
    setDraft(null);
    setDraftBaseline(null);
    initialTodayOpenedRef.current = false;
    urlOpenAttemptedRef.current = false;
  }, [subjectId, setSelectedId]);

  useEffect(() => {
    return () => {
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    };
  }, []);

  const openEntry = useCallback((entry: DiaryEntryRow) => {
    const nextDraft = entryDraftFromRow(entry);
    setSelectedId(entry.id);
    setDraft(nextDraft);
    setDraftBaseline(nextDraft);
    setSaveStatus("idle");
  }, []);

  /** 列表项仅元数据；打开编辑前按 id 拉完整 blocks */
  const openEntryById = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const full = await getDiaryEntry(subjectId, id);
        setEntries((prev) =>
          applyEntryToList(prev, {
            ...full,
            blocks: [],
          }),
        );
        openEntry(full);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      }
    },
    [openEntry, subjectId],
  );

  const persistDraft = useCallback(async (): Promise<boolean> => {
    if (!selectedEntry || !draft || !draftBaseline || writesDisabled) return true;
    if (!isEntryDraftDirty(draft, draftBaseline)) return true;
    if (saving) return false;
    const savingSnapshot = draft;
    setSaving(true);
    setSaveStatus("saving");
    try {
      let entry = selectedEntry;

      if (isEntryMetaDirty(savingSnapshot, draftBaseline)) {
        entry = await updateDiaryEntry(subjectId, selectedEntry.id, {
          title: titleFromDateLocal(savingSnapshot.entryDateLocal),
          summary: "",
          entry_at: dateLocalToEntryAtIso(savingSnapshot.entryDateLocal),
          tag_ids: savingSnapshot.tag_ids,
        });
      }

      const baselineById = new Map(draftBaseline.blocks.map((b) => [b.id, b]));
      const draftIds = new Set(savingSnapshot.blocks.map((b) => b.id));

      for (const base of draftBaseline.blocks) {
        if (!draftIds.has(base.id)) {
          await deleteDiaryBlock(subjectId, entry.id, base.id);
        }
      }

      const nextBlocks: BlockDraft[] = [];
      for (const block of savingSnapshot.blocks) {
        const base = baselineById.get(block.id);
        if (!base) {
          const created = await createDiaryBlock(subjectId, entry.id, {
            content: block.content,
            title: block.title,
            tag_ids: block.tag_ids,
            components: block.components,
            sort_order: block.sort_order,
            ...(block.client_op_id ? { client_op_id: block.client_op_id } : {}),
          });
          nextBlocks.push({
            id: created.id,
            title: created.title ?? block.title,
            content: created.content,
            sort_order: created.sort_order,
            client_op_id: created.client_op_id ?? block.client_op_id,
            components: created.components ?? block.components,
            tag_ids: created.tag_ids ?? block.tag_ids,
          });
          continue;
        }
        const titleChanged = base.title !== block.title;
        const contentChanged = base.content !== block.content;
        const tagsChanged =
          [...base.tag_ids].toSorted((a, b) => a - b).join(",") !==
          [...block.tag_ids].toSorted((a, b) => a - b).join(",");
        if (titleChanged || contentChanged || tagsChanged) {
          const updated = await updateDiaryBlock(subjectId, block.id, {
            content: block.content,
            title: block.title,
            tag_ids: block.tag_ids,
          });
          nextBlocks.push({
            id: updated.id,
            title: updated.title ?? block.title,
            content: updated.content,
            sort_order: block.sort_order,
            client_op_id: updated.client_op_id,
            components: updated.components ?? block.components,
            tag_ids: updated.tag_ids ?? block.tag_ids,
          });
        } else {
          nextBlocks.push(block);
        }
      }

      const ordered = nextBlocks.map((b, index) => ({ ...b, sort_order: index }));
      const reorderPatch = sortOrderUpdates(ordered);
      if (reorderPatch.length > 0) {
        await reorderDiaryBlocks(subjectId, entry.id, reorderPatch);
      }

      entry = {
        ...entry,
        blocks: ordered.map((b) => ({
          id: b.id,
          title: b.title,
          content: b.content,
          sort_order: b.sort_order,
          parent_id: entry.id,
          client_op_id: b.client_op_id,
          components: b.components ?? [],
          tag_ids: b.tag_ids ?? [],
          created_at: selectedEntry.created_at,
          updated_at: new Date().toISOString(),
        })),
      };

      setEntries((prev) =>
        applyEntryToList(prev, {
          ...entry,
          blocks: [],
        }),
      );
      if (selectedIdRef.current === selectedEntry.id && selectedEntry.id !== entry.id) {
        setSelectedId(entry.id);
      }
      const synced = entryDraftFromRow(entry);
      setDraftBaseline(synced);
      setDraft((current) => {
        if (!current) return synced;
        return mergeDraftAfterSave({
          current,
          savingSnapshot,
          synced,
          isEqual: isEntryDraftEqual,
        }).draft;
      });
      markSaved();
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already exists")) {
        setError("该日期已有其他日记，请选择别的日期");
      } else {
        setError(msg);
      }
      setSaveStatus("error");
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft, draftBaseline, markSaved, saving, selectedEntry, subjectId, writesDisabled]);

  const openTodayEntry = useCallback(async (): Promise<boolean> => {
    const today = defaultEntryDateLocal();
    const todayEntry = findEntryByDayLocal(entries, today);
    if (todayEntry) {
      if (selectedIdRef.current !== todayEntry.id) {
        return openEntryById(todayEntry.id);
      }
      return true;
    }
    if (writesDisabled || creating) return false;
    setCreating(true);
    setError("");
    try {
      const item = await createDiaryEntry(subjectId, {
        title: titleFromDateLocal(today),
        summary: "",
        entry_at: dateLocalToEntryAtIso(today),
        tag_ids: [],
      });
      setEntries((prev) =>
        sortEntries([
          {
            ...item,
            blocks: [],
          },
          ...prev,
        ]),
      );
      openEntry(item);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already exists")) {
        const existing = findEntryByDayLocal(entries, today);
        if (existing) {
          return openEntryById(existing.id);
        }
      } else {
        setError(msg);
      }
      return false;
    } finally {
      setCreating(false);
    }
  }, [creating, entries, openEntry, openEntryById, subjectId, writesDisabled]);

  useEffect(() => {
    if (loading) return;
    if (searchQuery.trim()) return;
    if (selectedId != null) {
      initialTodayOpenedRef.current = true;
      if (!urlOpenAttemptedRef.current && draft == null) {
        urlOpenAttemptedRef.current = true;
        void openEntryById(selectedId);
      }
      return;
    }
    if (initialTodayOpenedRef.current) return;

    const todayEntry = findEntryByDayLocal(entries, defaultEntryDateLocal());
    if (todayEntry) {
      initialTodayOpenedRef.current = true;
      void openEntryById(todayEntry.id);
      return;
    }

    if (creating) return;

    void (async () => {
      const opened = await openTodayEntry();
      if (opened) {
        initialTodayOpenedRef.current = true;
        return;
      }
      if (!writesDisabled && !creating) {
        initialTodayOpenedRef.current = true;
      }
    })();
  }, [
    creating,
    draft,
    entries,
    loading,
    openEntryById,
    openTodayEntry,
    searchQuery,
    selectedId,
    writesDisabled,
  ]);

  const flushDraftSave = useCallback(async (): Promise<boolean> => {
    return persistDraft();
  }, [persistDraft]);

  const persistDraftRef = useRef(persistDraft);
  persistDraftRef.current = persistDraft;

  const draftPersistScheduler = useMemo(
    () =>
      createAutoPersistScheduler({
        ...AUTO_PERSIST_LONG,
        onFire: () => void persistDraftRef.current(),
      }),
    [],
  );

  useEffect(() => () => draftPersistScheduler.cancel(), [draftPersistScheduler]);

  const flushDraftSaveAndCancel = useCallback(async (): Promise<boolean> => {
    draftPersistScheduler.cancel();
    return flushDraftSave();
  }, [draftPersistScheduler, flushDraftSave]);

  const selectEntryById = useCallback(
    (id: number) => {
      void (async () => {
        await flushDraftSaveAndCancel();
        await openEntryById(id);
      })();
    },
    [flushDraftSaveAndCancel, openEntryById],
  );

  const handleNewEntry = useCallback(() => {
    void (async () => {
      if (writesDisabled || creating) return;
      await flushDraftSaveAndCancel();
      await openTodayEntry();
    })();
  }, [creating, flushDraftSaveAndCancel, openTodayEntry, writesDisabled]);

  const handleAddBlock = useCallback(
    (preset?: DiaryBlockTemplateRow["preset"]) => {
      if (!draft) return;
      const nextOrder = draft.blocks.length;
      setDraft({
        ...draft,
        blocks: [
          ...draft.blocks,
          {
            id: -Date.now(),
            title: preset?.title ?? "",
            content: preset?.content ?? "",
            sort_order: nextOrder,
            client_op_id: randomPublicId(),
            components: preset?.components ?? ["content_block"],
            tag_ids: preset?.tag_ids ?? [],
          },
        ],
      });
    },
    [draft],
  );

  useEffect(() => {
    if (!selectedEntry || !draft || !draftBaseline || writesDisabled) {
      draftPersistScheduler.cancel();
      return;
    }
    if (!isEntryDraftDirty(draft, draftBaseline)) {
      draftPersistScheduler.cancel();
      return;
    }
    if (saving) return;
    draftPersistScheduler.schedule();
  }, [draft, draftBaseline, draftPersistScheduler, saving, selectedEntry, writesDisabled]);

  const listPane = (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            isDisabled={refreshing || loading}
            aria-label={"刷新"}
            onClick={() => void handleManualRefresh()}
          >
            {refreshing ? <Spinner className="size-3.5" /> : "刷新"}
          </Button>
          <Button
            type="button"
            size="sm"
            isDisabled={writesDisabled || creating}
            onClick={handleNewEntry}
          >
            {creating ? "新建中…" : "新建"}
          </Button>
        </div>
      </div>
      <Input
        type="search"
        className="h-8 w-full"
        placeholder="搜索日记…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      {pendingOps > 0 ? (
        <p className="text-muted-foreground text-xs">{pendingOps} 项待同步</p>
      ) : null}
      {loading ? <Spinner className="size-4" /> : null}
      <PullToRefresh
        className="min-h-0 flex-1"
        disabled={refreshing || loading}
        onRefresh={handleManualRefresh}
      >
        <EntryTimeline
          items={entries}
          selectedId={selectedId}
          onSelect={selectEntryById}
          hasMore={!searchQuery.trim() && hasMore}
          loadingMore={loadingMore}
          onLoadMore={() => void loadMore()}
        />
      </PullToRefresh>
    </div>
  );

  const detailPane =
    selectedEntry && draft && draftBaseline ? (
      <EntryEditor draft={draft} onDraftChange={setDraft} readOnly={writesDisabled} />
    ) : (
      <div className="text-muted-foreground flex h-full min-h-0 items-center justify-center text-sm">
        选择条目或新建日记
      </div>
    );

  const detailTitle = selectedEntry ? formatEntryDate(selectedEntry.entry_at) : "日记";

  const detailHeaderExtra =
    selectedEntry && draft ? (
      <EntryDetailTagChips
        tagIds={draft.tag_ids}
        onTagIdsChange={(tag_ids) => setDraft({ ...draft, tag_ids })}
        readOnly={writesDisabled}
      />
    ) : null;

  const detailActions =
    selectedEntry && draft && !writesDisabled ? (
      <div className="flex items-center gap-2">
        {saveStatus === "saving" ? (
          <span className="text-muted-foreground text-xs">保存中…</span>
        ) : saveStatus === "saved" ? (
          <span className="text-muted-foreground text-xs">已保存</span>
        ) : saveStatus === "error" ? (
          <span className="text-destructive text-xs">保存失败</span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            void toggleShellQuick(selectedEntry.id).catch(() => {
              /* ignore */
            });
          }}
        >
          {quickIds.has(selectedEntry.id) ? "移出快捷" : "加入快捷"}
        </Button>
        <EntryTagAddMenu
          subjectId={subjectId}
          tagIds={draft.tag_ids}
          onTagIdsChange={(tag_ids) => setDraft({ ...draft, tag_ids })}
        />
        <DropdownMenuTrigger>
          <Button type="button" variant="ghost" size="sm">
            <PlusIcon className="size-3.5" />
            添加块
          </Button>
          <DropdownMenu placement="bottom end" className="w-48">
            <DropdownMenuItem onAction={() => handleAddBlock()}>空白块</DropdownMenuItem>
            {templates.length > 0 ? <DropdownMenuSeparator /> : null}
            {templates.map((tpl) => (
              <DropdownMenuItem
                key={tpl.id}
                id={String(tpl.id)}
                onAction={() => handleAddBlock(tpl.preset)}
              >
                {tpl.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onAction={() => setTemplateDialogOpen(true)}>
              管理日记块模板…
            </DropdownMenuItem>
          </DropdownMenu>
        </DropdownMenuTrigger>
      </div>
    ) : null;

  return (
    <>
      <ListDetailLayout
        detailTitle={detailTitle}
        detailHeaderExtra={detailHeaderExtra}
        detailActions={detailActions}
        listTitle="日记"
        columnSplitKey="diary"
        defaultListWidthPx={320}
        list={(ctx) => (
          <div className="flex h-full min-h-0 flex-col gap-3 p-3">
            {listPane}
            {ctx.isDrawer ? (
              <Button type="button" variant="ghost" size="sm" onClick={ctx.close}>
                关闭列表
              </Button>
            ) : null}
          </div>
        )}
      >
        <div className="flex h-full min-h-0 flex-col p-4">{detailPane}</div>
      </ListDetailLayout>
      <DiaryBlockTemplateDialog
        open={templateDialogOpen}
        subjectId={subjectId}
        onClose={() => setTemplateDialogOpen(false)}
        onChanged={setTemplates}
      />
    </>
  );
}
