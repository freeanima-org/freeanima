import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  Calendar as AriaCalendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader as AriaCalendarGridHeader,
  CalendarHeaderCell,
  CalendarHeading,
  RangeCalendar as AriaRangeCalendar,
  type CalendarCellRenderProps,
  type CalendarProps,
  type DateRange,
  type DateValue,
  type RangeCalendarProps,
} from "react-aria-components";
import type { CalendarDate, DateDuration } from "@internationalized/date";
import type { ReactNode } from "react";

import { cn } from "../../lib/utils.ts";
import { Button } from "./button.tsx";

function CalendarNavButtons() {
  return (
    <header className="absolute inset-x-0 top-0 z-10 flex w-full items-center justify-between gap-1">
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
  );
}

function CalendarChrome({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex flex-col gap-4">
      <CalendarNavButtons />
      <div className="flex w-full flex-col gap-4">
        <div className="flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)">
          <CalendarHeading className="text-sm font-medium select-none" />
        </div>
        {children}
      </div>
    </div>
  );
}

function dayCellClassName(rp: CalendarCellRenderProps, range: boolean): string {
  const isRangeMiddle = range && rp.isSelected && !rp.isSelectionStart && !rp.isSelectionEnd;
  return cn(
    "group/day relative mt-2 aspect-square h-full w-full cursor-default p-0 text-center select-none",
    rp.isToday && !rp.isSelected && "bg-muted text-foreground rounded-(--cell-radius)",
    rp.isUnavailable && "text-muted-foreground opacity-50 [&>div]:line-through",
    rp.isDisabled && "text-muted-foreground opacity-50",
    rp.isOutsideMonth && "text-muted-foreground",
    range && rp.isSelectionStart && "rounded-l-(--cell-radius)",
    range && rp.isSelectionEnd && "rounded-r-(--cell-radius)",
    isRangeMiddle && "rounded-none",
  );
}

function dayButtonClassName(rp: CalendarCellRenderProps, range: boolean): string {
  const isRangeMiddle = range && rp.isSelected && !rp.isSelectionStart && !rp.isSelectionEnd;
  const isRangeEdge = range && (rp.isSelectionStart || rp.isSelectionEnd);
  return cn(
    "relative isolate z-10 flex aspect-square h-full w-full min-w-(--cell-size) flex-col items-center justify-center gap-1 border-0 text-sm leading-none font-normal",
    "group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border group-data-[focused=true]/day:ring-[3px]",
    "hover:bg-muted hover:text-foreground",
    !range &&
      "data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:hover:bg-primary data-[selected]:hover:text-primary-foreground",
    range &&
      isRangeEdge &&
      "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
    range && rp.isSelectionStart && "rounded-l-(--cell-radius)",
    range && rp.isSelectionEnd && "rounded-r-(--cell-radius)",
    isRangeMiddle && "rounded-none bg-muted text-foreground hover:bg-muted",
    !range && "rounded-(--cell-radius)",
  );
}

function CalendarGridBodyDays({ range, offset }: { range: boolean; offset?: DateDuration }) {
  return (
    <CalendarGrid className="w-full border-collapse" {...(offset !== undefined ? { offset } : {})}>
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
            className={(rp: CalendarCellRenderProps) => dayCellClassName(rp, range)}
          >
            {(rp: CalendarCellRenderProps) => (
              <div
                data-day={date.toString()}
                data-selected={rp.isSelected || undefined}
                data-range-start={rp.isSelectionStart || undefined}
                data-range-end={rp.isSelectionEnd || undefined}
                data-range-middle={
                  (range && rp.isSelected && !rp.isSelectionStart && !rp.isSelectionEnd) ||
                  undefined
                }
                className={dayButtonClassName(rp, range)}
              >
                {rp.formattedDate}
              </div>
            )}
          </CalendarCell>
        )}
      </CalendarGridBody>
    </CalendarGrid>
  );
}

function CalendarMonthPane({ range, offset }: { range: boolean; offset?: DateDuration }) {
  return (
    <div className="flex w-fit flex-col gap-4">
      <div className="flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)">
        <CalendarHeading
          className="text-sm font-medium select-none"
          {...(offset !== undefined ? { offset } : {})}
        />
      </div>
      <CalendarGridBodyDays range={range} {...(offset !== undefined ? { offset } : {})} />
    </div>
  );
}

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
      <CalendarChrome>
        <CalendarGridBodyDays range={false} />
      </CalendarChrome>
    </AriaCalendar>
  );
}

/** 区间日历：双月并排（对齐 shadcn Range Picker） */
function RangeCalendar<T extends DateValue>({
  className,
  ...props
}: Omit<RangeCalendarProps<T>, "visibleDuration" | "className" | "pageBehavior"> & {
  className?: string;
}) {
  return (
    <AriaRangeCalendar
      {...props}
      visibleDuration={{ months: 2 }}
      pageBehavior="single"
      data-slot="range-calendar"
      className={cn(
        "group/calendar bg-background w-fit p-2 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(7)]",
        className,
      )}
    >
      <div className="relative flex flex-col gap-4">
        <CalendarNavButtons />
        <div className="flex gap-4">
          <CalendarMonthPane range />
          <CalendarMonthPane range offset={{ months: 1 }} />
        </div>
      </div>
    </AriaRangeCalendar>
  );
}

export { Calendar, RangeCalendar };
export type { DateValue, DateRange };
