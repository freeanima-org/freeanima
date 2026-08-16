import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { BellIcon, CalendarIcon, FlagIcon, RepeatIcon } from "lucide-react";

import { Button } from "../components/ui/button.tsx";
import { Checkbox } from "../components/ui/checkbox.tsx";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.tsx";
import { Popover, PopoverDialog, PopoverTrigger } from "../components/ui/popover.tsx";
import { Input } from "../components/ui/input.tsx";
import { Textarea } from "../components/ui/textarea.tsx";
import { DatePickerInput } from "../form/DatePickerInput.tsx";
import { TimePickerInput } from "../form/TimePickerInput.tsx";
import { cn } from "../lib/utils.ts";
import {
  formatDueChip,
  isoToDateLocalValue,
  isoToTimeLocalValue,
  mergeDateTimeLocal,
} from "../lib/datetime-local.ts";
import type {
  TaskItemDisplay,
  TaskItemPriority,
  TaskItemRecurrenceDisplay,
  TaskRecurrenceCalendar,
  TaskRecurrenceSkip,
} from "../lib/task-item-display.ts";
import { PRIORITY_LABEL, priorityToneBg, priorityToneText } from "../lib/task-item-display.ts";

export type TaskDetailFocusField = "title" | "content";

export type TaskDetailEditorProps<T extends TaskItemDisplay = TaskItemDisplay> = {
  item: T;
  onChange: (item: T) => void;
  titleExtra?: ReactNode;
  children?: ReactNode;
  /** compact peek：标题/描述激活时进入全屏编辑（pointer 优先，避免半屏先获焦双弹键盘） */
  onTextFieldActivate?: (field: TaskDetailFocusField) => void;
  /** compact immersive：挂载后聚焦的字段 */
  focusField?: TaskDetailFocusField;
};

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;

const FREQ_UNIT: Record<TaskItemRecurrenceDisplay["freq"], string> = {
  daily: "天",
  weekly: "周",
  monthly: "月",
  yearly: "年",
};

const SKIP_LABEL: Record<TaskRecurrenceSkip, string> = {
  none: "不跳过",
  weekend: "跳过周末",
  holiday: "跳过法定假日",
  weekend_and_holiday: "跳过周末和假日",
};

const RECURRENCE_PRESETS: Array<{
  id: string;
  label: string;
  build: (dueAt: string) => TaskItemRecurrenceDisplay | null;
}> = [
  { id: "none", label: "不重复", build: () => null },
  {
    id: "daily",
    label: "每天",
    build: (dueAt) => ({ freq: "daily", interval: 1, anchor: "due", schedule_at: dueAt }),
  },
  {
    id: "weekly",
    label: "每周",
    build: (dueAt) => ({ freq: "weekly", interval: 1, anchor: "due", schedule_at: dueAt }),
  },
  {
    id: "monthly",
    label: "每月",
    build: (dueAt) => ({ freq: "monthly", interval: 1, anchor: "due", schedule_at: dueAt }),
  },
  {
    id: "yearly",
    label: "每年",
    build: (dueAt) => ({ freq: "yearly", interval: 1, anchor: "due", schedule_at: dueAt }),
  },
];

type RemindPresetId = "at_due" | "5m" | "1h" | "1d" | "9am" | "custom";

const REMIND_ADD_PRESETS: Array<{ id: RemindPresetId; label: string }> = [
  { id: "at_due", label: "截止时" },
  { id: "5m", label: "提前 5 分钟" },
  { id: "1h", label: "提前 1 小时" },
  { id: "1d", label: "提前 1 天" },
  { id: "9am", label: "当天 09:00" },
];

