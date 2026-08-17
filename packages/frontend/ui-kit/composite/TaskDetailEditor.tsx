import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { BellIcon, CalendarClockIcon, CalendarIcon, FlagIcon, RepeatIcon } from "lucide-react";

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
import { DateRangePickerPanel } from "../form/DateRangePickerPanel.tsx";
import { TimePickerInput } from "../form/TimePickerInput.tsx";
import { cn } from "../lib/utils.ts";
import { formatCstIso } from "@freeanima/shared/util/time.ts";

import {
  formatDueChip,
  isoToDateLocalValue,
  isoToTimeLocalValue,
  mergeDateTimeLocal,
  todayDateLocalValue,
} from "../lib/datetime-local.ts";
import type {
  TaskItemDisplay,
  TaskItemPriority,
  TaskItemRecurrenceDisplay,
  TaskItemReminderDisplay,
  TaskRecurrenceCalendar,
  TaskRecurrenceSkip,
  TaskReminderAnchor,
} from "../lib/task-item-display.ts";
import {
  PRIORITY_LABEL,
  hasTaskDeadline,
  hasTaskPlan,
  hasTaskScheduleTime,
  priorityToneBg,
  priorityToneText,
  taskPlanClock,
} from "../lib/task-item-display.ts";

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
  build: (planClock: string) => TaskItemRecurrenceDisplay | null;
}> = [
  { id: "none", label: "不重复", build: () => null },
  {
    id: "daily",
    label: "每天",
    build: (planClock) => ({
      freq: "daily",
      interval: 1,
      anchor: "due",
      schedule_at: planClock,
    }),
  },
  {
    id: "weekly",
    label: "每周",
    build: (planClock) => ({
      freq: "weekly",
      interval: 1,
      anchor: "due",
      schedule_at: planClock,
    }),
  },
  {
    id: "monthly",
    label: "每月",
    build: (planClock) => ({
      freq: "monthly",
      interval: 1,
      anchor: "due",
      schedule_at: planClock,
    }),
  },
  {
    id: "yearly",
    label: "每年",
    build: (planClock) => ({
      freq: "yearly",
      interval: 1,
      anchor: "due",
      schedule_at: planClock,
    }),
  },
];

type RemindPresetId = "at_anchor" | "5m" | "1h" | "1d" | "9am";

const REMIND_ADD_PRESETS: Array<{ id: RemindPresetId; label: string }> = [
  { id: "at_anchor", label: "当时" },
  { id: "5m", label: "提前 5 分钟" },
  { id: "1h", label: "提前 1 小时" },
  { id: "1d", label: "提前 1 天" },
  { id: "9am", label: "当天 09:00" },
];

const ANCHOR_LABEL: Record<TaskReminderAnchor, string> = {
  start: "开始",
  end: "结束",
  due: "截止",
};

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

function listReminders(item: TaskItemDisplay): TaskItemReminderDisplay[] {
  const fromArray = (item.reminders ?? []).filter((r) => r.at);
  if (fromArray.length > 0) {
    return fromArray.toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at));
  }
  return item.remind_at ? [{ at: item.remind_at }] : [];
}

function remindLabel(item: TaskItemDisplay): string {
  const reminders = listReminders(item);
  if (reminders.length === 0) return "提醒";
  if (reminders.length > 1) return `${reminders.length} 个提醒`;
  const first = reminders[0];
  if (!first) return "提醒";
  return formatRemindChip(item, first);
}

function resolveAnchorIso(item: TaskItemDisplay, anchor: TaskReminderAnchor): string | null {
  if (anchor === "start") return item.start_at?.trim() ? item.start_at : null;
  if (anchor === "end") return item.end_at?.trim() ? item.end_at : null;
  return item.due_at?.trim() ? item.due_at : null;
}

