import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePortalRead } from "@freeanima/client/portal-sdk/portal-query";
import { openEntityResource } from "@freeanima/client/portal-sdk/open-entity-resource.ts";
import { Button, Spinner, cn } from "@freeanima/ui-kit";
import { useCompactLayout } from "@freeanima/ui-kit/layout";
import { ChevronLeft, ChevronRight, PlusIcon } from "lucide-react";

import { AgendaList } from "./components/AgendaList.tsx";
import { EventEditorDialog, type EventEditorTarget } from "./components/EventEditorDialog.tsx";
import { MonthGrid } from "./components/MonthGrid.tsx";
import { WeekGrid, weekStartMonday } from "./components/WeekGrid.tsx";
import {
  createCalendarEvent,
  convertCalendarEventToTask,
  deleteCalendarEvent,
  fetchCalendarEventById,
  fetchCalendarRange,
  patchTaskDueAt,
  updateCalendarEvent,
  type CalendarEventRow,
  type CalendarRangeKind,
} from "./lib/api.ts";
import { cstDayKey, monthLabel, monthRangeIso, shiftMonth } from "./lib/format-calendar.ts";
import { registerCalendarOfflineModule } from "./lib/offline-store.ts";
import { readCalendarUiPrefs, writeCalendarUiPrefs } from "./lib/calendar-prefs.ts";
import { readCalendarEventFromUrl, writeCalendarEventToUrl } from "./lib/calendar-event-url.ts";
import { filterVisibleCalendarItems } from "./lib/visible-items.ts";

registerCalendarOfflineModule();

const KIND_OPTIONS: CalendarRangeKind[] = ["event", "task", "project"];

/** 日程暂只看用户视图，不暴露 subject 切换 */
const CALENDAR_SUBJECT = "user" as const;

