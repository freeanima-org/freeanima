import { Button, cn } from "@freeanima/ui-kit";
import { PRIORITY_LABEL, priorityToneBg } from "@freeanima/ui-kit/lib/task-item-display.ts";
import { formatDueChip } from "@freeanima/ui-kit/lib/datetime-local.ts";

import type { CalendarRangeItem } from "../lib/api.ts";
import { calendarItemKey, dedupeAgendaItemsForDay, itemOverlapsDay } from "../lib/agenda-items.ts";
import { builtinSourceLabel } from "../lib/calendar-prefs.ts";
import { dayKeyFromIso, isoToTimeLocalValue } from "../lib/format-calendar.ts";

type AgendaListProps = {
  day?: string;
  items: CalendarRangeItem[];
  emptyLabel?: string;
  showDueChip?: boolean;
  onOpenEvent: (id: number) => void;
  onOpenTask: (id: number) => void;
  onOpenProject: (id: number) => void;
  onEditEvent: (id: number) => void;
  onOpenHoliday: (item: Extract<CalendarRangeItem, { kind: "holiday" }>) => void;
};

function kindLabel(item: CalendarRangeItem): string {
  if (item.kind === "event") return "事件";
  if (item.kind === "task") return item.status === "completed" ? "已完成" : "任务";
  if (item.kind === "holiday") return builtinSourceLabel(item.source);
  return "项目";
}

function itemTime(item: CalendarRangeItem, day?: string): string {
  if (item.kind === "event") {
    if (item.all_day) return "全天";
    return isoToTimeLocalValue(item.start_at) || "—";
  }
  if (item.kind === "holiday") return "全天";
  if (item.kind === "task") {
    if (
      item.status === "completed" &&
      item.completed_at &&
      day &&
      dayKeyFromIso(item.completed_at) === day
    ) {
      return isoToTimeLocalValue(item.completed_at) || "完成";
    }
    const start = isoToTimeLocalValue(item.start_at ?? null);
    const end = isoToTimeLocalValue(item.end_at ?? null);
    if (item.start_at && item.end_at && start && end && start !== end) {
      return `${start}–${end}`;
    }
    if (start) return start;
    if (item.due_at) return isoToTimeLocalValue(item.due_at) || "截止";
    if (item.completed_at) return isoToTimeLocalValue(item.completed_at) || "完成";
    return "截止";
  }
  return isoToTimeLocalValue(item.start_at) || "—";
}

export function AgendaList({
  day,
  items,
  emptyLabel = "当天暂无条目",
  showDueChip = false,
  onOpenEvent,
  onOpenTask,
  onOpenProject,
  onEditEvent,
  onOpenHoliday,
}: AgendaListProps) {
  const filtered = day == null ? items : items.filter((item) => itemOverlapsDay(item, day));
  const dayItems = dedupeAgendaItemsForDay(filtered);

  if (dayItems.length === 0) {
    return <p className="text-sm text-muted-foreground px-1 py-4">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {dayItems.map((item) => {
        const dueChip = showDueChip && item.kind === "task" ? formatDueChip(item.due_at) : null;
        const completed = item.kind === "task" && item.status === "completed";
        return (
          <li key={calendarItemKey(item)}>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-auto w-full justify-start gap-3 px-3 py-2 text-left",
                completed && "opacity-70",
              )}
              onPress={() => {
                if (item.kind === "event") onEditEvent(item.id);
                else if (item.kind === "task") onOpenTask(item.id);
                else if (item.kind === "holiday") onOpenHoliday(item);
                else onOpenProject(item.id);
              }}
            >
              {item.kind === "task" ? (
                <span
                  className={cn("size-2 shrink-0 rounded-full", priorityToneBg(item.priority))}
                  title={PRIORITY_LABEL[item.priority]}
                  aria-hidden
                />
              ) : (
                <span className="size-2 shrink-0" aria-hidden />
              )}
              <span className="w-12 shrink-0 text-xs text-muted-foreground">
                {itemTime(item, day)}
              </span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                  item.kind === "event" && "bg-primary/15 text-primary",
                  item.kind === "task" &&
                    !completed &&
                    "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                  item.kind === "task" && completed && "bg-muted text-muted-foreground",
                  item.kind === "project" && "bg-sky-500/15 text-sky-700 dark:text-sky-300",
                  item.kind === "holiday" &&
                    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                )}
              >
                {kindLabel(item)}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate font-medium",
                  completed && "text-muted-foreground line-through",
                )}
              >
                {item.title}
              </span>
              {dueChip?.overdue ? (
                <span className="shrink-0 text-xs text-destructive">{dueChip.label}</span>
              ) : null}
            </Button>
            {item.kind === "event" ? (
              <button
                type="button"
                className="sr-only"
                onClick={() => onOpenEvent(item.id)}
                tabIndex={-1}
              >
                open
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
