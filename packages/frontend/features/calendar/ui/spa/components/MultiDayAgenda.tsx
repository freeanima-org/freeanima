import type { ActionSheetItem } from "@freeanima/ui-kit/composite/types.ts";

import type { CalendarRangeItem } from "../lib/api.ts";
import { AgendaDayHeader } from "./AgendaDayHeader.tsx";
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
  onCreateEvent: (day: string) => void;
  onCreateTask: (day: string) => void;
  contextMenuEnabled?: boolean;
  useActionSheet?: boolean;
  contextMenuItemsForItem?: (item: CalendarRangeItem) => ActionSheetItem[];
  onOpenItemMenu?: (item: CalendarRangeItem) => void;
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
  onCreateEvent,
  onCreateTask,
  contextMenuEnabled,
  useActionSheet,
  contextMenuItemsForItem,
  onOpenItemMenu,
}: MultiDayAgendaProps) {
  const handlers = {
    onOpenEvent,
    onOpenTask,
    onOpenProject,
    onEditEvent,
    onOpenHoliday,
    ...(contextMenuEnabled !== undefined ? { contextMenuEnabled } : {}),
    ...(useActionSheet !== undefined ? { useActionSheet } : {}),
    ...(contextMenuItemsForItem != null ? { contextMenuItemsForItem } : {}),
    ...(onOpenItemMenu != null ? { onOpenItemMenu } : {}),
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto">
      {days.map((day) => (
        <section key={day} className="flex flex-col gap-2">
          <AgendaDayHeader
            day={day}
            today={today}
            onCreateEvent={onCreateEvent}
            onCreateTask={onCreateTask}
          />
          <AgendaDayView day={day} today={today} items={items} {...handlers} />
        </section>
      ))}
    </div>
  );
}
