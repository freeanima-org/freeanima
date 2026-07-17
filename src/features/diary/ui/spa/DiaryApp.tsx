import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSubjectScope, SubjectScopeToggle } from "@freeanima/frontend/shell-sdk/react.tsx";
import { subscribeIdMappings } from "@freeanima/frontend/shell-sdk/offline-id-map";
import { registerDiaryOfflineModule } from "./lib/offline-store.ts";
import {
  countDiaryPendingOps,
  createDiaryBlock,
  createDiaryEntry,
  deleteDiaryBlock,
  fetchDiaryEntries,
  reorderDiaryBlocks,
  searchDiaryEntries,
  updateDiaryBlock,
  updateDiaryEntry,
} from "./lib/api.ts";
import { mergeDraftAfterSave } from "@freeanima/frontend/ui-kit/lib/merge-draft-after-save.ts";
import { Button, Input, Spinner } from "@freeanima/frontend/ui-kit";
import { PullToRefresh } from "@freeanima/frontend/ui-kit/composite";
import { ListDetailLayout } from "@freeanima/frontend/ui-kit/layout";
import { PlusIcon } from "lucide-react";
import { m } from "@paraglide/messages";

import { EntryEditor, type EntrySaveStatus } from "./components/EntryEditor.tsx";
import { EntryTimeline, findEntryByDayLocal } from "./components/EntryTimeline.tsx";
import {
  entryDraftFromRow,
  isEntryDraftDirty,
  isEntryDraftEqual,
  isEntryMetaDirty,
  parseTagsText,
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
import { subscribeShellConfigChanges } from "@freeanima/shared/sap-contract";

function sortEntries(items: DiaryEntryRow[]): DiaryEntryRow[] {
  return items.toSorted((a, b) => b.entry_at.localeCompare(a.entry_at));
}

function applyEntryToList(prev: DiaryEntryRow[], item: DiaryEntryRow): DiaryEntryRow[] {
  const next = prev.filter((e) => e.id !== item.id);
  next.push(item);
  return sortEntries(next);
}

export function DiaryApp() {
  const { kind: subjectKind } = useSubjectScope();
  const [pendingOps, setPendingOps] = useState(0);
  const writesDisabled = false;
  const [entries, setEntries] = useState<DiaryEntryRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [draftBaseline, setDraftBaseline] = useState<EntryDraft | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<EntrySaveStatus>("idle");
  const [error, setError] = useState("");
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIdRef = useRef<number | null>(null);
  const initialTodayOpenedRef = useRef(false);

  selectedIdRef.current = selectedId;

  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? null,
    [entries, selectedId],
  );

  const markSaved = useCallback(() => {
    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    setSaveStatus("saved");
    saveStatusTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = searchQuery.trim();
      const items = query
        ? await searchDiaryEntries(subjectKind, query)
        : await fetchDiaryEntries(subjectKind);
      setEntries(items);
      const currentSelectedId = selectedIdRef.current;
      if (currentSelectedId != null && !items.some((e) => e.id === currentSelectedId)) {
        setSelectedId(null);
        setDraft(null);
        setDraftBaseline(null);
      } else if (currentSelectedId != null) {
        const fresh = items.find((e) => e.id === currentSelectedId);
        if (fresh) {
          const nextDraft = entryDraftFromRow(fresh);
          setDraftBaseline(nextDraft);
          setDraft((current) => {
            if (!current || !isEntryDraftDirty(current, nextDraft)) return nextDraft;
            return current;
          });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, subjectKind]);

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

  useEffect(() => {
    return subscribeIdMappings((event) => {
      if (event.moduleId !== "diary") return;
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
  }, []);

  useEffect(() => {
    void countDiaryPendingOps().then(setPendingOps);
    const timer = window.setInterval(() => {
      void countDiaryPendingOps().then(setPendingOps);
    }, 3000);
    return () => clearInterval(timer);
  }, [entries, saving, creating]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => subscribeShellConfigChanges(), []);

  useEffect(() => {
    setSelectedId(null);
    setDraft(null);
    setDraftBaseline(null);
    initialTodayOpenedRef.current = false;
  }, [subjectKind]);

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
        entry = await updateDiaryEntry(subjectKind, selectedEntry.id, {
          title: titleFromDateLocal(savingSnapshot.entryDateLocal),
          summary: "",
          entry_at: dateLocalToEntryAtIso(savingSnapshot.entryDateLocal),
          tags: parseTagsText(savingSnapshot.tagsText),
        });
      }

      const baselineById = new Map(draftBaseline.blocks.map((b) => [b.id, b]));
      const draftIds = new Set(savingSnapshot.blocks.map((b) => b.id));

      for (const base of draftBaseline.blocks) {
        if (!draftIds.has(base.id)) {
          await deleteDiaryBlock(subjectKind, entry.id, base.id);
        }
      }

      const nextBlocks: BlockDraft[] = [];
      for (const block of savingSnapshot.blocks) {
        const base = baselineById.get(block.id);
        if (!base) {
          const created = await createDiaryBlock(
            subjectKind,
            entry.id,
            block.content,
            block.sort_order,
          );
          nextBlocks.push({
            id: created.id,
            content: created.content,
            sort_order: created.sort_order,
            client_op_id: created.client_op_id,
            components: created.components ?? [],
          });
          continue;
        }
        if (base.content !== block.content) {
          const updated = await updateDiaryBlock(subjectKind, block.id, {
            content: block.content,
          });
          nextBlocks.push({
            id: updated.id,
            content: updated.content,
            sort_order: block.sort_order,
            client_op_id: updated.client_op_id,
            components: updated.components ?? block.components,
          });
        } else {
          nextBlocks.push(block);
        }
      }

      const ordered = nextBlocks.map((b, index) => ({ ...b, sort_order: index }));
      const reorderPatch = sortOrderUpdates(ordered);
      if (reorderPatch.length > 0) {
        await reorderDiaryBlocks(subjectKind, entry.id, reorderPatch);
      }

      entry = {
        ...entry,
        blocks: ordered.map((b) => ({
          id: b.id,
          content: b.content,
          sort_order: b.sort_order,
          parent_id: entry.id,
          client_op_id: b.client_op_id,
          components: b.components ?? [],
          created_at: selectedEntry.created_at,
          updated_at: new Date().toISOString(),
        })),
      };

      setEntries((prev) => applyEntryToList(prev, entry));
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
  }, [draft, draftBaseline, markSaved, saving, selectedEntry, subjectKind, writesDisabled]);

  const openTodayEntry = useCallback(async (): Promise<boolean> => {
    const today = defaultEntryDateLocal();
    const todayEntry = findEntryByDayLocal(entries, today);
    if (todayEntry) {
      if (selectedIdRef.current !== todayEntry.id) {
        openEntry(todayEntry);
      }
      return true;
    }
    if (writesDisabled || creating) return false;
    setCreating(true);
    setError("");
    try {
      const item = await createDiaryEntry(subjectKind, {
        title: titleFromDateLocal(today),
        summary: "",
        entry_at: dateLocalToEntryAtIso(today),
        tags: [],
      });
      setEntries((prev) => sortEntries([item, ...prev]));
      openEntry(item);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already exists")) {
        const existing = findEntryByDayLocal(entries, today);
        if (existing) {
          openEntry(existing);
          return true;
        }
      } else {
        setError(msg);
      }
      return false;
    } finally {
      setCreating(false);
    }
  }, [creating, entries, openEntry, subjectKind, writesDisabled]);

  useEffect(() => {
    if (loading) return;
    if (searchQuery.trim()) return;
    if (selectedId != null) {
      initialTodayOpenedRef.current = true;
      return;
    }
    if (initialTodayOpenedRef.current) return;

    const todayEntry = findEntryByDayLocal(entries, defaultEntryDateLocal());
    if (todayEntry) {
      openEntry(todayEntry);
      initialTodayOpenedRef.current = true;
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
    entries,
    loading,
    openEntry,
    openTodayEntry,
    searchQuery,
    selectedId,
    writesDisabled,
  ]);

  const flushDraftSave = useCallback(async (): Promise<boolean> => {
    return persistDraft();
  }, [persistDraft]);

  const selectEntryById = useCallback(
    (id: number) => {
      void (async () => {
        await flushDraftSave();
        const entry = entries.find((e) => e.id === id);
        if (entry) openEntry(entry);
      })();
    },
    [entries, flushDraftSave, openEntry],
  );

  const handleNewEntry = useCallback(() => {
    void (async () => {
      if (writesDisabled || creating) return;
      await flushDraftSave();
      await openTodayEntry();
    })();
  }, [creating, flushDraftSave, openTodayEntry, writesDisabled]);

  const handleAddBlock = useCallback(() => {
    if (!draft) return;
    const nextOrder = draft.blocks.length;
    setDraft({
      ...draft,
      blocks: [
        ...draft.blocks,
        {
          id: -Date.now(),
          content: "",
          sort_order: nextOrder,
          client_op_id: null,
          components: [],
        },
      ],
    });
  }, [draft]);

  useEffect(() => {
    if (!selectedEntry || !draft || !draftBaseline || writesDisabled) return;
    if (!isEntryDraftDirty(draft, draftBaseline)) return;
    if (saving) return;
    const timer = setTimeout(() => {
      void persistDraft();
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, draftBaseline, persistDraft, saving, selectedEntry, writesDisabled]);

  const listPane = (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubjectScopeToggle />
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            disabled={refreshing || loading}
            aria-label={m.console_common_refresh()}
            onClick={() => void handleManualRefresh()}
          >
            {refreshing ? <Spinner className="size-3.5" /> : m.console_common_refresh()}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={writesDisabled || creating}
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
        <EntryTimeline items={entries} selectedId={selectedId} onSelect={selectEntryById} />
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
        <Button type="button" variant="ghost" size="sm" onClick={handleAddBlock}>
          <PlusIcon className="size-3.5" />
          添加块
        </Button>
      </div>
    ) : null;

  return (
    <ListDetailLayout
      detailTitle={detailTitle}
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
  );
}