function recurrenceLabel(recurrence: TaskItemRecurrenceDisplay | null | undefined): string {
  if (!recurrence) return "不重复";
  const preset = RECURRENCE_PRESETS.find(
    (p) =>
      p.id === recurrence.freq &&
      recurrence.interval === 1 &&
      !recurrence.weekdays?.length &&
      !recurrence.until &&
      (recurrence.skip ?? "none") === "none" &&
      !recurrence.workdays_only &&
      (recurrence.calendar ?? "gregorian") === "gregorian",
  );
  if (preset) return preset.label;
  const unit = FREQ_UNIT[recurrence.freq];
  let label = `每 ${recurrence.interval} ${unit}`;
  if (recurrence.weekdays?.length) {
    label += `（${recurrence.weekdays.map((d) => `周${WEEKDAY_LABELS[d]}`).join("、")}）`;
  }
  if (recurrence.calendar === "lunar") {
    if (recurrence.freq === "monthly" && recurrence.lunar_day != null) {
      label += ` · 农历${recurrence.lunar_day}日`;
    } else if (
      recurrence.freq === "yearly" &&
      recurrence.lunar_month != null &&
      recurrence.lunar_day != null
    ) {
      label += ` · 农历${Math.abs(recurrence.lunar_month)}月${recurrence.lunar_day}日`;
    } else {
      label += " · 农历";
    }
  }
  if (recurrence.workdays_only) label += " · 工作日";
  else if (recurrence.skip && recurrence.skip !== "none") {
    label += ` · ${SKIP_LABEL[recurrence.skip]}`;
  }
  return label;
}

function listReminderAts(item: TaskItemDisplay): string[] {
  const fromArray = (item.reminders ?? []).map((r) => r.at).filter(Boolean);
  if (fromArray.length > 0) return fromArray.toSorted((a, b) => Date.parse(a) - Date.parse(b));
  return item.remind_at ? [item.remind_at] : [];
}

function remindLabel(item: TaskItemDisplay): string {
  const ats = listReminderAts(item);
  if (ats.length === 0) return "提醒";
  if (ats.length > 1) return `${ats.length} 个提醒`;
  const at = ats[0];
  if (!at) return "提醒";
  if (item.due_at && at === item.due_at) return "截止时";
  if (item.due_at) {
    const diffMs = new Date(item.due_at).getTime() - new Date(at).getTime();
    if (diffMs === 5 * 60 * 1000) return "提前 5 分钟";
    if (diffMs === 60 * 60 * 1000) return "提前 1 小时";
    if (diffMs === 24 * 60 * 60 * 1000) return "提前 1 天";
  }
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "提醒";
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatRemindChip(dueAt: string | null, at: string): string {
  if (dueAt && at === dueAt) return "截止时";
  if (dueAt) {
    const diffMs = new Date(dueAt).getTime() - new Date(at).getTime();
    if (diffMs === 5 * 60 * 1000) return "提前 5 分钟";
    if (diffMs === 60 * 60 * 1000) return "提前 1 小时";
    if (diffMs === 24 * 60 * 60 * 1000) return "提前 1 天";
  }
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function setReminders<T extends TaskItemDisplay>(item: T, ats: string[]): T {
  const unique = [...new Set(ats.filter(Boolean))].toSorted(
    (a, b) => Date.parse(a) - Date.parse(b),
  );
  if (unique.length === 0) {
    return { ...item, remind_at: null, reminders: [] };
  }
  return {
    ...item,
    remind_at: unique[0] ?? null,
    reminders: unique.map((at) => ({ at })),
  };
}

function offsetFromDue(dueAt: string, offsetMs: number): string | null {
  const dueMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueMs)) return null;
  return new Date(dueMs - offsetMs).toISOString();
}

/** 全天/有 due：当天本地 09:00（相对 due 日） */
function remindAtNineOnDueDay(dueAt: string): string | null {
  const datePart = isoToDateLocalValue(dueAt);
  if (!datePart) return null;
  return mergeDateTimeLocal(datePart, "09:00");
}

