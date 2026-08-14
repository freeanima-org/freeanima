import { useState } from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "../components/ui/button.tsx";
import { Popover, PopoverDialog, PopoverTrigger } from "../components/ui/popover.tsx";
import { Sheet } from "../components/ui/sheet.tsx";
import { useCompactLayout } from "../layout/index.ts";
import { cn } from "../lib/utils.ts";
import { DatePickerPanel } from "./DatePickerPanel.tsx";

type DatePickerInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  /**
   * `trigger`：按钮打开 Popover（expanded）或底部 Sheet（compact）。
   * `inline`：直接渲染面板（已在 Popover 内时避免嵌套）。
   */
  presentation?: "trigger" | "inline";
};

function formatTriggerLabel(value: string, fallback: string): string {
  if (!value) return fallback;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return `${y}年${m}月${d}日`;
}

export function DatePickerInput({
  value,
  onChange,
  disabled = false,
  className,
  "aria-label": ariaLabel,
  presentation = "trigger",
}: DatePickerInputProps) {
  const compact = useCompactLayout();
  const [open, setOpen] = useState(false);
  const label = ariaLabel ?? "选择日期";

  if (presentation === "inline") {
    return (
      <DatePickerPanel
        {...(className !== undefined ? { className } : {})}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  const close = () => setOpen(false);

  const trigger = (
    <Button
      type="button"
      variant="outline"
      isDisabled={disabled}
      aria-label={label}
      className={cn(
        "border-input h-9 w-full justify-start gap-2 px-3 font-normal",
        !value && "text-muted-foreground",
        className,
      )}
      {...(compact
        ? {
            onClick: () => setOpen(true),
          }
        : {})}
    >
      <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
      <span className="truncate">{formatTriggerLabel(value, label)}</span>
    </Button>
  );

  const panel = (
    <DatePickerPanel value={value} disabled={disabled} onChange={onChange} onSelect={close} />
  );

  if (compact) {
    return (
      <>
        {trigger}
        <Sheet
          isOpen={open}
          onOpenChange={(next) => {
            if (!next) close();
          }}
          side="bottom"
          showCloseButton={false}
          aria-label={label}
          className="max-h-[85vh] gap-0 overflow-hidden rounded-t-2xl p-0 safe-area-pb"
        >
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-sm font-medium">{label}</span>
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                关闭
              </Button>
            </div>
            {panel}
          </div>
        </Sheet>
      </>
    );
  }

  return (
    <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
      {trigger}
      <Popover placement="bottom start" className="w-auto p-1">
        <PopoverDialog>{panel}</PopoverDialog>
      </Popover>
    </PopoverTrigger>
  );
}
