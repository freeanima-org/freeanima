import {
  openEntityResource,
  subscribeEntityOverlayClose,
} from "@freeanima/client/portal-sdk/open-entity-resource.ts";
import { launchPomodoroForEvent, launchPomodoroForTask } from "@freeanima/client/portal-sdk";
import { usePortalRead } from "@freeanima/client/portal-sdk/portal-query";
import {
  useActionSheetCapability,
  useContextMenuCapability,
  useUserSubjectId,
} from "@freeanima/client/portal-sdk/react.tsx";
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Spinner,
} from "@freeanima/ui-kit";
import { ActionSheet, showConfirm, toast } from "@freeanima/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/ui-kit/composite/types.ts";
import { useCompactLayout } from "@freeanima/ui-kit/layout";
import { Check, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AgendaDayHeader } from "./components/AgendaDayHeader.tsx";
import { AgendaDayView } from "./components/AgendaDayView.tsx";
import {
  CalendarDisplayPopover,
  CalendarDisplaySheet,
} from "./components/CalendarDisplayPopover.tsx";
import { EventEditorDialog, type EventEditorTarget } from "./components/EventEditorDialog.tsx";
import { MonthGrid } from "./components/MonthGrid.tsx";
import { MultiDayAgenda } from "./components/MultiDayAgenda.tsx";
import { TaskCreateDialog } from "./components/TaskCreateDialog.tsx";
import { WeekGrid, weekStartMonday } from "./components/WeekGrid.tsx";
import {
  dueFiltersForAgenda,
  filterEndedEvents,
  mergeCalendarItems,
  planOverdueFiltersForAgenda,
} from "./lib/agenda-items.ts";
import { buildAgendaMenuItems, type AgendaMenuHandlers } from "./lib/agenda-menus.ts";
import {
  type CalendarEventRow,
  type CalendarRangeItem,
  type CalendarRangeKind,
  completeAgendaTask,
  convertAgendaTaskToEvent,
  convertCalendarEventToTask,
  createCalendarEvent,
  deleteAgendaTask,
  deleteCalendarEvent,
  fetchCalendarEventById,
  fetchCalendarPrefs,
  fetchCalendarRange,
  fetchDueTasksForAgenda,
  patchTaskDueAt,
  uncompleteAgendaTask,
  updateCalendarEvent,
  updateCalendarPrefs,
} from "./lib/api.ts";
import {
  fetchProjectsForMove,
  fetchTaskLists,
  type TaskListRow,
} from "@freeanima/features/task/ui/spa/lib/api.ts";
import { resolveDefaultListId } from "@freeanima/features/task/ui/spa/lib/resolve-list.ts";
import {
  searchTaskQuickAddTags,
  submitTaskQuickAdd,
} from "@freeanima/features/task/ui/spa/lib/task-quick-add-handlers.ts";
import { readCalendarEventFromUrl, writeCalendarEventToUrl } from "./lib/calendar-event-url.ts";
import {
  type BuiltinCalendarSourceId,
  builtinSourceLabel,
  CALENDAR_VIEW_MODE_LABEL,
  CALENDAR_VIEW_MODES,
  type CalendarKindPref,
  type CalendarUiPrefsWritePatch,
  type CalendarViewMode,
  currentViewDisplay,
  isAgendaViewMode,
  readCalendarUiPrefs,
  replaceCalendarUiPrefs,
  writeCalendarUiPrefs,
} from "./lib/calendar-prefs.ts";
import {
  cstDayKey,
  dayHeadingLabel,
  dayRangeIso,
  listDayKeys,
  monthLabel,
  monthRangeIso,
  nDayRangeIso,
  shiftDayKey,
  shiftMonth,
} from "./lib/format-calendar.ts";
import { registerCalendarOfflineModule } from "./lib/offline-store.ts";
import { filterVisibleCalendarItems } from "./lib/visible-items.ts";

registerCalendarOfflineModule();

function openTask(id: number) {
  void openEntityResource({ id, component: "task_item", present: "overlay" });
}

function openProject(id: number) {
  void openEntityResource({ id, component: "project", present: "overlay" });
}

function openHabit(id: number) {
  window.location.assign(`/web/habits?habit=${id}`);
}

type SheetMenuState = { title?: string; items: ActionSheetItem[] };

