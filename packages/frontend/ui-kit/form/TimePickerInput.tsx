import type { MouseEvent } from "react";

import { Input } from "../components/ui/input.tsx";

function openNativePicker(event: MouseEvent<HTMLInputElement>): void {
  const input = event.currentTarget;
  if (typeof input.showPicker !== "function") return;
  try {
    input.showPicker();
  } catch {
    // ignore
  }
}

type TimePickerInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function TimePickerInput({
  value,
  onChange,
  disabled,
  className,
  "aria-label": ariaLabel,
}: TimePickerInputProps) {
  return (
    <Input
      type="time"
      className={className}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={openNativePicker}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
