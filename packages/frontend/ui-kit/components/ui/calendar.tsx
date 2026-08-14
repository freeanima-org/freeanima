import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  Calendar as AriaCalendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader as AriaCalendarGridHeader,
  CalendarHeaderCell,
  CalendarHeading,
  type CalendarCellRenderProps,
  type CalendarProps,
  type DateValue,
} from "react-aria-components";
import type { CalendarDate } from "@internationalized/date";

import { cn } from "../../lib/utils.ts";
import { Button } from "./button.tsx";

function Calendar<T extends DateValue>({
  className,
  ...props
}: Omit<CalendarProps<T>, "visibleDuration" | "className"> & {
  className?: string;
}) {
  return (
    <AriaCalendar
      {...props}
      data-slot="calendar"
      className={cn(
        "group/calendar bg-background w-fit p-2 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(7)]",
        className,
      )}
    >
      <div className="relative flex flex-col gap-4">
        <header className="absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1">
          <Button
            variant="ghost"
            slot="previous"
            className="size-(--cell-size) p-0 select-none aria-disabled:opacity-50"
            aria-label="上个月"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            slot="next"
            className="size-(--cell-size) p-0 select-none aria-disabled:opacity-50"
            aria-label="下个月"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </header>
        <div className="flex w-full flex-col gap-4">
          <div className="flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)">
            <CalendarHeading className="text-sm font-medium select-none" />
          </div>
          <CalendarGrid className="w-full border-collapse">
            <AriaCalendarGridHeader>
              {(day: string) => (
                <CalendarHeaderCell className="text-muted-foreground rounded-(--cell-radius) text-[0.8rem] font-normal select-none">
                  {day}
                </CalendarHeaderCell>
              )}
            </AriaCalendarGridHeader>
            <CalendarGridBody>
              {(date: CalendarDate) => (
                <CalendarCell
                  date={date}
                  className={(rp: CalendarCellRenderProps) =>
                    cn(
                      "group/day relative mt-2 aspect-square h-full w-full cursor-default p-0 text-center select-none",
                      rp.isToday && "bg-muted text-foreground rounded-(--cell-radius)",
                      rp.isUnavailable && "text-muted-foreground opacity-50 [&>div]:line-through",
                      rp.isDisabled && "text-muted-foreground opacity-50",
                      rp.isOutsideMonth && "text-muted-foreground",
                    )
                  }
                >
                  {(rp: CalendarCellRenderProps) => (
                    <div
                      data-selected={rp.isSelected || undefined}
                      className={cn(
                        "relative isolate z-10 flex aspect-square h-full w-full min-w-(--cell-size) flex-col items-center justify-center gap-1 rounded-(--cell-radius) border-0 text-sm leading-none font-normal",
                        "group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border group-data-[focused=true]/day:ring-[3px]",
                        "hover:bg-muted hover:text-foreground",
                        "data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:hover:bg-primary data-[selected]:hover:text-primary-foreground",
                      )}
                    >
                      {rp.formattedDate}
                    </div>
                  )}
                </CalendarCell>
              )}
            </CalendarGridBody>
          </CalendarGrid>
        </div>
      </div>
    </AriaCalendar>
  );
}

export { Calendar };
export type { DateValue };
