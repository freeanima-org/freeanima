import { Button, cn } from "@freeanima/ui-kit";
import { m } from "@paraglide/messages";

import type { CalendarRangeItem } from "../lib/api.ts";
import { dayKeyFromIso, isoToTimeLocalValue } from "../lib/format-calendar.ts";

type AgendaListProps = {
  day: string;
  items: CalendarRangeItem[];
  onOpenEvent: (id: number) => void;
  onOpenTask: (id: number) => void;
  onOpenProject: () => void;
  onEditEvent: (id: number) => void;
};

function kindLabel(kind: CalendarRangeItem["kind"]): string {
  if (kind === "event") return m.calendar_kind_event();
  if (kind === "task") return m.calendar_kind_task();
  return m.calendar_kind_project();
}

function itemTime(item: CalendarRangeItem): string {
  if (item.kind === "event") {
    if (item.all_day) return m.calendar_all_day();
    return isoToTimeLocalValue(item.start_at) || "—";
  }
  if (item.kind === "task") {
    const start = isoToTimeLocalValue(item.start_at ?? item.due_at);
    const due = isoToTimeLocalValue(item.due_at);
    if (item.start_at && item.start_at !== item.due_at && start && due && start !== due) {
      return `${start}–${due}`;
    }
    return due || "—";
  }
  return isoToTimeLocalValue(item.start_at) || "—";
}

export function AgendaList({
  day,
  items,
  onOpenEvent,
  onOpenTask,
  onOpenProject,
  onEditEvent,
}: AgendaListProps) {
  const dayItems = items.filter((item) => {
    if (item.kind === "event") {
      const start = dayKeyFromIso(item.start_at);
      const end = dayKeyFromIso(item.end_at ?? item.start_at);
      return start <= day && day <= end;
    }
    if (item.kind === "task") {
      const start = dayKeyFromIso(item.start_at ?? item.due_at);
      const end = dayKeyFromIso(item.due_at);
      return start <= day && day <= end;
    }
    const start = dayKeyFromIso(item.start_at ?? "");
    const end = dayKeyFromIso(item.end_at ?? item.start_at ?? "");
    if (!start) return false;
    return start <= day && day <= (end || start);
  });

  if (dayItems.length === 0) {
    return <p className="text-sm text-muted-foreground px-1 py-4">{m.calendar_agenda_empty()}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {dayItems.map((item) => (
        <li
          key={
            item.kind === "task"
              ? `${item.kind}-${item.id}-${item.due_at}-${item.virtual ? "v" : "l"}`
              : `${item.kind}-${item.id}`
          }
        >
          <Button
            type="button"
            variant="outline"
            className={cn("h-auto w-full justify-start gap-3 px-3 py-2 text-left")}
            onPress={() => {
              if (item.kind === "event") onEditEvent(item.id);
              else if (item.kind === "task") onOpenTask(item.id);
              else onOpenProject();
            }}
          >
            <span className="w-12 shrink-0 text-xs text-muted-foreground">{itemTime(item)}</span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                item.kind === "event" && "bg-primary/15 text-primary",
                item.kind === "task" && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                item.kind === "project" && "bg-sky-500/15 text-sky-700 dark:text-sky-300",
              )}
            >
              {kindLabel(item.kind)}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
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
      ))}
    </ul>
  );
}
