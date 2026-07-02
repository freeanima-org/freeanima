import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHubConnection, useNetworkOnline, useSubjectScope } from "@freeanima/shell-sdk/react";
import { Button, Input, Spinner } from "@freeanima/ui-kit";
import { ListDetailLayout } from "@freeanima/ui-kit/layout";

import { EntryEditor, type EntrySaveStatus } from "./components/EntryEditor.tsx";
import { EntryTimeline, findEntryByDayLocal } from "./components/EntryTimeline.tsx";
import {
  createDiaryEntry,
  deleteDiaryEntry,
  fetchDiaryEntries,
  searchDiaryEntries,
  updateDiaryEntry,
} from "./lib/api.ts";
import {
  entryDraftFromRow,
  isEntryDraftDirty,
  parseTagsText,
  type EntryDraft,
} from "./lib/entry-draft-dirty.ts";
import type { DiaryEntryRow } from "./lib/format-diary.ts";
import {
  dateLocalToEntryAtIso,
  defaultEntryDateLocal,
  formatEntryDate,
  titleFromDateLocal,
} from "./lib/format-diary.ts";
import { subscribeShellConfigChanges } from "./lib/sap-client.ts";

function sortEntries(items: DiaryEntryRow[]): DiaryEntryRow[] {
  return items.toSorted((a, b) => b.entry_at.localeCompare(a.entry_at));
}

export function DiaryApp() {
  const { kind: subjectKind } = useSubjectScope();
  const networkOnline = useNetworkOnline();
  const hubConnection = useHubConnection();
  const writesDisabled = !networkOnline || hubConnection !== "connected";
  const [entries, setEntries] = useState<DiaryEntryRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [draftBaseline, setDraftBaseline] = useState<EntryDraft | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<EntrySaveStatus>("idle");
  const [error, setError] = useState("");
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (selectedId != null && !items.some((e) => e.id === selectedId)) {
        setSelectedId(null);
        setDraft(null);
        setDraftBaseline(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedId, subjectKind]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => subscribeShellConfigChanges(), []);

  useEffect(() => {
    setSelectedId(null);
    setDraft(null);
    setDraftBaseline(null);
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
    setSaving(true);
    setSaveStatus("saving");
    try {
      const item = await updateDiaryEntry(subjectKind, selectedEntry.id, {
        title: titleFromDateLocal(draft.entryDateLocal),
        summary: "",
        content: draft.content,
        entry_at: dateLocalToEntryAtIso(draft.entryDateLocal),
        tags: parseTagsText(draft.tagsText),
      });
      setEntries((prev) => sortEntries(prev.map((e) => (e.id === item.id ? item : e))));
      const synced = entryDraftFromRow(item);
      setDraft(synced);
      setDraftBaseline(synced);
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
      const todayEntry = findEntryByDayLocal(entries, defaultEntryDateLocal());
      if (todayEntry) {
        openEntry(todayEntry);
        return;
      }
      setCreating(true);
      setError("");
      try {
        const day = defaultEntryDateLocal();
        const item = await createDiaryEntry(subjectKind, {
          title: titleFromDateLocal(day),
          summary: "",
          content: "",
          entry_at: dateLocalToEntryAtIso(day),
          tags: [],
        });
        setEntries((prev) => sortEntries([item, ...prev]));
        openEntry(item);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("already exists")) {
          const day = defaultEntryDateLocal();
          const existing = findEntryByDayLocal(entries, day);
          if (existing) {
            openEntry(existing);
            setError("该日期已有日记，已打开现有条目");
            return;
          }
        }
        setError(msg);
      } finally {
        setCreating(false);
      }
    })();
  }, [creating, entries, flushDraftSave, openEntry, subjectKind, writesDisabled]);

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
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          disabled={writesDisabled || creating}
          onClick={handleNewEntry}
        >
          {creating ? "新建中…" : "新建"}
        </Button>
      </div>
      <Input
        type="search"
        className="h-8 w-full"
        placeholder="搜索日记…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      {loading ? <Spinner className="size-4" /> : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EntryTimeline items={entries} selectedId={selectedId} onSelect={selectEntryById} />
      </div>
    </div>
  );

  const detailPane =
    selectedEntry && draft && draftBaseline ? (
      <EntryEditor
        draft={draft}
        onDraftChange={setDraft}
        saveStatus={saveStatus}
        readOnly={writesDisabled}
        onCancel={() => {
          setDraft({ ...draftBaseline });
          setSelectedId(null);
          setDraft(null);
          setDraftBaseline(null);
          setSaveStatus("idle");
        }}
        onDelete={() => {
          void (async () => {
            if (!selectedEntry) return;
            setSaving(true);
            setError("");
            try {
              await deleteDiaryEntry(subjectKind, selectedEntry.id);
              setEntries((prev) => prev.filter((e) => e.id !== selectedEntry.id));
              setSelectedId(null);
              setDraft(null);
              setDraftBaseline(null);
              setSaveStatus("idle");
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setSaving(false);
            }
          })();
        }}
      />
    ) : (
      <div className="text-muted-foreground flex h-full min-h-0 items-center justify-center text-sm">
        选择条目或新建日记
      </div>
    );

  const detailTitle = selectedEntry ? formatEntryDate(selectedEntry.entry_at) : "日记";

  return (
    <ListDetailLayout
      detailTitle={detailTitle}
      listTitle="日记"
      listWidthClass="md:w-80 lg:w-96"
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
