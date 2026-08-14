import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "../components/ui/button.tsx";
import { cn } from "../lib/utils.ts";

export type YearPickerPanelProps = {
  /** `YYYY-01-01` 或空 */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  onSelect?: () => void;
};

const YEARS_PER_PAGE = 12;

function parseYear(value: string): number | null {
  const m = /^(\d{4})(?:-\d{2}(?:-\d{2})?)?$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  return Number.isFinite(year) ? year : null;
}

export function yearPeriodStart(year: number): string {
  return `${year}-01-01`;
}

function pageStart(year: number): number {
  return Math.floor(year / YEARS_PER_PAGE) * YEARS_PER_PAGE;
}

export function YearPickerPanel({
  value,
  onChange,
  disabled = false,
  className,
  onSelect,
}: YearPickerPanelProps) {
  const selectedYear = parseYear(value);
  const nowYear = useMemo(() => new Date().getFullYear(), []);
  const [viewStart, setViewStart] = useState(() => pageStart(selectedYear ?? nowYear));
  const years = Array.from({ length: YEARS_PER_PAGE }, (_, i) => viewStart + i);
  const viewEnd = viewStart + YEARS_PER_PAGE - 1;

  return (
    <div className={cn("flex w-[17.5rem] flex-col gap-2 p-2", className)}>
      <div className="relative flex h-9 items-center justify-between gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          isDisabled={disabled}
          aria-label="上一组年份"
          onClick={() => setViewStart((y) => y - YEARS_PER_PAGE)}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="text-sm font-medium select-none">
          {viewStart}–{viewEnd}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          isDisabled={disabled}
          aria-label="下一组年份"
          onClick={() => setViewStart((y) => y + YEARS_PER_PAGE)}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {years.map((year) => {
          const isSelected = selectedYear === year;
          const isCurrent = nowYear === year;
          return (
            <Button
              key={year}
              type="button"
              variant={isSelected ? "default" : "ghost"}
              size="sm"
              isDisabled={disabled}
              aria-label={`${year}年`}
              aria-pressed={isSelected}
              className={cn("h-9 font-normal", !isSelected && isCurrent && "bg-muted")}
              onClick={() => {
                onChange(yearPeriodStart(year));
                onSelect?.();
              }}
            >
              {year}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
