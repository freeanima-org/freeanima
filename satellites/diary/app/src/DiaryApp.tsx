import { useCallback, useEffect, useMemo, useState } from "react";
import { useHubConnection, useNetworkOnline, useSubjectScope } from "@freeanima/shell-sdk/react";
import { Button, Input, Spinner } from "@freeanima/ui-kit";
import { ListDetailLayout } from "@freeanima/ui-kit/layout";

import { EntryEditor } from "./components/EntryEditor.tsx";
import { EntryTimeline, findEntryByDayLocal } from "./components/EntryTimeline.tsx";
import {
  createDiaryEntry,
  deleteDiaryEntry,
  fetchDiaryEntries,
  searchDiaryEntries,
  updateDiaryEntry,
} from "./lib/api.ts";
import type { DiaryEntryRow } from "./lib/format-diary.ts";
import { formatEntryDate, defaultEntryDateLocal, isoToDateLocalValue } from "./lib/format-diary.ts";
import { subscribeShellConfigChanges } from "./lib/sap-client.ts";

export function DiaryApp() {
  const { kind: subjectKind } = useSubjectScope();
  const networkOnline = useNetworkOnline();
  const hubConnection = useHubConnection();
  const writesDisabled = !networkOnline || hubConnection !== "connected";
  const [entries, setEntries] = useState<DiaryEntryRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? null,
    [entries, selectedId],
  );

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
        setEditorMode(null);
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
    setEditorMode(null);
  }, [subjectKind]);

  const listPane = (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          disabled={writesDisabled}
          onClick={() => {
            const todayEntry = findEntryByDayLocal(entries, defaultEntryDateLocal());
            if (todayEntry) {
              setSelectedId(todayEntry.id);
              setEditorMode("edit");
              return;
            }
            setSelectedId(null);
            setEditorMode("create");
          }}
        >
          新建
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
        <EntryTimeline
          items={entries}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setEditorMode("edit");
          }}
        />
      </div>
    </div>
  );

  const detailPane =
    editorMode === "create" ? (
      <EntryEditor
        mode="create"
        entry={null}
        saving={saving}
        readOnly={writesDisabled}
        onCancel={() => setEditorMode(null)}
        onSave={(draft) => {
          void (async () => {
            setSaving(true);
            setError("");
            try {
              const item = await createDiaryEntry(subjectKind, draft);
              setEntries((prev) =>
                [item, ...prev].toSorted((a, b) => b.entry_at.localeCompare(a.entry_at)),
              );
              setSelectedId(item.id);
              setEditorMode("edit");
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              if (msg.includes("already exists")) {
                const day = isoToDateLocalValue(draft.entry_at);
                const existing = findEntryByDayLocal(entries, day);
                if (existing) {
                  setSelectedId(existing.id);
                  setEditorMode("edit");
                  setError("该日期已有日记，已打开现有条目");
                  return;
                }
              }
              setError(msg);
            } finally {
              setSaving(false);
            }
          })();
        }}
      />
    ) : editorMode === "edit" && selectedEntry ? (
      <EntryEditor
        mode="edit"
        entry={selectedEntry}
        saving={saving}
        readOnly={writesDisabled}
        onCancel={() => {
          setEditorMode(null);
          setSelectedId(null);
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
              setEditorMode(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setSaving(false);
            }
          })();
        }}
        onSave={(draft) => {
          void (async () => {
            if (!selectedEntry) return;
            setSaving(true);
            setError("");
            try {
              const item = await updateDiaryEntry(subjectKind, selectedEntry.id, draft);
              setEntries((prev) =>
                prev
                  .map((e) => (e.id === item.id ? item : e))
                  .toSorted((a, b) => b.entry_at.localeCompare(a.entry_at)),
              );
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              if (msg.includes("already exists")) {
                setError("该日期已有其他日记，请选择别的日期");
              } else {
                setError(msg);
              }
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

  const detailTitle =
    editorMode === "create"
      ? "新建日记"
      : selectedEntry
        ? formatEntryDate(selectedEntry.entry_at)
        : "日记";

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
