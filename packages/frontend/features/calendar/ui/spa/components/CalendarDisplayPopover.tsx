import { Button, Checkbox, cn, Popover, PopoverDialog, PopoverTrigger } from "@freeanima/ui-kit";
import { ModalSheetPresent } from "@freeanima/ui-kit/composite";
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

export type CalendarDisplayControlsProps = {
  compact: boolean;
  kinds: CalendarKindPref[];
  builtinSources: BuiltinCalendarSourceId[];
  expandRecurrence: boolean;
  showCompleted: boolean;
  showEndedEvents: boolean;
  onToggleKind: (kind: CalendarKindPref) => void;
  onToggleSource: (source: BuiltinCalendarSourceId) => void;
  onToggleExpandRecurrence: (next: boolean) => void;
  onToggleShowCompleted: (next: boolean) => void;
  onToggleShowEndedEvents: (next: boolean) => void;
};

type CalendarDisplayPopoverProps = CalendarDisplayControlsProps & {
  toggleSize: "default" | "sm";
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

/** 显示开关面板（Popover / Sheet 共用） */
export function CalendarDisplayControls({
  compact,
  kinds,
  builtinSources,
  expandRecurrence,
  showCompleted,
  showEndedEvents,
  onToggleKind,
  onToggleSource,
  onToggleExpandRecurrence,
  onToggleShowCompleted,
  onToggleShowEndedEvents,
}: CalendarDisplayControlsProps) {
  return (
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
      <section className="flex flex-col gap-0.5 border-border/60 border-t pt-2">
        <SectionLabel>本视图</SectionLabel>
        <ToggleRow
          compact={compact}
          label="重复展开"
          selected={expandRecurrence}
          onChange={onToggleExpandRecurrence}
        />
        <ToggleRow
          compact={compact}
          label="显示已完成任务"
          selected={showCompleted}
          onChange={onToggleShowCompleted}
        />
        <ToggleRow
          compact={compact}
          label="显示已过期事件"
          selected={showEndedEvents}
          onChange={onToggleShowEndedEvents}
        />
      </section>
    </div>
  );
}

/** 桌面：锚定 Popover 触发钮 */
export function CalendarDisplayPopover({ toggleSize, ...controls }: CalendarDisplayPopoverProps) {
  return (
    <PopoverTrigger>
      <Button
        type="button"
        size={toggleSize}
        variant="outline"
        className={cn("min-w-20", controls.compact && "min-h-11")}
        aria-label="显示内容"
      >
        显示
        <ChevronDown className="size-4" />
      </Button>
      <Popover placement="bottom start" className="w-56 p-2">
        <PopoverDialog>
          <CalendarDisplayControls {...controls} />
        </PopoverDialog>
      </Popover>
    </PopoverTrigger>
  );
}

/** 窄布局：底部 Sheet，由「更多」菜单打开 */
export function CalendarDisplaySheet({
  open,
  onClose,
  ...controls
}: CalendarDisplayControlsProps & {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <ModalSheetPresent open={open} onClose={onClose} aria-label="显示内容" showCloseButton>
      <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
        <h2 className="text-sm font-medium">显示</h2>
        <CalendarDisplayControls {...controls} />
      </div>
    </ModalSheetPresent>
  );
}
