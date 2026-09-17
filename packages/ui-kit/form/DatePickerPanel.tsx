import { parseDate, type CalendarDate } from "@internationalized/date";

import { Button } from "../components/ui/button.tsx";
import { Calendar } from "../components/ui/calendar.tsx";
import { dateLocalPresets } from "../lib/datetime-local.ts";
import { cn } from "../lib/utils.ts";

export type DatePickerPanelProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  /** 选中后回调（用于关闭弹层） */
  onSelect?: () => void;
};

function toCalendarDate(value: string): CalendarDate | null {
  if (!value) return null;
  try {
    return parseDate(value);
  } catch {
    return null;
  }
}

export function DatePickerPanel({
  value,
  onChange,
  disabled = false,
  className,
  onSelect,
}: DatePickerPanelProps) {
  const selected = toCalendarDate(value);
  const presets = dateLocalPresets();

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap gap-1 px-1 pt-1">
        {presets.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant="outline"
            size="sm"
            isDisabled={disabled}
            aria-label={preset.label}
            onClick={() => {
              onChange(preset.value);
              onSelect?.();
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <Calendar
        aria-label="选择日期"
        value={selected}
        isDisabled={disabled}
        onChange={(next) => {
          if (!next) return;
          onChange(next.toString());
          onSelect?.();
        }}
      />
    </div>
  );
}
