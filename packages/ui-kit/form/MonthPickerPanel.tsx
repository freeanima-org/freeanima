import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "../components/ui/button.tsx";
import { cn } from "../lib/utils.ts";

export type MonthPickerPanelProps = {
  /** `YYYY-MM-01` 或空 */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  onSelect?: () => void;
};

const MONTH_LABELS = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseYearMonth(value: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

export function monthPeriodStart(year: number, month: number): string {
  return `${year}-${pad2(month)}-01`;
}

export function MonthPickerPanel({
  value,
  onChange,
  disabled = false,
  className,
  onSelect,
}: MonthPickerPanelProps) {
  const selected = parseYearMonth(value);
  const now = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(() => selected?.year ?? now.getFullYear());

  return (
    <div className={cn("flex w-[17.5rem] flex-col gap-2 p-2", className)}>
      <div className="relative flex h-9 items-center justify-between gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          isDisabled={disabled}
          aria-label="上一年"
          onClick={() => setViewYear((y) => y - 1)}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="text-sm font-medium select-none">{viewYear}年</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          isDisabled={disabled}
          aria-label="下一年"
          onClick={() => setViewYear((y) => y + 1)}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MONTH_LABELS.map((label, index) => {
          const month = index + 1;
          const isSelected = selected?.year === viewYear && selected.month === month;
          const isCurrent = now.getFullYear() === viewYear && now.getMonth() + 1 === month;
          return (
            <Button
              key={month}
              type="button"
              variant={isSelected ? "default" : "ghost"}
              size="sm"
              isDisabled={disabled}
              aria-label={`${viewYear}年${label}`}
              aria-pressed={isSelected}
              className={cn("h-9 font-normal", !isSelected && isCurrent && "bg-muted")}
              onClick={() => {
                onChange(monthPeriodStart(viewYear, month));
                onSelect?.();
              }}
            >
              {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
