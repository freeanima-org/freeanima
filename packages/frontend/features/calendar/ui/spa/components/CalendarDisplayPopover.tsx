import { Button, Checkbox, Popover, PopoverDialog, PopoverTrigger, cn } from "@freeanima/ui-kit";
import { ChevronDown } from "lucide-react";

import {
  BUILTIN_SOURCE_OPTIONS,
  type BuiltinCalendarSourceId,
  type CalendarKindPref,
} from "../lib/calendar-prefs.ts";

const KIND_OPTIONS: { id: CalendarKindPref; title: string }[] = [
  { id: "event", title: "事件" },
  { id: "task", title: "任务" },
  { id: "project", title: "项目" },
];

type CalendarDisplayPopoverProps = {
  compact: boolean;
  toggleSize: "default" | "sm";
  kinds: CalendarKindPref[];
  builtinSources: BuiltinCalendarSourceId[];
  expandRecurrence: boolean;
  onToggleKind: (kind: CalendarKindPref) => void;
  onToggleSource: (source: BuiltinCalendarSourceId) => void;
  onToggleExpandRecurrence: (next: boolean) => void;
};

function SectionLabel({ children }: { children: string }) {
  return <p className="text-muted-foreground px-1 text-xs font-medium">{children}</p>;
}

function ToggleRow({
  compact,
  label,
  selected,
  onChange,
}: {
  compact: boolean;
  label: string;
  selected: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 text-sm",
        compact ? "min-h-11" : "min-h-8",
      )}
    >
      <Checkbox isSelected={selected} onChange={onChange} aria-label={label} />
      <span className="min-w-0 flex-1">{label}</span>
    </label>
  );
}

export function CalendarDisplayPopover({
  compact,
  toggleSize,
  kinds,
  builtinSources,
  expandRecurrence,
  onToggleKind,
  onToggleSource,
  onToggleExpandRecurrence,
}: CalendarDisplayPopoverProps) {
  return (
    <PopoverTrigger>
      <Button
        type="button"
        size={toggleSize}
        variant="outline"
        className={cn("min-w-20", compact && "min-h-11")}
        aria-label="显示内容"
      >
        显示
        <ChevronDown className="size-4" />
      </Button>
      <Popover placement="bottom start" className="w-56 p-2">
        <PopoverDialog>
          <div className="flex flex-col gap-3">
            <section className="flex flex-col gap-0.5">
              <SectionLabel>条目</SectionLabel>
              {KIND_OPTIONS.map((kind) => (
                <ToggleRow
                  key={kind.id}
                  compact={compact}
                  label={kind.title}
                  selected={kinds.includes(kind.id)}
                  onChange={() => onToggleKind(kind.id)}
                />
              ))}
            </section>
            <section className="flex flex-col gap-0.5">
              <SectionLabel>内置日历</SectionLabel>
              {BUILTIN_SOURCE_OPTIONS.map((source) => (
                <ToggleRow
                  key={source.id}
                  compact={compact}
                  label={source.title}
                  selected={builtinSources.includes(source.id)}
                  onChange={() => onToggleSource(source.id)}
                />
              ))}
            </section>
            <div className="border-border/60 border-t pt-2">
              <ToggleRow
                compact={compact}
                label="重复展开"
                selected={expandRecurrence}
                onChange={onToggleExpandRecurrence}
              />
            </div>
          </div>
        </PopoverDialog>
      </Popover>
    </PopoverTrigger>
  );
}