export function CalendarApp() {
  const subjectId = useUserSubjectId();
  const compact = useCompactLayout();
  const contextMenuEnabled = useContextMenuCapability();
  const useActionSheet = useActionSheetCapability();
  const today = cstDayKey();
  const [cursor, setCursor] = useState(() => {
    const parts = today.split("-").map(Number);
    const y = parts[0] ?? new Date().getFullYear();
    const mo = parts[1] ?? new Date().getMonth() + 1;
    return { year: y, monthIndex: mo - 1 };
  });
  const [selectedDay, setSelectedDay] = useState(today);
  const [prefs, setPrefs] = useState(() => readCalendarUiPrefs());
  const viewMode = prefs.viewMode;
  const viewDisplay = currentViewDisplay(prefs);
  const kinds = viewDisplay.kinds;
  const builtinSources = viewDisplay.builtinSources;
  const expandRecurrence = viewDisplay.expandRecurrence;
  const showCompleted = viewDisplay.showCompleted;
  const showEndedEvents = viewDisplay.showEndedEvents;
  const agendaMode = isAgendaViewMode(viewMode);
  const [editor, setEditor] = useState<EventEditorTarget | null>(null);
  const [taskCreateDay, setTaskCreateDay] = useState<string | null>(null);
  const [taskLists, setTaskLists] = useState<TaskListRow[]>([]);
  const [projectsForTask, setProjectsForTask] = useState<
    Awaited<ReturnType<typeof fetchProjectsForMove>>
  >([]);
  const [weekAnchor, setWeekAnchor] = useState(() => weekStartMonday(today));
  const [refreshing, setRefreshing] = useState(false);
  const [displaySheetOpen, setDisplaySheetOpen] = useState(false);
  const [sheetMenu, setSheetMenu] = useState<SheetMenuState | null>(null);

  const patchPrefs = useCallback((patch: CalendarUiPrefsWritePatch) => {
    const next = writeCalendarUiPrefs(patch);
    setPrefs(next);
    const remotePatch: Parameters<typeof updateCalendarPrefs>[1] = {};
    if (patch.viewMode != null) remotePatch.viewMode = patch.viewMode;
    if (patch.byView != null) remotePatch.byView = patch.byView;
    if (patch.currentView != null) {
      remotePatch.byView = {
        ...remotePatch.byView,
        [next.viewMode]: patch.currentView,
      };
    }
    void updateCalendarPrefs(subjectId, remotePatch).catch(() => {
      /* 本地已写入；下次启动再对齐 */
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchCalendarPrefs(subjectId)
      .then((remote) => {
        if (cancelled) return;
        setPrefs(replaceCalendarUiPrefs(remote));
      })
      .catch(() => {
        /* 保留本地缓存 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void fetchTaskLists()
      .then(setTaskLists)
      .catch(() => {});
    void fetchProjectsForMove()
      .then(setProjectsForTask)
      .catch(() => {});
  }, []);

  const applyDay = useCallback((day: string) => {
    setSelectedDay(day);
    const parts = day.split("-").map(Number);
    const y = parts[0];
    const mo = parts[1];
    if (y != null && mo != null) setCursor({ year: y, monthIndex: mo - 1 });
    setWeekAnchor(weekStartMonday(day));
  }, []);

  const range = useMemo(() => {
    if (viewMode === "week") return nDayRangeIso(weekAnchor, 7);
    if (viewMode === "day") return dayRangeIso(selectedDay);
    if (viewMode === "next3") return nDayRangeIso(today, 3);
    if (viewMode === "next7") return nDayRangeIso(today, 7);
    return monthRangeIso(cursor.year, cursor.monthIndex);
  }, [cursor.monthIndex, cursor.year, selectedDay, today, viewMode, weekAnchor]);

  const rangeKinds = useMemo((): CalendarRangeKind[] => {
    const next: CalendarRangeKind[] = [...kinds];
    if (builtinSources.length > 0) next.push("holiday");
    return next;
  }, [builtinSources.length, kinds]);

  const dueFilters = useMemo(
    () => (kinds.includes("task") ? dueFiltersForAgenda(viewMode, selectedDay, today) : null),
    [kinds, selectedDay, today, viewMode],
  );
  const planOverdueFilters = useMemo(
    () =>
      kinds.includes("task") ? planOverdueFiltersForAgenda(viewMode, selectedDay, today) : null,
    [kinds, selectedDay, today, viewMode],
  );

  const kindsKey = rangeKinds.toSorted().join(",");
  const sourcesKey = builtinSources.toSorted().join(",");
  const dueKey = dueFilters ? JSON.stringify(dueFilters) : "";
  const planOverdueKey = planOverdueFilters ? JSON.stringify(planOverdueFilters) : "";
  const query = usePortalRead({
    queryKey: [
      "calendar",
      "range",
      subjectId,
      range.from,
      range.to,
      kindsKey,
      sourcesKey,
      dueKey,
      planOverdueKey,
      showCompleted ? "1" : "0",
    ],
    queryFn: async () => {
      const rangeItems = await fetchCalendarRange(subjectId, {
        from: range.from,
        to: range.to,
        kinds: rangeKinds,
        ...(builtinSources.length > 0 ? { sources: builtinSources } : {}),
        ...(showCompleted ? { include_completed: true } : {}),
      });
      let merged = rangeItems;
      if (dueFilters) {
        const dueItems = await fetchDueTasksForAgenda(subjectId, dueFilters);
        merged = mergeCalendarItems(merged, dueItems);
      }
      if (planOverdueFilters) {
        const planItems = await fetchDueTasksForAgenda(subjectId, planOverdueFilters);
        merged = mergeCalendarItems(merged, planItems);
      }
      return merged;
    },
  });

  const items = query.data ?? [];
  const visibleItems = useMemo(() => {
    const visible = filterVisibleCalendarItems(items, expandRecurrence);
    if (showEndedEvents) return visible;
    return filterEndedEvents(visible, new Date(), today);
  }, [expandRecurrence, items, showEndedEvents, today]);

  const agendaDays = useMemo(() => {
    if (viewMode === "day") return [selectedDay];
    if (viewMode === "next3") return listDayKeys(today, 3);
    if (viewMode === "next7") return listDayKeys(today, 7);
    return [];
  }, [selectedDay, today, viewMode]);

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
    (kind: CalendarKindPref) => {
      const prev = kinds;
      const next = prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind];
      if (next.length === 0 && builtinSources.length === 0) return;
      patchPrefs({ currentView: { kinds: next } });
    },
    [builtinSources.length, kinds, patchPrefs],
  );

  const toggleBuiltinSource = useCallback(
    (source: BuiltinCalendarSourceId) => {
      const prev = builtinSources;
      const next = prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source];
      if (next.length === 0 && kinds.length === 0) return;
      patchPrefs({ currentView: { builtinSources: next } });
    },
    [builtinSources, kinds.length, patchPrefs],
  );

  const openHoliday = useCallback((item: Extract<CalendarRangeItem, { kind: "holiday" }>) => {
    toast(item.title, {
      description: builtinSourceLabel(item.source),
      duration: 2500,
    });
  }, []);

  const setViewMode = useCallback(
    (next: CalendarViewMode) => {
      patchPrefs({ viewMode: next });
      if (next === "week") setWeekAnchor(weekStartMonday(selectedDay));
    },
    [patchPrefs, selectedDay],
  );

  /** 窄布局（手机）工具栏开关加大触控命中；宽布局保持 sm */
  const toggleSize = compact ? "default" : "sm";

  const refresh = useCallback(async () => {
    await query.reload();
  }, [query.reload]);

  // 任务/项目/事件浮层关闭后刷新议程（浮层内编辑不会自动推动 portal-query）
  useEffect(() => {
    return subscribeEntityOverlayClose((info) => {
      if (
        info.component === "task_item" ||
        info.component === "project" ||
        info.component === "calendar_event"
      ) {
        void refresh();
      }
    });
  }, [refresh]);

  const handleManualRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh, refreshing]);

  const shiftSelectedDay = useCallback(
    (delta: number) => {
      const next = shiftDayKey(selectedDay, delta);
      if (next) applyDay(next);
    },
    [applyDay, selectedDay],
  );

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
        if (/^\d{4}-\d{2}-\d{2}$/.test(day)) applyDay(day);
      }
      writeCalendarEventToUrl(null);
    });
    return () => {
      cancelled = true;
    };
  }, [applyDay, eventsById]);

  const openEvent = useCallback(
    (id: number) => {
      const ev = eventsById.get(id);
      if (ev) setEditor({ mode: "edit", event: ev });
    },
    [eventsById],
  );

  const agendaMenuHandlers: AgendaMenuHandlers = useMemo(
    () => ({
      onEditEvent: (item) => openEvent(item.id),
      onStartPomodoroEvent: (item) => launchPomodoroForEvent({ id: item.id, title: item.title }),
      onConvertEventToTask: (item) => {
        void (async () => {
          const ok = await showConfirm({
            title: "转为任务",
            description: `将「${item.title}」转为任务？此操作有损且不可撤销。`,
          });
          if (!ok) return;
          const created = await convertCalendarEventToTask(subjectId, item.id);
          setEditor(null);
          await refresh();
          void openEntityResource({
            id: created.id,
            component: "task_item",
            present: "overlay",
          });
        })();
      },
      onDeleteEvent: (item) => {
        void (async () => {
          const ok = await showConfirm({
            title: "删除事件",
            description: `删除「${item.title}」？`,
          });
          if (!ok) return;
          await deleteCalendarEvent(subjectId, item.id);
          setEditor(null);
          await refresh();
        })();
      },
      onEditTask: (item) => openTask(item.id),
      onStartPomodoroTask: (item) => launchPomodoroForTask({ id: item.id, title: item.title }),
      onToggleCompleteTask: (item) => {
        void (async () => {
          if (item.status === "completed") {
            await uncompleteAgendaTask(subjectId, item.id);
          } else {
            await completeAgendaTask(subjectId, item.id);
          }
          await refresh();
        })();
      },
      onConvertTaskToEvent: (item) => {
        void (async () => {
          const ok = await showConfirm({
            title: "转为事件",
            description: `将「${item.title}」转为事件？此操作有损且不可撤销。`,
          });
          if (!ok) return;
          const created = await convertAgendaTaskToEvent(subjectId, item.id);
          await refresh();
          const row = await fetchCalendarEventById(created.id);
          if (row) setEditor({ mode: "edit", event: row });
        })();
      },
      onDeleteTask: (item) => {
        void (async () => {
          const ok = await showConfirm({
            title: "删除任务",
            description: `删除「${item.title}」？`,
          });
          if (!ok) return;
          await deleteAgendaTask(subjectId, item.id);
          await refresh();
        })();
      },
      onOpenProject: (item) => openProject(item.id),
    }),
    [openEvent, refresh, subjectId],
  );

  const contextMenuItemsForItem = useCallback(
    (item: CalendarRangeItem) => buildAgendaMenuItems(item, agendaMenuHandlers),
    [agendaMenuHandlers],
  );

  const openItemMenuSheet = useCallback(
    (item: CalendarRangeItem) => {
      const menuItems = buildAgendaMenuItems(item, agendaMenuHandlers);
      if (menuItems.length === 0) return;
      setSheetMenu({ title: item.title, items: menuItems });
    },
    [agendaMenuHandlers],
  );

  const agendaMenuProps = {
    contextMenuEnabled,
    useActionSheet,
    contextMenuItemsForItem,
    onOpenItemMenu: openItemMenuSheet,
  };

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-3 md:p-4",
        compact && viewMode === "month" ? "p-0" : "p-3",
      )}
    >
      <header
        className={cn(
          compact ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-2",
          compact && viewMode === "month" && "px-2 pt-2",
        )}
      >
        {compact ? (
          <>
            <div className="flex items-center gap-2">
              <h1 className="shrink-0 text-lg font-semibold">{"日程"}</h1>
              <div className="ml-auto flex items-center gap-1.5">
                <DropdownMenuTrigger>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11"
                    aria-label="更多"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                  <DropdownMenu>
                    {CALENDAR_VIEW_MODES.map((mode) => (
                      <DropdownMenuItem
                        key={mode}
                        id={`view-${mode}`}
                        className="min-h-11"
                        onAction={() => setViewMode(mode)}
                      >
                        <span className="flex w-full items-center gap-2">
                          <Check
                            className={cn(
                              "size-4",
                              viewMode === mode ? "opacity-100" : "opacity-0",
                            )}
                            aria-hidden
                          />
                          {CALENDAR_VIEW_MODE_LABEL[mode]}
                        </span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      id="display"
                      className="min-h-11"
                      onAction={() => setDisplaySheetOpen(true)}
                    >
                      {"显示"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      id="refresh"
                      className="min-h-11"
                      isDisabled={refreshing || query.loading}
                      onAction={() => void handleManualRefresh()}
                    >
                      {refreshing ? "刷新中…" : "刷新"}
                    </DropdownMenuItem>
                  </DropdownMenu>
                </DropdownMenuTrigger>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex min-w-0 flex-1 items-center justify-center gap-0.5">
                {viewMode === "month" ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={compact ? "size-11" : undefined}
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
                      className={compact ? "size-11" : undefined}
                      aria-label={"下一月"}
                      onPress={() => setCursor((c) => shiftMonth(c.year, c.monthIndex, 1))}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </>
                ) : null}
                {viewMode === "week" ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={compact ? "size-11" : undefined}
                      aria-label="上一周"
                      onPress={() => {
                        const prev = shiftDayKey(weekAnchor, -7);
                        if (prev) setWeekAnchor(prev);
                      }}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="min-w-24 text-center font-medium">{weekAnchor}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={compact ? "size-11" : undefined}
                      aria-label="下一周"
                      onPress={() => {
                        const next = shiftDayKey(weekAnchor, 7);
                        if (next) setWeekAnchor(next);
                      }}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </>
                ) : null}
                {viewMode === "day" ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={compact ? "size-11" : undefined}
                      aria-label="前一天"
                      onPress={() => shiftSelectedDay(-1)}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="min-w-28 text-center font-medium">
                      {dayHeadingLabel(selectedDay, today)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={compact ? "size-11" : undefined}
                      aria-label="后一天"
                      onPress={() => shiftSelectedDay(1)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 shrink-0"
                onPress={() => applyDay(today)}
              >
                {"今天"}
              </Button>
            </div>
            <CalendarDisplaySheet
              open={displaySheetOpen}
              onClose={() => setDisplaySheetOpen(false)}
              compact={compact}
              kinds={kinds}
              builtinSources={builtinSources}
              expandRecurrence={expandRecurrence}
              showCompleted={showCompleted}
              showEndedEvents={showEndedEvents}
              onToggleKind={toggleKind}
              onToggleSource={toggleBuiltinSource}
              onToggleExpandRecurrence={(next) =>
                patchPrefs({ currentView: { expandRecurrence: next } })
              }
              onToggleShowCompleted={(next) => patchPrefs({ currentView: { showCompleted: next } })}
              onToggleShowEndedEvents={(next) =>
                patchPrefs({ currentView: { showEndedEvents: next } })
              }
            />
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">{"日程"}</h1>
            <DropdownMenuTrigger>
              <Button
                type="button"
                size={toggleSize}
                variant="outline"
                className="min-w-24"
                aria-label="切换视图"
              >
                {CALENDAR_VIEW_MODE_LABEL[viewMode]}
                <ChevronDown className="size-4" />
              </Button>
              <DropdownMenu>
                {CALENDAR_VIEW_MODES.map((mode) => (
                  <DropdownMenuItem key={mode} id={mode} onAction={() => setViewMode(mode)}>
                    {CALENDAR_VIEW_MODE_LABEL[mode]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenu>
            </DropdownMenuTrigger>
            {viewMode === "month" ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={compact ? "size-11" : undefined}
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
                  className={compact ? "size-11" : undefined}
                  aria-label={"下一月"}
                  onPress={() => setCursor((c) => shiftMonth(c.year, c.monthIndex, 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </>
            ) : null}
            {viewMode === "week" ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={compact ? "size-11" : undefined}
                  aria-label="上一周"
                  onPress={() => {
                    const prev = shiftDayKey(weekAnchor, -7);
                    if (prev) setWeekAnchor(prev);
                  }}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-24 text-center font-medium">{weekAnchor}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={compact ? "size-11" : undefined}
                  aria-label="下一周"
                  onPress={() => {
                    const next = shiftDayKey(weekAnchor, 7);
                    if (next) setWeekAnchor(next);
                  }}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </>
            ) : null}
            {viewMode === "day" ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={compact ? "size-11" : undefined}
                  aria-label="前一天"
                  onPress={() => shiftSelectedDay(-1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-28 text-center font-medium">
                  {dayHeadingLabel(selectedDay, today)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={compact ? "size-11" : undefined}
                  aria-label="后一天"
                  onPress={() => shiftSelectedDay(1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </>
            ) : null}
            <Button type="button" variant="outline" size="sm" onPress={() => applyDay(today)}>
              {"今天"}
            </Button>
            <CalendarDisplayPopover
              toggleSize={toggleSize}
              compact={compact}
              kinds={kinds}
              builtinSources={builtinSources}
              expandRecurrence={expandRecurrence}
              showCompleted={showCompleted}
              showEndedEvents={showEndedEvents}
              onToggleKind={toggleKind}
              onToggleSource={toggleBuiltinSource}
              onToggleExpandRecurrence={(next) =>
                patchPrefs({ currentView: { expandRecurrence: next } })
              }
              onToggleShowCompleted={(next) => patchPrefs({ currentView: { showCompleted: next } })}
              onToggleShowEndedEvents={(next) =>
                patchPrefs({ currentView: { showEndedEvents: next } })
              }
            />
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
            </div>
          </>
        )}
      </header>

      {query.loading && items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : agendaMode ? (
        <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-border/60 p-3">
          <MultiDayAgenda
            days={agendaDays}
            today={today}
            items={visibleItems}
            onOpenEvent={openEvent}
            onEditEvent={openEvent}
            onOpenTask={openTask}
            onOpenProject={openProject}
            onOpenHoliday={openHoliday}
            onOpenHabit={openHabit}
            onCreateEvent={(day) => setEditor({ mode: "create", day })}
            onCreateTask={(day) => setTaskCreateDay(day)}
            {...agendaMenuProps}
          />
        </section>
      ) : (
        <div
          className={cn(
            "min-h-0 flex-1 gap-4",
            compact
              ? "flex flex-col overflow-auto"
              : "grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]",
          )}
        >
          <section
            className={cn(
              "rounded-lg border border-border/60",
              compact && viewMode === "month" ? "p-1" : "p-3",
            )}
          >
            {viewMode === "week" ? (
              <WeekGrid
                weekStartDay={weekAnchor}
                today={today}
                items={visibleItems}
                onSelectDay={applyDay}
                onOpenEvent={openEvent}
                onOpenTask={openTask}
                onOpenProject={openProject}
                onOpenHoliday={openHoliday}
                onOpenHabit={openHabit}
                onDropTaskDue={(taskId, day) => {
                  void patchTaskDueAt(subjectId, taskId, day).then(() => refresh());
                }}
              />
            ) : (
              <MonthGrid
                year={cursor.year}
                monthIndex={cursor.monthIndex}
                selectedDay={selectedDay}
                today={today}
                items={visibleItems}
                onSelectDay={applyDay}
                onOpenEvent={openEvent}
                onOpenTask={openTask}
                onOpenProject={openProject}
                onOpenHoliday={openHoliday}
                onOpenHabit={openHabit}
              />
            )}
          </section>
          <section className="flex min-h-0 flex-col rounded-lg border border-border/60 p-3">
            <AgendaDayHeader
              className="mb-2 flex items-center gap-2"
              day={selectedDay}
              today={today}
              onCreateEvent={(day) => setEditor({ mode: "create", day })}
              onCreateTask={(day) => setTaskCreateDay(day)}
            />
            <div className="min-h-0 flex-1 overflow-auto">
              <AgendaDayView
                day={selectedDay}
                today={today}
                items={visibleItems}
                onOpenEvent={openEvent}
                onEditEvent={openEvent}
                onOpenTask={openTask}
                onOpenProject={openProject}
                onOpenHoliday={openHoliday}
                onOpenHabit={openHabit}
                {...agendaMenuProps}
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
            await updateCalendarEvent(subjectId, { id: editor.event.id, ...input });
          } else {
            await createCalendarEvent(subjectId, input);
          }
          await refresh();
        }}
        {...(editor?.mode === "edit"
          ? {
              onDelete: async () => {
                await deleteCalendarEvent(subjectId, editor.event.id);
                setEditor(null);
                await refresh();
              },
              onConvertToTask: async () => {
                const item = await convertCalendarEventToTask(subjectId, editor.event.id);
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
      <TaskCreateDialog
        open={taskCreateDay != null}
        day={taskCreateDay}
        today={today}
        lists={taskLists}
        projects={projectsForTask}
        defaultListId={resolveDefaultListId(taskLists)}
        searchTags={searchTaskQuickAddTags}
        onClose={() => setTaskCreateDay(null)}
        onSave={async (payload) => {
          await submitTaskQuickAdd({
            payload,
            subjectId,
            lists: taskLists,
            smartListRow: null,
            fallbackListId: resolveDefaultListId(taskLists),
          });
          await refresh();
        }}
      />
      {sheetMenu ? (
        <ActionSheet
          {...(sheetMenu.title != null ? { title: sheetMenu.title } : {})}
          items={sheetMenu.items}
          onClose={() => setSheetMenu(null)}
        />
      ) : null}
    </div>
  );
}