export function CalendarApp() {
  const compact = useCompactLayout();
  const today = cstDayKey();
  const [cursor, setCursor] = useState(() => {
    const parts = today.split("-").map(Number);
    const y = parts[0] ?? new Date().getFullYear();
    const mo = parts[1] ?? new Date().getMonth() + 1;
    return { year: y, monthIndex: mo - 1 };
  });
  const [selectedDay, setSelectedDay] = useState(today);
  const [prefs, setPrefs] = useState(() => readCalendarUiPrefs());
  const kinds = prefs.kinds as CalendarRangeKind[];
  const viewMode = prefs.viewMode;
  const expandRecurrence = prefs.expandRecurrence;
  const [editor, setEditor] = useState<EventEditorTarget | null>(null);
  const [weekAnchor, setWeekAnchor] = useState(() => weekStartMonday(today));
  const [refreshing, setRefreshing] = useState(false);

  const patchPrefs = useCallback((patch: Parameters<typeof writeCalendarUiPrefs>[0]) => {
    setPrefs(writeCalendarUiPrefs(patch));
  }, []);

  const range = useMemo(() => {
    if (viewMode === "week") {
      const end = (() => {
        const parts = weekAnchor.split("-").map(Number);
        const y = parts[0] ?? 1970;
        const mo = parts[1] ?? 1;
        const d = parts[2] ?? 1;
        const next = new Date(Date.UTC(y, mo - 1, d + 6));
        const day = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
        return `${day}T23:59:59+08:00`;
      })();
      return { from: `${weekAnchor}T00:00:00+08:00`, to: end };
    }
    return monthRangeIso(cursor.year, cursor.monthIndex);
  }, [cursor.monthIndex, cursor.year, viewMode, weekAnchor]);

  const kindsKey = kinds.toSorted().join(",");
  const query = usePortalRead({
    queryKey: ["calendar", "range", CALENDAR_SUBJECT, range.from, range.to, kindsKey],
    queryFn: () =>
      fetchCalendarRange(CALENDAR_SUBJECT, {
        from: range.from,
        to: range.to,
        kinds,
      }),
  });

  const items = query.data ?? [];
  const visibleItems = useMemo(
    () => filterVisibleCalendarItems(items, expandRecurrence),
    [expandRecurrence, items],
  );

  const eventsById = useMemo(() => {
    const map = new Map<number, CalendarEventRow>();
    for (const item of items) {
      if (item.kind !== "event") continue;
      map.set(item.id, {
        id: item.id,
        title: item.title,
        content: item.content,
        start_at: item.start_at,
        end_at: item.end_at,
        all_day: item.all_day,
        remind_at: item.remind_at,
        tag_ids: [],
        created_at: item.start_at,
        updated_at: item.start_at,
      });
    }
    return map;
  }, [items]);

  const toggleKind = useCallback(
    (kind: CalendarRangeKind) => {
      const prev = prefs.kinds;
      const next = prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind];
      if (next.length === 0) return;
      patchPrefs({ kinds: next });
    },
    [patchPrefs, prefs.kinds],
  );

  /** 窄布局（手机）工具栏开关加大触控命中；宽布局保持 sm */
  const toggleSize = compact ? "default" : "sm";

  const refresh = useCallback(async () => {
    await query.reload();
  }, [query]);

  const handleManualRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh, refreshing]);

  const appliedEventUrlRef = useRef<number | null>(null);

  useEffect(() => {
    const eventId = readCalendarEventFromUrl();
    if (eventId == null) {
      appliedEventUrlRef.current = null;
      return () => {};
    }
    if (appliedEventUrlRef.current === eventId) return () => {};

    const local = eventsById.get(eventId);
    if (local) {
      appliedEventUrlRef.current = eventId;
      setEditor({ mode: "edit", event: local });
      writeCalendarEventToUrl(null);
      return () => {};
    }

    let cancelled = false;
    void fetchCalendarEventById(eventId).then((row) => {
      if (cancelled) return;
      appliedEventUrlRef.current = eventId;
      if (row) {
        setEditor({ mode: "edit", event: row });
        const day = row.start_at.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
          setSelectedDay(day);
          const parts = day.split("-").map(Number);
          const y = parts[0];
          const mo = parts[1];
          if (y != null && mo != null) {
            setCursor({ year: y, monthIndex: mo - 1 });
          }
        }
      }
      writeCalendarEventToUrl(null);
    });
    return () => {
      cancelled = true;
    };
  }, [eventsById]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 md:p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">{"日程"}</h1>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={"上一月"}
          onPress={() => setCursor((c) => shiftMonth(c.year, c.monthIndex, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-24 text-center font-medium">
          {monthLabel(cursor.year, cursor.monthIndex)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={"下一月"}
          onPress={() => setCursor((c) => shiftMonth(c.year, c.monthIndex, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button type="button" variant="outline" size="sm" onPress={() => setSelectedDay(today)}>
          {"今天"}
        </Button>
        <Button
          type="button"
          size={toggleSize}
          variant={viewMode === "month" ? "default" : "outline"}
          onPress={() => patchPrefs({ viewMode: "month" })}
        >
          月
        </Button>
        <Button
          type="button"
          size={toggleSize}
          variant={viewMode === "week" ? "default" : "outline"}
          onPress={() => {
            patchPrefs({ viewMode: "week" });
            setWeekAnchor(weekStartMonday(selectedDay));
          }}
        >
          周
        </Button>
        <Button
          type="button"
          size={toggleSize}
          variant={expandRecurrence ? "default" : "outline"}
          onPress={() => patchPrefs({ expandRecurrence: !expandRecurrence })}
        >
          重复展开
        </Button>
        {viewMode === "week" ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="上一周"
              onPress={() => {
                const parts = weekAnchor.split("-").map(Number);
                const y = parts[0] ?? 1970;
                const mo = parts[1] ?? 1;
                const d = parts[2] ?? 1;
                const prev = new Date(Date.UTC(y, mo - 1, d - 7));
                setWeekAnchor(
                  `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-${String(prev.getUTCDate()).padStart(2, "0")}`,
                );
              }}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="下一周"
              onPress={() => {
                const parts = weekAnchor.split("-").map(Number);
                const y = parts[0] ?? 1970;
                const mo = parts[1] ?? 1;
                const d = parts[2] ?? 1;
                const next = new Date(Date.UTC(y, mo - 1, d + 7));
                setWeekAnchor(
                  `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`,
                );
              }}
            >
              <ChevronRight className="size-4" />
            </Button>
          </>
        ) : null}
        <div className="flex flex-wrap gap-1">
          {KIND_OPTIONS.map((kind) => (
            <Button
              key={kind}
              type="button"
              size={toggleSize}
              variant={kinds.includes(kind) ? "default" : "outline"}
              onPress={() => toggleKind(kind)}
            >
              {kind === "event" ? "事件" : kind === "task" ? "任务" : "项目"}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2"
            isDisabled={refreshing || query.loading}
            aria-label={"刷新"}
            onPress={() => void handleManualRefresh()}
          >
            {refreshing ? <Spinner className="size-3.5" /> : "刷新"}
          </Button>
          <Button
            type="button"
            size="sm"
            onPress={() => setEditor({ mode: "create", day: selectedDay })}
          >
            <PlusIcon className="size-4" />
            {"新建事件"}
          </Button>
        </div>
      </header>

      {query.loading && items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div
          className={cn(
            "min-h-0 flex-1 gap-4",
            compact
              ? "flex flex-col overflow-auto"
              : "grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]",
          )}
        >
          <section className="rounded-lg border border-border/60 p-3">
            {viewMode === "week" ? (
              <WeekGrid
                weekStartDay={weekAnchor}
                today={today}
                items={visibleItems}
                onSelectDay={setSelectedDay}
                onOpenEvent={(id) => {
                  const ev = eventsById.get(id);
                  if (ev) setEditor({ mode: "edit", event: ev });
                }}
                onOpenTask={(id) => {
                  void openEntityResource({ id, component: "task_item", present: "overlay" });
                }}
                onOpenProject={(id) => {
                  void openEntityResource({ id, component: "project", present: "overlay" });
                }}
                onDropTaskDue={(taskId, day) => {
                  void patchTaskDueAt(CALENDAR_SUBJECT, taskId, day).then(() => refresh());
                }}
              />
            ) : (
              <MonthGrid
                year={cursor.year}
                monthIndex={cursor.monthIndex}
                selectedDay={selectedDay}
                today={today}
                items={visibleItems}
                onSelectDay={setSelectedDay}
                onOpenEvent={(id) => {
                  const ev = eventsById.get(id);
                  if (ev) setEditor({ mode: "edit", event: ev });
                }}
                onOpenTask={(id) => {
                  void openEntityResource({ id, component: "task_item", present: "overlay" });
                }}
                onOpenProject={(id) => {
                  void openEntityResource({ id, component: "project", present: "overlay" });
                }}
              />
            )}
          </section>
          <section className="flex min-h-0 flex-col rounded-lg border border-border/60 p-3">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">{selectedDay}</h2>
            <div className="min-h-0 flex-1 overflow-auto">
              <AgendaList
                day={selectedDay}
                items={visibleItems}
                onOpenEvent={(id) => {
                  const ev = eventsById.get(id);
                  if (ev) setEditor({ mode: "edit", event: ev });
                }}
                onEditEvent={(id) => {
                  const ev = eventsById.get(id);
                  if (ev) setEditor({ mode: "edit", event: ev });
                }}
                onOpenTask={(id) => {
                  void openEntityResource({ id, component: "task_item", present: "overlay" });
                }}
                onOpenProject={(id) => {
                  void openEntityResource({ id, component: "project", present: "overlay" });
                }}
              />
            </div>
          </section>
        </div>
      )}

      <EventEditorDialog
        open={editor != null}
        target={editor}
        onClose={() => setEditor(null)}
        onSave={async (input) => {
          if (editor?.mode === "edit") {
            await updateCalendarEvent(CALENDAR_SUBJECT, { id: editor.event.id, ...input });
          } else {
            await createCalendarEvent(CALENDAR_SUBJECT, input);
          }
          await refresh();
        }}
        {...(editor?.mode === "edit"
          ? {
              onDelete: async () => {
                await deleteCalendarEvent(CALENDAR_SUBJECT, editor.event.id);
                setEditor(null);
                await refresh();
              },
              onConvertToTask: async () => {
                const item = await convertCalendarEventToTask(CALENDAR_SUBJECT, editor.event.id);
                setEditor(null);
                await refresh();
                void openEntityResource({
                  id: item.id,
                  component: "task_item",
                  present: "overlay",
                });
              },
            }
          : {})}
      />
    </div>
  );
}
