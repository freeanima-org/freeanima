import { Button, cn } from "@freeanima/ui-kit";

import { buildMonthGrid } from "../lib/format-calendar.ts";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

type MonthGridProps = {
  year: number;
  monthIndex: number;
  selectedDay: string;
  today: string;
  dayCounts: Map<string, number>;
  onSelectDay: (day: string) => void;
};

export function MonthGrid({
  year,
  monthIndex,
  selectedDay,
  today,
  dayCounts,
  onSelectDay,
}: MonthGridProps) {
  const cells = buildMonthGrid(year, monthIndex);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`pad-${idx}`} className="aspect-square" />;
          }
          const count = dayCounts.get(day) ?? 0;
          const isSelected = day === selectedDay;
          const isToday = day === today;
          return (
            <Button
              key={day}
              type="button"
              variant={isSelected ? "default" : "ghost"}
              className={cn(
                "relative aspect-square h-auto min-h-0 flex-col gap-0.5 p-1 text-sm",
                isToday && !isSelected && "ring-1 ring-primary/40",
              )}
              onPress={() => onSelectDay(day)}
            >
              <span>{Number(day.slice(8, 10))}</span>
              {count > 0 ? (
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    isSelected ? "bg-primary-foreground" : "bg-primary",
                  )}
                  aria-hidden
                />
              ) : null}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
