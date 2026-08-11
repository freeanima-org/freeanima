import { useCallback, useMemo, useState } from "react";
import { usePortalRead } from "@freeanima/client/portal-sdk/portal-query";
import { openEntityResource } from "@freeanima/client/portal-sdk/open-entity-resource.ts";
import { navigateAppModulePath } from "@freeanima/client/portal-sdk/pomodoro-launch.ts";
import { Button, Spinner, cn } from "@freeanima/ui-kit";
import { useCompactLayout } from "@freeanima/ui-kit/layout";
import { ChevronLeft, ChevronRight, PlusIcon } from "lucide-react";
import { m } from "@paraglide/messages";

import { AgendaList } from "./components/AgendaList.tsx";
import { EventEditorDialog, type EventEditorTarget } from "./components/EventEditorDialog.tsx";
import { MonthGrid } from "./components/MonthGrid.tsx";
import { WeekGrid, weekStartMonday } from "./components/WeekGrid.tsx";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarRange,
  patchTaskDueAt,
  updateCalendarEvent,
  type CalendarEventRow,
  type CalendarRangeItem,
  type CalendarRangeKind,
} from "./lib/api.ts";
import {
  cstDayKey,
  dayKeyFromIso,
  monthLabel,
  monthRangeIso,
  shiftMonth,
} from "./lib/format-calendar.ts";
import { registerCalendarOfflineModule } from "./lib/offline-store.ts";
import { filterVisibleCalendarItems } from "./lib/visible-items.ts";

registerCalendarOfflineModule();

const KIND_OPTIONS: CalendarRangeKind[] = ["event", "task", "project"];

function nextDayKey(day: string): string | null {
  const parts = day.split("-").map(Number);
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (y == null || mo == null || d == null) return null;
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const next = new Date(Date.UTC(y, mo - 1, d + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function countByDay(items: CalendarRangeItem[]): Map<string, number> {
  const map = new Map<string, number>();
  const bump = (day: string) => {
    if (!day) return;
    map.set(day, (map.get(day) ?? 0) + 1);
  };
  for (const item of items) {
    if (item.kind === "event") {
      const start = dayKeyFromIso(item.start_at);
      const end = dayKeyFromIso(item.end_at ?? item.start_at);
      if (!start) continue;
      let cur: string | null = start;
      while (cur != null && cur <= end) {
        bump(cur);
        const next = nextDayKey(cur);
        if (next == null || next > end) break;
        cur = next;
      }
      continue;
    }
    if (item.kind === "task") {
      const start = dayKeyFromIso(item.start_at ?? item.due_at);
      const end = dayKeyFromIso(item.due_at);
      let cur: string | null = start;
      while (cur != null && cur <= end) {
        bump(cur);
        const next = nextDayKey(cur);
        if (next == null || next > end) break;
        cur = next;
      }
      continue;
    }
    const start = dayKeyFromIso(item.start_at ?? "");
    const end = dayKeyFromIso(item.end_at ?? item.start_at ?? "") || start;
    if (!start) continue;
    let cur: string | null = start;
    while (cur != null && cur <= end) {
      bump(cur);
      const next = nextDayKey(cur);
      if (next == null || next > end) break;
      cur = next;
    }
  }
  return map;
}

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
  const [kinds, setKinds] = useState<CalendarRangeKind[]>([...KIND_OPTIONS]);
  const [editor, setEditor] = useState<EventEditorTarget | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [expandRecurrence, setExpandRecurrence] = useState(true);
  const [weekAnchor, setWeekAnchor] = useState(() => weekStartMonday(today));
  const [refreshing, setRefreshing] = useState(false);

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
  const dayCounts = useMemo(() => countByDay(visibleItems), [visibleItems]);

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

  const toggleKind = useCallback((kind: CalendarRangeKind) => {
    setKinds((prev) => {
      if (prev.includes(kind)) {
        const next = prev.filter((k) => k !== kind);
        return next.length > 0 ? next : prev;
      }
      return [...prev, kind];
    });
  }, []);

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

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 md:p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">{m.calendar_title()}</h1>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={m.calendar_prev_month()}
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
          aria-label={m.calendar_next_month()}
          onPress={() => setCursor((c) => shiftMonth(c.year, c.monthIndex, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button type="button" variant="outline" size="sm" onPress={() => setSelectedDay(today)}>
          {m.calendar_today()}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={viewMode === "month" ? "default" : "outline"}
          onPress={() => setViewMode("month")}
        >
          月
        </Button>
        <Button
          type="button"
          size="sm"
          variant={viewMode === "week" ? "default" : "outline"}
          onPress={() => {
            setViewMode("week");
            setWeekAnchor(weekStartMonday(selectedDay));
          }}
        >
          周
        </Button>
        <Button
          type="button"
          size="sm"
          variant={expandRecurrence ? "default" : "outline"}
          onPress={() => setExpandRecurrence((v) => !v)}
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
              size="sm"
              variant={kinds.includes(kind) ? "default" : "outline"}
              onPress={() => toggleKind(kind)}
            >
              {kind === "event"
                ? m.calendar_kind_event()
                : kind === "task"
                  ? m.calendar_kind_task()
                  : m.calendar_kind_project()}
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
            aria-label={m.habitat_common_refresh()}
            onPress={() => void handleManualRefresh()}
          >
            {refreshing ? <Spinner className="size-3.5" /> : m.habitat_common_refresh()}
          </Button>
          <Button
            type="button"
            size="sm"
            onPress={() => setEditor({ mode: "create", day: selectedDay })}
          >
            <PlusIcon className="size-4" />
            {m.calendar_new_event()}
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
                onOpenTask={(id) => {
                  void openEntityResource({ id, component: "task_item", present: "overlay" });
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
                dayCounts={dayCounts}
                onSelectDay={setSelectedDay}
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
                onOpenProject={() => {
                  navigateAppModulePath("/projects");
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
            }
          : {})}
      />
    </div>
  );
}
