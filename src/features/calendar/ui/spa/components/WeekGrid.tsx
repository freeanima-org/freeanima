import { useMemo } from "react";
import { cn } from "@freeanima/ui-kit";

import type { CalendarRangeItem } from "../lib/api.ts";
import { dayKeyFromIso } from "../lib/format-calendar.ts";

export type WeekGridProps = {
  weekStartDay: string;
  today: string;
  items: CalendarRangeItem[];
  expandRecurrence: boolean;
  onSelectDay: (day: string) => void;
  onOpenTask: (id: number) => void;
  onDropTaskDue: (taskId: number, day: string) => void;
};

function addDays(day: string, delta: number): string {
  const parts = day.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const mo = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const next = new Date(Date.UTC(y, mo - 1, d + delta));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

/** 周一为一周起点（CST 日键） */
export function weekStartMonday(day: string): string {
  const parts = day.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const mo = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay(); // 0=Sun
  const offset = wd === 0 ? -6 : 1 - wd;
  return addDays(day, offset);
}

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

export function WeekGrid({
  weekStartDay,
  today,
  items,
  expandRecurrence,
  onSelectDay,
  onOpenTask,
  onDropTaskDue,
}: WeekGridProps) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStartDay, i)),
    [weekStartDay],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarRangeItem[]>();
    for (const day of days) map.set(day, []);
    for (const item of items) {
      if (item.kind === "task") {
        if (item.virtual && !expandRecurrence) continue;
        const day = dayKeyFromIso(item.due_at);
        map.get(day)?.push(item);
        continue;
      }
      if (item.kind === "event") {
        const day = dayKeyFromIso(item.start_at);
        map.get(day)?.push(item);
        continue;
      }
      const start = dayKeyFromIso(item.start_at ?? "");
      if (start) map.get(start)?.push(item);
    }
    return map;
  }, [days, expandRecurrence, items]);

  return (
    <div className="grid min-h-[16rem] grid-cols-7 gap-1">
      {days.map((day, idx) => {
        const col = byDay.get(day) ?? [];
        const isToday = day === today;
        return (
          <div
            key={day}
            className={cn(
              "flex min-h-0 flex-col rounded-md border border-border/50 p-1",
              isToday && "ring-1 ring-primary/40",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData("application/x-freeanima-task-id");
              const id = Number(raw);
              if (Number.isFinite(id) && id > 0) onDropTaskDue(id, day);
            }}
          >
            <button
              type="button"
              className="mb-1 flex items-baseline justify-between px-0.5 text-left text-xs"
              onClick={() => onSelectDay(day)}
            >
              <span className="text-muted-foreground">{WEEKDAY_LABELS[idx]}</span>
              <span className={cn("font-medium", isToday && "text-primary")}>{day.slice(8)}</span>
            </button>
            <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto">
              {col.map((item) => {
                if (item.kind === "task") {
                  return (
                    <li key={`${item.id}:${item.due_at}:${item.virtual ? "v" : "l"}`}>
                      <button
                        type="button"
                        draggable={!item.virtual && item.status === "pending"}
                        onDragStart={(e) => {
                          if (item.virtual) return;
                          e.dataTransfer.setData(
                            "application/x-freeanima-task-id",
                            String(item.id),
                          );
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        className={cn(
                          "w-full truncate rounded px-1 py-0.5 text-left text-[11px]",
                          item.virtual
                            ? "bg-muted/60 text-muted-foreground italic"
                            : "bg-primary/10 text-foreground",
                        )}
                        onClick={() => onOpenTask(item.id)}
                        title={item.virtual ? `${item.title}（重复实例）` : item.title}
                      >
                        {item.title}
                      </button>
                    </li>
                  );
                }
                return (
                  <li
                    key={`${item.kind}:${item.id}`}
                    className="truncate rounded bg-muted/50 px-1 py-0.5 text-[11px]"
                    title={item.title}
                  >
                    {item.title}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