function formatRemindChip(item: TaskItemDisplay, reminder: TaskItemReminderDisplay): string {
  const anchor = reminder.anchor;
  const anchorIso = anchor ? resolveAnchorIso(item, anchor) : null;
  const prefix = anchor ? `${ANCHOR_LABEL[anchor]}·` : "";
  if (anchorIso && reminder.at === anchorIso) return `${prefix}当时`;
  if (anchorIso) {
    const diffMs = new Date(anchorIso).getTime() - new Date(reminder.at).getTime();
    if (diffMs === 5 * 60 * 1000) return `${prefix}提前 5 分钟`;
    if (diffMs === 60 * 60 * 1000) return `${prefix}提前 1 小时`;
    if (diffMs === 24 * 60 * 60 * 1000) return `${prefix}提前 1 天`;
  }
  const d = new Date(reminder.at);
  if (Number.isNaN(d.getTime())) return reminder.at;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function setReminders<T extends TaskItemDisplay>(item: T, reminders: TaskItemReminderDisplay[]): T {
  const uniqueMap = new Map<string, TaskItemReminderDisplay>();
  for (const r of reminders) {
    if (!r.at) continue;
    uniqueMap.set(r.at, {
      at: r.at,
      ...(r.anchor !== undefined ? { anchor: r.anchor } : {}),
    });
  }
  const unique = [...uniqueMap.values()].toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (unique.length === 0) {
    return { ...item, remind_at: null, reminders: [] };
  }
  return {
    ...item,
    remind_at: unique[0]?.at ?? null,
    reminders: unique,
  };
}

function offsetFromAnchor(anchorAt: string, offsetMs: number): string | null {
  const anchorMs = new Date(anchorAt).getTime();
  if (Number.isNaN(anchorMs)) return null;
  return formatCstIso(new Date(anchorMs - offsetMs));
}

/** 全天/有锚点：当天本地 09:00（相对锚点日） */
function remindAtNineOnAnchorDay(anchorAt: string): string | null {
  const datePart = isoToDateLocalValue(anchorAt);
  if (!datePart) return null;
  return mergeDateTimeLocal(datePart, "09:00");
}

function availableReminderAnchors(item: TaskItemDisplay): TaskReminderAnchor[] {
  const out: TaskReminderAnchor[] = [];
  if (item.start_at?.trim()) out.push("start");
  if (item.end_at?.trim()) out.push("end");
  if (item.due_at?.trim()) out.push("due");
  return out;
}

/** 清计划；保留截止。无剩余时间则清提醒。重复绑计划，一并清。 */
function clearPlanFields<T extends TaskItemDisplay>(item: T): T {
  const next: T = {
    ...item,
    start_at: null,
    end_at: null,
    recurrence: null,
  };
  if (!hasTaskDeadline(next)) {
    return { ...next, remind_at: null, reminders: [] };
  }
  return next;
}

/** 清截止；保留计划。无剩余时间则清提醒。 */
function clearDueFields<T extends TaskItemDisplay>(item: T): T {
  const next: T = { ...item, due_at: null };
  if (!hasTaskPlan(next)) {
    return { ...next, remind_at: null, reminders: [] };
  }
  return next;
}

function formatPlanRangeChip(item: TaskItemDisplay): string | null {
  if (!hasTaskPlan(item)) return null;
  const startDate = isoToDateLocalValue(item.start_at ?? null);
  const startTime = isoToTimeLocalValue(item.start_at ?? null);
  if (!item.end_at) {
    const due = formatDueChip(item.start_at);
    return due.label === "截止日期" ? startDate || "计划" : due.label;
  }
  const endDate = isoToDateLocalValue(item.end_at);
  const endTime = isoToTimeLocalValue(item.end_at);
  if (startDate && endDate && startDate === endDate) {
    return `${startTime || "—"}–${endTime || "—"}`;
  }
  const startLabel = formatDueChip(item.start_at).label;
  const endLabel = formatDueChip(item.end_at).label;
  return `${startLabel} → ${endLabel}`;
}

/** 开启时段：无结束则默认开始 +1 小时 */
function enablePlanRangeMode<T extends TaskItemDisplay>(item: T): T {
  if (!item.start_at?.trim()) {
    const now = formatCstIso(new Date());
    const start = mergeDateTimeLocal(isoToDateLocalValue(now) || todayDateLocalValue(), "09:00");
    if (!start) return item;
    const endMs = Date.parse(start) + 60 * 60 * 1000;
    const end = formatCstIso(new Date(endMs));
    const next = { ...item, start_at: start, end_at: end };
    return next.recurrence ? patchRecurrence(next, { schedule_at: end }) : next;
  }
  if (item.end_at?.trim()) return item;
  const startMs = Date.parse(item.start_at);
  if (!Number.isFinite(startMs)) return item;
  const end = formatCstIso(new Date(startMs + 60 * 60 * 1000));
  const next = { ...item, end_at: end };
  return next.recurrence ? patchRecurrence(next, { schedule_at: end }) : next;
}

function disablePlanRangeMode<T extends TaskItemDisplay>(item: T): T {
  if (!item.end_at?.trim()) return item;
  const next = { ...item, end_at: null };
  const clock = taskPlanClock(next);
  return next.recurrence && clock ? patchRecurrence(next, { schedule_at: clock }) : next;
}

function planChipLabel(item: TaskItemDisplay): string {
  return formatPlanRangeChip(item) ?? "计划";
}

function dueChipLabel(item: TaskItemDisplay): string {
  if (!item.due_at) return "截止";
  return formatDueChip(item.due_at).label;
}

function dueChipOverdue(item: TaskItemDisplay): boolean {
  if (!item.due_at) return false;
  return formatDueChip(item.due_at).overdue;
}

/** 计划时段：按区间日期写 start_at/end_at，保留已有时刻 */
function applyPlanDateRange<T extends TaskItemDisplay>(
  item: T,
  range: { start: string; end: string },
  startTime: string,
  endTime: string,
): T {
  const start = mergeDateTimeLocal(range.start, startTime || "09:00");
  if (!start) return item;
  const end = mergeDateTimeLocal(range.end, endTime || startTime || "10:00");
  if (!end) return item;
  let nextEnd = end;
  if (Date.parse(start) > Date.parse(end)) {
    nextEnd = formatCstIso(new Date(Date.parse(start) + 60 * 60 * 1000));
  }
  const next = { ...item, start_at: start, end_at: nextEnd };
  if (!next.recurrence) return next;
  const clock = taskPlanClock(next);
  return clock ? patchRecurrence(next, { schedule_at: clock }) : next;
}

function patchRecurrence<T extends TaskItemDisplay>(
  item: T,
  patch: Partial<TaskItemRecurrenceDisplay>,
): T {
  const planClock = taskPlanClock(item) ?? new Date().toISOString();
  const base = item.recurrence ?? {
    freq: "daily" as const,
    interval: 1,
    anchor: "due" as const,
    schedule_at: planClock,
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
  const dueDatePart = isoToDateLocalValue(item.due_at);
  const dueTimePart = isoToTimeLocalValue(item.due_at);
  const startDatePart = isoToDateLocalValue(item.start_at ?? null);
  const startTimePart = isoToTimeLocalValue(item.start_at ?? null);
  const endDatePart = isoToDateLocalValue(item.end_at ?? null);
  const endTimePart = isoToTimeLocalValue(item.end_at ?? null);
  const completed = item.status === "completed";
  const planClock = taskPlanClock(item);
  const canRemind = hasTaskScheduleTime(item);
  const canRecur = hasTaskPlan(item);
  const reminderAnchors = availableReminderAnchors(item);
  const defaultRemindAnchor: TaskReminderAnchor =
    reminderAnchors.find((a) => a === "start") ??
    reminderAnchors.find((a) => a === "end") ??
    reminderAnchors[0] ??
    "due";
  const [remindAnchor, setRemindAnchor] = useState<TaskReminderAnchor>(defaultRemindAnchor);
  const activeRemindAnchor = reminderAnchors.includes(remindAnchor)
    ? remindAnchor
    : defaultRemindAnchor;
  const reminders = listReminders(item);
  const recurrence = item.recurrence;
  const recurrenceUntilDate = isoToDateLocalValue(recurrence?.until ?? null);
  const rootRef = useRef<HTMLDivElement>(null);

  const activateField = (field: TaskDetailFocusField) => {
    onTextFieldActivate?.(field);
  };

  const addRemindPreset = (presetId: RemindPresetId, anchor: TaskReminderAnchor) => {
    const anchorAt = resolveAnchorIso(item, anchor);
    if (!anchorAt) return;
    let at: string | null = null;
    if (presetId === "at_anchor") at = anchorAt;
    else if (presetId === "5m") at = offsetFromAnchor(anchorAt, 5 * 60 * 1000);
    else if (presetId === "1h") at = offsetFromAnchor(anchorAt, 60 * 60 * 1000);
    else if (presetId === "1d") at = offsetFromAnchor(anchorAt, 24 * 60 * 60 * 1000);
    else if (presetId === "9am") at = remindAtNineOnAnchorDay(anchorAt);
    if (!at) return;
    onChange(setReminders(item, [...reminders, { at, anchor }]));
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
              "h-8 max-w-[min(100%,14rem)] gap-1.5 px-2 font-normal",
              hasTaskPlan(item) ? "text-foreground" : "text-muted-foreground",
            )}
            aria-label="计划时间"
          >
            <CalendarIcon className="size-4 shrink-0" />
            <span className="truncate">{planChipLabel(item)}</span>
          </Button>
          <Popover placement="bottom start" className="w-auto p-3">
            <PopoverDialog>
              <p className="text-muted-foreground mb-2 text-xs font-medium">计划时间</p>
              <label className="mb-2 flex items-center gap-2 text-sm">
                <Checkbox
                  isSelected={item.end_at != null}
                  aria-label="时间段"
                  onChange={(selected) =>
                    onChange(selected ? enablePlanRangeMode(item) : disablePlanRangeMode(item))
                  }
                />
                时间段
              </label>
              {item.end_at ? (
                <div className="flex flex-col gap-2">
                  <DateRangePickerPanel
                    aria-label="计划日期区间"
                    value={
                      startDatePart && endDatePart
                        ? { start: startDatePart, end: endDatePart }
                        : startDatePart
                          ? { start: startDatePart, end: startDatePart }
                          : null
                    }
                    onChange={(range) => {
                      onChange(applyPlanDateRange(item, range, startTimePart, endTimePart));
                    }}
                  />
                  <div className="flex flex-col gap-2">
                    <TimePickerInput
                      className="w-full"
                      value={startTimePart}
                      disabled={!startDatePart}
                      aria-label="计划开始时间"
                      onChange={(nextTime) => {
                        if (!startDatePart) return;
                        onChange(
                          applyPlanDateRange(
                            item,
                            {
                              start: startDatePart,
                              end: endDatePart || startDatePart,
                            },
                            nextTime,
                            endTimePart,
                          ),
                        );
                      }}
                    />
                    <TimePickerInput
                      className="w-full"
                      value={endTimePart}
                      disabled={!endDatePart && !startDatePart}
                      aria-label="计划结束时间"
                      onChange={(nextTime) => {
                        const dateStart = startDatePart;
                        const dateEnd = endDatePart || startDatePart;
                        if (!dateStart || !dateEnd) return;
                        onChange(
                          applyPlanDateRange(
                            item,
                            { start: dateStart, end: dateEnd },
                            startTimePart,
                            nextTime,
                          ),
                        );
                      }}
                    />
                  </div>
                  {item.start_at ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      onClick={() => onChange(clearPlanFields(item))}
                    >
                      清除计划
                    </Button>
                  ) : null}
                </div>
              ) : (
                <DateTimePopoverFields
                  datePart={startDatePart}
                  timePart={startTimePart}
                  dateLabel="计划日期"
                  timeLabel="计划时间"
                  showClear={item.start_at != null}
                  onDateChange={(nextDate) => {
                    if (!nextDate) {
                      onChange(clearPlanFields(item));
                      return;
                    }
                    const start = mergeDateTimeLocal(nextDate, startTimePart || "09:00");
                    if (!start) return;
                    const next = { ...item, start_at: start, end_at: null };
                    onChange(
                      next.recurrence ? patchRecurrence(next, { schedule_at: start }) : next,
                    );
                  }}
                  onTimeChange={(nextTime) => {
                    if (!startDatePart) return;
                    const start = mergeDateTimeLocal(startDatePart, nextTime);
                    if (!start) return;
                    const next = { ...item, start_at: start, end_at: null };
                    onChange(
                      next.recurrence ? patchRecurrence(next, { schedule_at: start }) : next,
                    );
                  }}
                  onClear={() => onChange(clearPlanFields(item))}
                />
              )}
            </PopoverDialog>
          </Popover>
        </PopoverTrigger>

        <PopoverTrigger>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 max-w-[min(100%,12rem)] gap-1.5 px-2 font-normal",
              dueChipOverdue(item) ? "text-destructive" : "text-muted-foreground",
              item.due_at && !dueChipOverdue(item) ? "text-foreground" : null,
            )}
            aria-label="截止日期"
          >
            <CalendarClockIcon className="size-4 shrink-0" />
            <span className="truncate">{dueChipLabel(item)}</span>
          </Button>
          <Popover placement="bottom start" className="w-72 p-3">
            <PopoverDialog>
              <p className="text-muted-foreground mb-2 text-xs font-medium">截止日期</p>
              <p className="text-muted-foreground mb-2 text-[11px]">
                独立于计划；常用于项目截止。到期会进收件箱。
              </p>
              <DateTimePopoverFields
                datePart={dueDatePart}
                timePart={dueTimePart}
                dateLabel="截止日期"
                timeLabel="截止时间"
                showClear={item.due_at != null}
                onDateChange={(nextDate) => {
                  if (!nextDate) {
                    onChange(clearDueFields(item));
                    return;
                  }
                  onChange({
                    ...item,
                    due_at: mergeDateTimeLocal(nextDate, dueTimePart || "09:00"),
                  });
                }}
                onTimeChange={(nextTime) => {
                  if (!dueDatePart) return;
                  onChange({
                    ...item,
                    due_at: mergeDateTimeLocal(dueDatePart, nextTime),
                  });
                }}
                onClear={() => onChange(clearDueFields(item))}
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
              reminders.length > 0 ? "text-foreground" : "text-muted-foreground",
            )}
            aria-label={`提醒：${remindLabel(item)}`}
            isDisabled={!canRemind}
          >
            <BellIcon className="size-4 shrink-0" />
            <span className="truncate">{remindLabel(item)}</span>
          </Button>
          <Popover placement="bottom start" className="w-80 p-3">
            <PopoverDialog>
              <p className="text-muted-foreground mb-2 text-xs font-medium">提醒锚点</p>
              <div className="mb-2 flex flex-wrap gap-1">
                {reminderAnchors.map((anchor) => (
                  <Button
                    key={anchor}
                    type="button"
                    variant={activeRemindAnchor === anchor ? "secondary" : "outline"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setRemindAnchor(anchor)}
                  >
                    {ANCHOR_LABEL[anchor]}
                  </Button>
                ))}
              </div>
              <p className="text-muted-foreground mb-2 text-xs font-medium">
                相对{ANCHOR_LABEL[activeRemindAnchor]}的提醒
              </p>
              <div className="flex flex-col gap-2">
                {reminders.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {reminders.map((reminder) => (
                      <li
                        key={`${reminder.anchor ?? ""}:${reminder.at}`}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="truncate">{formatRemindChip(item, reminder)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-xs"
                          onClick={() =>
                            onChange(
                              setReminders(
                                item,
                                reminders.filter((x) => x.at !== reminder.at),
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
                      isDisabled={!resolveAnchorIso(item, activeRemindAnchor)}
                      onClick={() => addRemindPreset(preset.id, activeRemindAnchor)}
                    >
                      + {preset.label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    isDisabled={reminders.length === 0}
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
            isDisabled={!canRecur}
          >
            <RepeatIcon className="size-4 shrink-0" />
            <span className="truncate">{recurrenceLabel(item.recurrence)}</span>
          </Button>
          {/* Menu 只渲染 MenuItem 集合；复杂表单须用 Popover（同提醒/截止日） */}
          <Popover placement="bottom start" className="w-80 p-3">
            <PopoverDialog>
              <p className="text-muted-foreground mb-2 text-xs font-medium">重复（绑计划时钟）</p>
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
                      isDisabled={!planClock}
                      onClick={() => {
                        if (!planClock) return;
                        onChange({
                          ...item,
                          recurrence: preset.build(planClock),
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
