import type { CalendarRangeItem } from "../lib/api.ts";
import { partitionAgendaDay } from "../lib/agenda-items.ts";
import { dayHeadingLabel } from "../lib/format-calendar.ts";
import { AgendaList } from "./AgendaList.tsx";

type MultiDayAgendaProps = {
  days: string[];
  today: string;
  items: CalendarRangeItem[];
  onOpenEvent: (id: number) => void;
  onOpenTask: (id: number) => void;
  onOpenProject: (id: number) => void;
  onEditEvent: (id: number) => void;
  onOpenHoliday: (item: Extract<CalendarRangeItem, { kind: "holiday" }>) => void;
};

export function MultiDayAgenda({
  days,
  today,
  items,
  onOpenEvent,
  onOpenTask,
  onOpenProject,
  onEditEvent,
  onOpenHoliday,
}: MultiDayAgendaProps) {
  const handlers = { onOpenEvent, onOpenTask, onOpenProject, onEditEvent, onOpenHoliday };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto">
      {days.map((day) => {
        const { overdue, dayItems } = partitionAgendaDay(items, day, today);
        return (
          <section key={day} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              {dayHeadingLabel(day, today)}
            </h2>
            {overdue.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-medium text-destructive">逾期</h3>
                <AgendaList items={overdue} showDueChip emptyLabel="无逾期任务" {...handlers} />
              </div>
            ) : null}
            {dayItems.length > 0 || overdue.length === 0 ? (
              <AgendaList items={dayItems} {...handlers} />
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
