import { parseDate, type CalendarDate } from "@internationalized/date";
import { useCallback, type PointerEvent as ReactPointerEvent } from "react";
import type { DateRange } from "react-aria-components";

import { RangeCalendar } from "../components/ui/calendar.tsx";
import { cn } from "../lib/utils.ts";

export type DateRangeValue = {
  start: string;
  end: string;
};

export type DateRangePickerPanelProps = {
  value: DateRangeValue | null;
  onChange: (value: DateRangeValue) => void;
  disabled?: boolean;
  className?: string;
  /** 完整区间选定后回调（用于关闭弹层） */
  onSelect?: () => void;
  "aria-label"?: string;
};

function toCalendarDate(value: string): CalendarDate | null {
  if (!value) return null;
  try {
    return parseDate(value);
  } catch {
    return null;
  }
}

function toDateRange(value: DateRangeValue | null): DateRange | null {
  if (!value?.start || !value?.end) return null;
  const start = toCalendarDate(value.start);
  const end = toCalendarDate(value.end);
  if (!start || !end) return null;
  return { start, end };
}

/**
 * 对齐 react-day-picker `addToRange`（shadcn Range Picker 默认行为）：
 * - 空选区：点选即成同日区间
 * - 已完整：点开始之前 → 扩展 start；点开始之后（含区间内/结束之后）→ 更新 end
 */
function addToRange(date: CalendarDate, initial: DateRangeValue | null): DateRangeValue {
  const from = initial?.start ? toCalendarDate(initial.start) : null;
  const to = initial?.end ? toCalendarDate(initial.end) : null;

  if (!from && !to) {
    const day = date.toString();
    return { start: day, end: day };
  }

  if (from && !to) {
    if (date.compare(from) === 0) {
      return { start: from.toString(), end: from.toString() };
    }
    if (date.compare(from) < 0) {
      return { start: date.toString(), end: from.toString() };
    }
    return { start: from.toString(), end: date.toString() };
  }

  if (from && to) {
    if (date.compare(from) === 0 && date.compare(to) === 0) {
      return { start: from.toString(), end: to.toString() };
    }
    if (date.compare(from) === 0) {
      return { start: from.toString(), end: date.toString() };
    }
    if (date.compare(to) === 0) {
      return { start: date.toString(), end: date.toString() };
    }
    if (date.compare(from) < 0) {
      // 开始之前 → 扩大起点，保留终点
      return { start: date.toString(), end: to.toString() };
    }
    // 开始之后（区间内或结束之后）→ 更新终点
    return { start: from.toString(), end: date.toString() };
  }

  const day = date.toString();
  return { start: day, end: day };
}

export function DateRangePickerPanel({
  value,
  onChange,
  disabled = false,
  className,
  onSelect,
  "aria-label": ariaLabel = "选择日期区间",
}: DateRangePickerPanelProps) {
  const selected = toDateRange(value);

  const commit = useCallback(
    (next: DateRangeValue) => {
      onChange(next);
      onSelect?.();
    },
    [onChange, onSelect],
  );

  /** 拦截指针选日，避免 React Aria 在完整区间后再点变成「重开选区」 */
  const onPointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const dayEl = target.closest("[data-day]");
      if (!(dayEl instanceof HTMLElement)) return;
      const dayStr = dayEl.dataset.day;
      if (!dayStr) return;
      const date = toCalendarDate(dayStr);
      if (!date) return;
      event.preventDefault();
      event.stopPropagation();
      commit(addToRange(date, value));
    },
    [commit, disabled, value],
  );

  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      onPointerDownCapture={onPointerDownCapture}
    >
      <RangeCalendar
        aria-label={ariaLabel}
        value={selected}
        isDisabled={disabled}
        onChange={(next) => {
          // 键盘等路径仍走 Aria；对齐为完整区间写出
          if (!next?.start || !next?.end) return;
          commit({
            start: next.start.toString(),
            end: next.end.toString(),
          });
        }}
      />
    </div>
  );
}