function clearScheduleFields<T extends TaskItemDisplay>(item: T): T {
  return {
    ...item,
    start_at: null,
    due_at: null,
    recurrence: null,
    remind_at: null,
    reminders: [],
  };
}

function scheduleChipLabel(item: TaskItemDisplay): string {
  const due = formatDueChip(item.due_at);
  if (!item.due_at) return due.label;
  if (!item.start_at || item.start_at === item.due_at) return due.label;
  const startDate = isoToDateLocalValue(item.start_at);
  const startTime = isoToTimeLocalValue(item.start_at);
  const dueDate = isoToDateLocalValue(item.due_at);
  const dueTime = isoToTimeLocalValue(item.due_at);
  if (startDate && dueDate && startDate === dueDate) {
    return `${startTime || "—"}–${dueTime || "—"}`;
  }
  return `${startDate || "?"} → ${due.label}`;
}

function patchRecurrence<T extends TaskItemDisplay>(
  item: T,
  patch: Partial<TaskItemRecurrenceDisplay>,
): T {
  const base = item.recurrence ?? {
    freq: "daily" as const,
    interval: 1,
    anchor: "due" as const,
    schedule_at: item.due_at ?? new Date().toISOString(),
  };
  return { ...item, recurrence: { ...base, ...patch } };
}

function DateTimePopoverFields({
  datePart,
  timePart,
  dateLabel,
  timeLabel,
  onDateChange,
  onTimeChange,
  onClear,
  showClear,
}: {
  datePart: string;
  timePart: string;
  dateLabel: string;
  timeLabel: string;
  onDateChange: (nextDate: string) => void;
  onTimeChange: (nextTime: string) => void;
  onClear: () => void;
  showClear: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <DatePickerInput
        presentation="inline"
        className="w-full"
        value={datePart}
        aria-label={dateLabel}
        onChange={onDateChange}
      />
      <TimePickerInput
        className="w-full"
        value={timePart}
        disabled={!datePart}
        aria-label={timeLabel}
        onChange={onTimeChange}
      />
      {showClear ? (
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={onClear}>
          清除
        </Button>
      ) : null}
    </div>
  );
}

