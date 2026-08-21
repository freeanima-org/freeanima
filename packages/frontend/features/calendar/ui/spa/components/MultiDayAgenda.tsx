import type { CalendarRangeItem } from "../lib/api.ts";
import { dayHeadingLabel } from "../lib/format-calendar.ts";
import { AgendaDayView } from "./AgendaDayView.tsx";

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
      {days.map((day) => (
        <section key={day} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            {dayHeadingLabel(day, today)}
          </h2>
          <AgendaDayView day={day} today={today} items={items} {...handlers} />
        </section>
      ))}
    </div>
  );
}
