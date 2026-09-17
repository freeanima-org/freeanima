import { useMemo } from "react";
import { cn } from "@freeanima/ui-kit";

import type { CalendarRangeItem } from "../lib/api.ts";
import {
  MAX_VISIBLE_BAR_LANES,
  barItemKey,
  dayOverflowCount,
  kindBarClass,
  packBarsForWeek,
  type PackedBar,
} from "../lib/event-bars.ts";
import { buildMonthGrid } from "../lib/format-calendar.ts";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

type MonthGridProps = {
  year: number;
  monthIndex: number;
  selectedDay: string;
  today: string;
  items: CalendarRangeItem[];
  onSelectDay: (day: string) => void;
  onOpenEvent: (id: number) => void;
  onOpenTask: (id: number) => void;
  onOpenProject: (id: number) => void;
  onOpenHoliday: (item: Extract<CalendarRangeItem, { kind: "holiday" }>) => void;
  onOpenHabit?: (id: number) => void;
};

function chunkWeeks(cells: (string | null)[]): (string | null)[][] {
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function openBar(
  bar: PackedBar,
  handlers: Pick<
    MonthGridProps,
    "onOpenEvent" | "onOpenTask" | "onOpenProject" | "onOpenHoliday" | "onOpenHabit"
  >,
): void {
  if (bar.item.kind === "event") handlers.onOpenEvent(bar.item.id);
  else if (bar.item.kind === "task") handlers.onOpenTask(bar.item.id);
  else if (bar.item.kind === "holiday") handlers.onOpenHoliday(bar.item);
  else if (bar.item.kind === "habit") handlers.onOpenHabit?.(bar.item.id);
  else handlers.onOpenProject(bar.item.id);
}

export function MonthGrid({
  year,
  monthIndex,
  selectedDay,
  today,
  items,
  onSelectDay,
  onOpenEvent,
  onOpenTask,
  onOpenProject,
  onOpenHoliday,
  onOpenHabit,
}: MonthGridProps) {
  const weeks = useMemo(() => chunkWeeks(buildMonthGrid(year, monthIndex)), [monthIndex, year]);
  const handlers = {
    onOpenEvent,
    onOpenTask,
    onOpenProject,
    onOpenHoliday,
    ...(onOpenHabit != null ? { onOpenHabit } : {}),
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {weeks.map((weekDays, weekIdx) => {
          const packed = packBarsForWeek(items, weekDays);
          const visible = packed.filter((b) => b.lane < MAX_VISIBLE_BAR_LANES);
          const laneCount = Math.max(
            1,
            Math.min(
              MAX_VISIBLE_BAR_LANES,
              visible.reduce((m, b) => Math.max(m, b.lane + 1), 0),
            ),
          );
          const hasOverflow = weekDays.some(
            (_, col) => dayOverflowCount(packed, col, MAX_VISIBLE_BAR_LANES) > 0,
          );

          return (
            <div key={`week-${weekIdx}`} className="rounded-md border border-border/40 p-1">
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day, col) => {
                  if (!day) {
                    return <div key={`pad-${weekIdx}-${col}`} className="h-7" />;
                  }
                  const isSelected = day === selectedDay;
                  const isToday = day === today;
                  return (
                    <button
                      key={day}
                      type="button"
                      className={cn(
                        "flex h-7 items-center justify-center rounded-md text-sm",
                        isSelected && "bg-primary text-primary-foreground",
                        isToday && !isSelected && "ring-1 ring-primary/40",
                        !isSelected && "hover:bg-muted/60",
                      )}
                      onClick={() => onSelectDay(day)}
                    >
                      {Number(day.slice(8, 10))}
                    </button>
                  );
                })}
              </div>
              <div
                className="relative mt-0.5 grid grid-cols-7 gap-x-1"
                style={{
                  gridTemplateRows: `repeat(${laneCount}, 1.15rem)${hasOverflow ? " 0.9rem" : ""}`,
                  minHeight: `${laneCount * 1.15 + (hasOverflow ? 0.9 : 0)}rem`,
                }}
              >
                {/* 点击空白选日：透明列 */}
                {weekDays.map((day, col) => (
                  <button
                    key={`hit-${weekIdx}-${col}`}
                    type="button"
                    disabled={!day}
                    aria-label={day ? `选择 ${day}` : undefined}
                    className="row-span-full min-h-0"
                    style={{ gridColumn: col + 1, gridRow: "1 / -1" }}
                    onClick={() => {
                      if (day) onSelectDay(day);
                    }}
                  />
                ))}
                {visible.map((bar) => (
                  <button
                    key={`${weekIdx}:${bar.colStart}:${bar.colSpan}:${bar.lane}:${barItemKey(bar.item)}`}
                    type="button"
                    title={bar.item.title}
                    className={cn(
                      "z-[1] flex items-center gap-1 truncate rounded px-1 text-left text-[10px] leading-[1.15rem]",
                      kindBarClass(
                        bar.item.kind,
                        bar.item.kind === "task" && bar.item.virtual
                          ? { virtual: true }
                          : bar.item.kind === "task" && bar.item.status === "completed"
                            ? { completed: true }
                            : undefined,
                      ),
                    )}
                    style={{
                      gridColumn: `${bar.colStart + 1} / span ${bar.colSpan}`,
                      gridRow: bar.lane + 1,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const day = weekDays[bar.colStart];
                      if (day) onSelectDay(day);
                      openBar(bar, handlers);
                    }}
                  >
                    <span className="min-w-0 truncate">{bar.item.title}</span>
                  </button>
                ))}
                {weekDays.map((day, col) => {
                  const overflow = dayOverflowCount(packed, col, MAX_VISIBLE_BAR_LANES);
                  if (!day || overflow <= 0) return null;
                  return (
                    <button
                      key={`more-${day}`}
                      type="button"
                      className="z-[1] text-left text-[10px] text-muted-foreground"
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
          );
        })}
      </div>
    </div>
  );
}
