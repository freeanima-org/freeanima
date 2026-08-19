import { useMemo } from "react";
import { cn } from "@freeanima/ui-kit";
import { PRIORITY_LABEL, priorityToneBg } from "@freeanima/ui-kit/lib/task-item-display.ts";

import type { CalendarRangeItem } from "../lib/api.ts";
import {
  MAX_VISIBLE_BAR_LANES,
  barItemKey,
  dayOverflowCount,
  kindBarClass,
  packBarsForWeek,
  type PackedBar,
} from "../lib/event-bars.ts";

export type WeekGridProps = {
  weekStartDay: string;
  today: string;
  items: CalendarRangeItem[];
  onSelectDay: (day: string) => void;
  onOpenEvent: (id: number) => void;
  onOpenTask: (id: number) => void;
  onOpenProject: (id: number) => void;
  onOpenHoliday: (item: Extract<CalendarRangeItem, { kind: "holiday" }>) => void;
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

function openBar(
  bar: PackedBar,
  handlers: Pick<WeekGridProps, "onOpenEvent" | "onOpenTask" | "onOpenProject" | "onOpenHoliday">,
): void {
  if (bar.item.kind === "event") handlers.onOpenEvent(bar.item.id);
  else if (bar.item.kind === "task") handlers.onOpenTask(bar.item.id);
  else if (bar.item.kind === "holiday") handlers.onOpenHoliday(bar.item);
  else handlers.onOpenProject(bar.item.id);
}

export function WeekGrid({
  weekStartDay,
  today,
  items,
  onSelectDay,
  onOpenEvent,
  onOpenTask,
  onOpenProject,
  onOpenHoliday,
  onDropTaskDue,
}: WeekGridProps) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStartDay, i)),
    [weekStartDay],
  );

  const packed = useMemo(() => packBarsForWeek(items, days), [days, items]);
  const visible = useMemo(() => packed.filter((b) => b.lane < MAX_VISIBLE_BAR_LANES), [packed]);
  const laneCount = Math.max(
    3,
    Math.min(
      MAX_VISIBLE_BAR_LANES,
      visible.reduce((m, b) => Math.max(m, b.lane + 1), 0),
    ),
  );
  const hasOverflow = days.some(
    (_, col) => dayOverflowCount(packed, col, MAX_VISIBLE_BAR_LANES) > 0,
  );
  const handlers = { onOpenEvent, onOpenTask, onOpenProject, onOpenHoliday };

  return (
    <div className="flex min-h-[16rem] flex-col gap-1">
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          const isToday = day === today;
          return (
            <button
              key={`head-${day}`}
              type="button"
              className={cn(
                "flex items-baseline justify-between rounded-md border border-border/50 px-1 py-1 text-left text-xs",
                isToday && "ring-1 ring-primary/40",
              )}
              onClick={() => onSelectDay(day)}
            >
              <span className="text-muted-foreground">{WEEKDAY_LABELS[idx]}</span>
              <span className={cn("font-medium", isToday && "text-primary")}>{day.slice(8)}</span>
            </button>
          );
        })}
      </div>

      <div className="relative min-h-0 flex-1 rounded-md border border-border/40 p-1">
        {/* 列级拖放目标 */}
        <div className="absolute inset-1 z-0 grid grid-cols-7 gap-1">
          {days.map((day) => (
            <div
              key={`drop-${day}`}
              className="min-h-full rounded-sm"
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
            />
          ))}
        </div>

        <div
          className="relative z-[1] grid grid-cols-7 gap-x-1"
          style={{
            gridTemplateRows: `repeat(${laneCount}, 1.35rem)${hasOverflow ? " 1rem" : ""}`,
          }}
        >
          {visible.map((bar) => {
            const item = bar.item;
            const canDrag = item.kind === "task" && !item.virtual && item.status === "pending";
            return (
              <button
                key={barItemKey(item)}
                type="button"
                title={
                  item.kind === "task" && item.virtual ? `${item.title}（重复实例）` : item.title
                }
                draggable={canDrag}
                onDragStart={(e) => {
                  if (!canDrag) return;
                  e.dataTransfer.setData("application/x-freeanima-task-id", String(item.id));
                  e.dataTransfer.effectAllowed = "move";
                }}
                className={cn(
                  "flex items-center gap-1 truncate rounded px-1 text-left text-[11px] leading-[1.35rem]",
                  kindBarClass(
                    item.kind,
                    item.kind === "task" && item.virtual ? { virtual: true } : undefined,
                  ),
                )}
                style={{
                  gridColumn: `${bar.colStart + 1} / span ${bar.colSpan}`,
                  gridRow: bar.lane + 1,
                }}
                onClick={() => {
                  const day = days[bar.colStart];
                  if (day) onSelectDay(day);
                  openBar(bar, handlers);
                }}
              >
                {item.kind === "task" ? (
                  <span
                    className={cn("size-1.5 shrink-0 rounded-full", priorityToneBg(item.priority))}
                    title={PRIORITY_LABEL[item.priority]}
                    aria-hidden
                  />
                ) : null}
                <span className="min-w-0 truncate">{item.title}</span>
              </button>
            );
          })}
          {days.map((day, col) => {
            const overflow = dayOverflowCount(packed, col, MAX_VISIBLE_BAR_LANES);
            if (overflow <= 0) return null;
            return (
              <button
                key={`more-${day}`}
                type="button"
                className="text-left text-[10px] text-muted-foreground"
                style={{
                  gridColumn: col + 1,
                  gridRow: laneCount + 1,
                }}
                onClick={() => onSelectDay(day)}
              >
                {`+${overflow}`}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