export function TaskDetailEditor<T extends TaskItemDisplay>({
  item,
  onChange,
  titleExtra,
  children,
  onTextFieldActivate,
  focusField,
}: TaskDetailEditorProps<T>) {
  const dueChip = formatDueChip(item.due_at);
  const datePart = isoToDateLocalValue(item.due_at);
  const timePart = isoToTimeLocalValue(item.due_at);
  const startDatePart = isoToDateLocalValue(item.start_at ?? null);
  const startTimePart = isoToTimeLocalValue(item.start_at ?? null);
  const completed = item.status === "completed";
  const scheduleAnchor = item.due_at ?? new Date().toISOString();
  const reminderAts = listReminderAts(item);
  const recurrence = item.recurrence;
  const recurrenceUntilDate = isoToDateLocalValue(recurrence?.until ?? null);
  const rootRef = useRef<HTMLDivElement>(null);

  const activateField = (field: TaskDetailFocusField) => {
    onTextFieldActivate?.(field);
  };

  const addRemindPreset = (presetId: RemindPresetId) => {
    if (!item.due_at) return;
    let at: string | null = null;
    if (presetId === "at_due") at = item.due_at;
    else if (presetId === "5m") at = offsetFromDue(item.due_at, 5 * 60 * 1000);
    else if (presetId === "1h") at = offsetFromDue(item.due_at, 60 * 60 * 1000);
    else if (presetId === "1d") at = offsetFromDue(item.due_at, 24 * 60 * 60 * 1000);
    else if (presetId === "9am") at = remindAtNineOnDueDay(item.due_at);
    if (!at) return;
    onChange(setReminders(item, [...reminderAts, at]));
  };

  /** peek Sheet 关闭会 restoreFocus 到列表项；延迟抢回，避免双键盘/失焦 */
  useEffect(() => {
    if (!focusField) return () => {};
    const aria = focusField === "title" ? "标题" : "描述";
    let cancelled = false;
    const focusTarget = () => {
      if (cancelled) return;
      const target = rootRef.current?.querySelector(`[aria-label="${aria}"]`) as HTMLElement | null;
      if (target && document.activeElement !== target) {
        target.focus({ preventScroll: true });
      }
    };
    focusTarget();
    const timers = [0, 50, 160, 320].map((ms) => window.setTimeout(focusTarget, ms));
    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
    };
  }, [focusField]);

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        <Checkbox
          isSelected={completed}
          aria-label={completed ? "标记为未完成" : "标记为已完成"}
          onChange={(selected) =>
            onChange({
              ...item,
              status: selected ? "completed" : "pending",
            })
          }
        />

        <PopoverTrigger>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 max-w-[min(100%,18rem)] gap-1.5 px-2 font-normal",
              dueChip.overdue ? "text-destructive" : "text-muted-foreground",
              item.due_at && !dueChip.overdue ? "text-foreground" : null,
            )}
            aria-label="日程"
          >
            <CalendarIcon className="size-4 shrink-0" />
            <span className="truncate">{scheduleChipLabel(item)}</span>
          </Button>
          <Popover placement="bottom start" className="w-72 p-3">
            <PopoverDialog>
              <p className="text-muted-foreground mb-2 text-xs font-medium">开始时间（可选）</p>
              <DateTimePopoverFields
                datePart={startDatePart}
                timePart={startTimePart}
                dateLabel="开始日期"
                timeLabel="开始时间"
                showClear={item.start_at != null}
                onDateChange={(nextDate) => {
                  if (!nextDate) {
                    onChange({ ...item, start_at: null });
                    return;
                  }
                  if (!item.due_at) {
                    const due = mergeDateTimeLocal(nextDate, startTimePart || "09:00");
                    onChange({
                      ...item,
                      start_at: due,
                      due_at: due,
                    });
                    return;
                  }
                  onChange({
                    ...item,
                    start_at: mergeDateTimeLocal(nextDate, startTimePart || timePart || "09:00"),
                  });
                }}
                onTimeChange={(nextTime) => {
                  if (!startDatePart && !item.due_at) return;
                  const date = startDatePart || datePart;
                  if (!date) return;
                  const start = mergeDateTimeLocal(date, nextTime);
                  if (!item.due_at) {
                    onChange({ ...item, start_at: start, due_at: start });
                    return;
                  }
                  onChange({ ...item, start_at: start });
                }}
                onClear={() => onChange({ ...item, start_at: null })}
              />
              <p className="text-muted-foreground mt-3 mb-2 text-xs font-medium">截止日期</p>
              <DateTimePopoverFields
                datePart={datePart}
                timePart={timePart}
                dateLabel="截止日期"
                timeLabel="截止时间"
                showClear={item.due_at != null}
                onDateChange={(nextDate) => {
                  if (!nextDate) {
                    onChange(clearScheduleFields(item));
                    return;
                  }
                  onChange({
                    ...item,
                    due_at: mergeDateTimeLocal(nextDate, timePart),
                  });
                }}
                onTimeChange={(nextTime) =>
                  onChange({
                    ...item,
                    due_at: mergeDateTimeLocal(datePart, nextTime),
                  })
                }
                onClear={() => onChange(clearScheduleFields(item))}
              />
            </PopoverDialog>
          </Popover>
        </PopoverTrigger>

        <PopoverTrigger>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 gap-1.5 px-2 font-normal",
              reminderAts.length > 0 ? "text-foreground" : "text-muted-foreground",
            )}
            aria-label={`提醒：${remindLabel(item)}`}
            isDisabled={!item.due_at}
          >
            <BellIcon className="size-4 shrink-0" />
            <span className="truncate">{remindLabel(item)}</span>
          </Button>
          <Popover placement="bottom start" className="w-80 p-3">
            <PopoverDialog>
              <p className="text-muted-foreground mb-2 text-xs font-medium">相对截止的提醒</p>
              <div className="flex flex-col gap-2">
                {reminderAts.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {reminderAts.map((at) => (
                      <li key={at} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{formatRemindChip(item.due_at, at)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-xs"
                          onClick={() =>
                            onChange(
                              setReminders(
                                item,
                                reminderAts.filter((x) => x !== at),
                              ),
                            )
                          }
                        >
                          移除
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-xs">尚未设置提醒</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {REMIND_ADD_PRESETS.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      isDisabled={!item.due_at}
                      onClick={() => addRemindPreset(preset.id)}
                    >
                      + {preset.label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    isDisabled={reminderAts.length === 0}
                    onClick={() => onChange(setReminders(item, []))}
                  >
                    清空
                  </Button>
                </div>
              </div>
            </PopoverDialog>
          </Popover>
        </PopoverTrigger>

        <PopoverTrigger>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 gap-1.5 px-2 font-normal",
              item.recurrence ? "text-foreground" : "text-muted-foreground",
            )}
            aria-label={`重复：${recurrenceLabel(item.recurrence)}`}
            isDisabled={!item.due_at}
          >
            <RepeatIcon className="size-4 shrink-0" />
            <span className="truncate">{recurrenceLabel(item.recurrence)}</span>
          </Button>
          {/* Menu 只渲染 MenuItem 集合；复杂表单须用 Popover（同提醒/截止日） */}
          <Popover placement="bottom start" className="w-80 p-3">
            <PopoverDialog>
              <p className="text-muted-foreground mb-2 text-xs font-medium">重复</p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-1">
                  {RECURRENCE_PRESETS.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      variant={
                        preset.id === "none"
                          ? !recurrence
                            ? "secondary"
                            : "outline"
                          : recurrence?.freq === preset.id && recurrence.interval === 1
                            ? "secondary"
                            : "outline"
                      }
                      size="sm"
                      className="h-7 px-2 text-xs"
                      isDisabled={!item.due_at}
                      onClick={() => {
                        if (!item.due_at) return;
                        onChange({
                          ...item,
                          recurrence: preset.build(scheduleAnchor),
                        });
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>

                {recurrence ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground shrink-0 text-xs">每</span>
                      <Input
                        type="number"
                        min={1}
                        className="h-8 w-16"
                        value={String(recurrence.interval)}
                        aria-label="重复间隔"
                        onChange={(e) => {
                          const n = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
                          onChange(patchRecurrence(item, { interval: n }));
                        }}
                      />
                      <DropdownMenuTrigger>
                        <Button type="button" variant="outline" size="sm" className="h-8">
                          {FREQ_UNIT[recurrence.freq]}
                        </Button>
                        <DropdownMenu
                          placement="bottom start"
                          selectionMode="single"
                          selectedKeys={[recurrence.freq]}
                          onSelectionChange={(keys: Iterable<string | number> | "all") => {
                            if (keys === "all") return;
                            const key = [...keys][0];
                            if (typeof key !== "string") return;
                            const freq = key as TaskItemRecurrenceDisplay["freq"];
                            const lunarOk = freq === "monthly" || freq === "yearly";
                            onChange(
                              patchRecurrence(item, {
                                freq,
                                ...(!lunarOk && recurrence.calendar === "lunar"
                                  ? {
                                      calendar: "gregorian" as const,
                                      lunar_month: undefined,
                                      lunar_day: undefined,
                                    }
                                  : freq === "monthly" && recurrence.calendar === "lunar"
                                    ? { lunar_month: undefined }
                                    : {}),
                              }),
                            );
                          }}
                        >
                          {(Object.keys(FREQ_UNIT) as TaskItemRecurrenceDisplay["freq"][]).map(
                            (freq) => (
                              <DropdownMenuItem key={freq} id={freq}>
                                {FREQ_UNIT[freq]}
                              </DropdownMenuItem>
                            ),
                          )}
                        </DropdownMenu>
                      </DropdownMenuTrigger>
                    </div>

                    {recurrence.freq === "weekly" ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground text-xs">重复于</span>
                        <div className="flex flex-wrap gap-1">
                          {WEEKDAY_LABELS.map((label, weekday) => {
                            const selected = recurrence.weekdays?.includes(weekday) ?? false;
                            return (
                              <Button
                                key={weekday}
                                type="button"
                                variant={selected ? "secondary" : "outline"}
                                size="sm"
                                className="size-8 p-0 text-xs"
                                aria-label={`周${label}`}
                                aria-pressed={selected}
                                onClick={() => {
                                  const prev = recurrence.weekdays ?? [];
                                  const next = selected
                                    ? prev.filter((d) => d !== weekday)
                                    : [...prev, weekday].toSorted((a, b) => a - b);
                                  onChange(
                                    patchRecurrence(item, {
                                      weekdays: next.length > 0 ? next : undefined,
                                    }),
                                  );
                                }}
                              >
                                {label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground text-xs">结束于</span>
                      <DatePickerInput
                        presentation="inline"
                        className="w-full"
                        value={recurrenceUntilDate}
                        aria-label="重复结束日期"
                        onChange={(nextDate) =>
                          onChange(
                            patchRecurrence(item, {
                              until: nextDate ? mergeDateTimeLocal(nextDate, "23:59") : null,
                            }),
                          )
                        }
                      />
                      {recurrence.until ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="self-start"
                          onClick={() => onChange(patchRecurrence(item, { until: null }))}
                        >
                          清除结束日期
                        </Button>
                      ) : null}
                    </div>

                    <div className="bg-border h-px" />
                    <span className="text-muted-foreground text-xs">高级</span>

                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          isSelected={recurrence.workdays_only ?? false}
                          aria-label="仅工作日"
                          onChange={(selected) =>
                            onChange(
                              patchRecurrence(item, {
                                workdays_only: selected,
                                skip: selected ? "none" : (recurrence.skip ?? "none"),
                              }),
                            )
                          }
                        />
                        仅在工作日重复
                      </label>

                      {!recurrence.workdays_only ? (
                        <DropdownMenuTrigger>
                          <Button type="button" variant="outline" size="sm" className="h-8 w-full">
                            {SKIP_LABEL[recurrence.skip ?? "none"]}
                          </Button>
                          <DropdownMenu
                            placement="bottom start"
                            selectionMode="single"
                            selectedKeys={[recurrence.skip ?? "none"]}
                            onSelectionChange={(keys: Iterable<string | number> | "all") => {
                              if (keys === "all") return;
                              const key = [...keys][0];
                              if (typeof key !== "string") return;
                              onChange(patchRecurrence(item, { skip: key as TaskRecurrenceSkip }));
                            }}
                          >
                            {(Object.keys(SKIP_LABEL) as TaskRecurrenceSkip[]).map((skip) => (
                              <DropdownMenuItem key={skip} id={skip}>
                                {SKIP_LABEL[skip]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenu>
                        </DropdownMenuTrigger>
                      ) : null}

                      {recurrence.freq === "monthly" || recurrence.freq === "yearly" ? (
                        <div className="flex flex-col gap-2">
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              isSelected={recurrence.calendar === "lunar"}
                              aria-label="农历重复"
                              onChange={(selected) => {
                                const calendar: TaskRecurrenceCalendar = selected
                                  ? "lunar"
                                  : "gregorian";
                                onChange(
                                  patchRecurrence(item, {
                                    calendar,
                                    ...(selected
                                      ? recurrence.freq === "yearly"
                                        ? {
                                            lunar_month: recurrence.lunar_month ?? 1,
                                            lunar_day: recurrence.lunar_day ?? 1,
                                          }
                                        : {
                                            lunar_day: recurrence.lunar_day ?? 1,
                                            lunar_month: undefined,
                                          }
                                      : { lunar_month: undefined, lunar_day: undefined }),
                                  }),
                                );
                              }}
                            />
                            {recurrence.freq === "yearly" ? "按农历年重复" : "按农历月重复"}
                          </label>
                          {recurrence.calendar === "lunar" ? (
                            <div className="flex items-center gap-2">
                              {recurrence.freq === "yearly" ? (
                                <>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={12}
                                    className="h-8 w-16"
                                    value={String(Math.abs(recurrence.lunar_month ?? 1))}
                                    aria-label="农历月"
                                    onChange={(e) => {
                                      const n = Math.min(
                                        12,
                                        Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                                      );
                                      onChange(patchRecurrence(item, { lunar_month: n }));
                                    }}
                                  />
                                  <span className="text-muted-foreground text-xs">月</span>
                                </>
                              ) : null}
                              <Input
                                type="number"
                                min={1}
                                max={30}
                                className="h-8 w-16"
                                value={String(recurrence.lunar_day ?? 1)}
                                aria-label="农历日"
                                onChange={(e) => {
                                  const n = Math.min(
                                    30,
                                    Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                                  );
                                  onChange(patchRecurrence(item, { lunar_day: n }));
                                }}
                              />
                              <span className="text-muted-foreground text-xs">日</span>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      onClick={() => onChange({ ...item, recurrence: null })}
                    >
                      清除重复
                    </Button>
                  </>
                ) : null}
              </div>
            </PopoverDialog>
          </Popover>
        </PopoverTrigger>

        <DropdownMenuTrigger>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn("ml-auto", priorityToneText(item.priority))}
            aria-label={`优先级：${PRIORITY_LABEL[item.priority]}`}
          >
            <FlagIcon
              className="size-4"
              fill={item.priority === "none" ? "none" : "currentColor"}
            />
          </Button>
          <DropdownMenu
            placement="bottom end"
            className="min-w-36"
            selectionMode="single"
            selectedKeys={[item.priority]}
            onSelectionChange={(keys: Iterable<string | number> | "all") => {
              if (keys === "all") return;
              const key = [...keys][0];
              if (typeof key === "string") onChange({ ...item, priority: key as TaskItemPriority });
            }}
          >
            <DropdownMenuLabel>优先级</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(PRIORITY_LABEL) as TaskItemPriority[]).map((value) => (
              <DropdownMenuItem key={value} id={value} className="gap-2">
                <span
                  className={`size-2 shrink-0 rounded-full ${priorityToneBg(value)}`}
                  aria-hidden
                />
                {PRIORITY_LABEL[value]}
              </DropdownMenuItem>
            ))}
          </DropdownMenu>
        </DropdownMenuTrigger>
      </div>

      <div className="shrink-0">
        <Input
          className={cn(
            "border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0",
            completed ? "line-through opacity-60" : null,
          )}
          value={item.title}
          placeholder="标题"
          aria-label="标题"
          onPointerDown={
            onTextFieldActivate
              ? (e) => {
                  e.preventDefault();
                  activateField("title");
                }
              : undefined
          }
          onFocus={() => activateField("title")}
          onChange={(e) => onChange({ ...item, title: e.target.value })}
        />
        {titleExtra}
      </div>

      <Textarea
        className="field-sizing-fixed min-h-0 w-full flex-1 resize-none overflow-y-auto border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        value={item.content}
        placeholder="描述"
        aria-label="描述"
        onPointerDown={
          onTextFieldActivate
            ? (e) => {
                e.preventDefault();
                activateField("content");
              }
            : undefined
        }
        onFocus={() => activateField("content")}
        onChange={(e) => onChange({ ...item, content: e.target.value })}
      />

      {children}
    </div>
  );
}
