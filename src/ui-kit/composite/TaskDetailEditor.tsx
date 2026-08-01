import type { ReactNode } from "react";
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

export type TaskDetailEditorProps<T extends TaskItemDisplay = TaskItemDisplay> = {
  item: T;
  onChange: (item: T) => void;
  /** @deprecated 不再显示图例 */
  legend?: string;
  titleExtra?: ReactNode;
  children?: ReactNode;
  /** compact：聚焦标题/描述时进入全屏编辑页 */
  onTextFieldActivate?: () => void;
};

const PRIORITY_LABEL: Record<TaskItemPriority, string> = {
  none: "无",
  low: "低",
  medium: "中",
  high: "高",
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

type RemindPresetId = "none" | "at_due" | "5m" | "1h" | "1d" | "custom";

const REMIND_PRESETS: Array<{ id: RemindPresetId; label: string }> = [
  { id: "none", label: "不提醒" },
  { id: "at_due", label: "截止时" },
  { id: "5m", label: "提前 5 分钟" },
  { id: "1h", label: "提前 1 小时" },
  { id: "1d", label: "提前 1 天" },
  { id: "custom", label: "自定义" },
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
  if (recurrence.calendar === "lunar") label += " · 农历";
  if (recurrence.workdays_only) label += " · 工作日";
  else if (recurrence.skip && recurrence.skip !== "none") {
    label += ` · ${SKIP_LABEL[recurrence.skip]}`;
  }
  return label;
}

function remindLabel(item: TaskItemDisplay): string {
  const at = item.remind_at ?? item.reminders?.[0]?.at ?? null;
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

function detectRemindPreset(item: TaskItemDisplay): RemindPresetId {
  const at = item.remind_at ?? item.reminders?.[0]?.at ?? null;
  if (!at) return "none";
  if (item.due_at && at === item.due_at) return "at_due";
  if (item.due_at) {
    const diffMs = new Date(item.due_at).getTime() - new Date(at).getTime();
    if (diffMs === 5 * 60 * 1000) return "5m";
    if (diffMs === 60 * 60 * 1000) return "1h";
    if (diffMs === 24 * 60 * 60 * 1000) return "1d";
  }
  return "custom";
}

function setRemindAt<T extends TaskItemDisplay>(item: T, at: string | null): T {
  if (!at) {
    return { ...item, remind_at: null, reminders: [] };
  }
  return { ...item, remind_at: at, reminders: [{ at }] };
}

function offsetFromDue(dueAt: string, offsetMs: number): string | null {
  const dueMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueMs)) return null;
  return new Date(dueMs - offsetMs).toISOString();
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

function priorityFlagClass(priority: TaskItemPriority): string {
  switch (priority) {
    case "high":
      return "text-destructive";
    case "medium":
      return "text-amber-500";
    case "low":
      return "text-sky-500";
    default:
      return "text-muted-foreground";
  }
}

export function TaskDetailEditor<T extends TaskItemDisplay>({
  item,
  onChange,
  titleExtra,
  children,
  onTextFieldActivate,
}: TaskDetailEditorProps<T>) {
  const dueChip = formatDueChip(item.due_at);
  const datePart = isoToDateLocalValue(item.due_at);
  const timePart = isoToTimeLocalValue(item.due_at);
  const completed = item.status === "completed";
  const scheduleAnchor = item.due_at ?? item.recurrence?.schedule_at ?? new Date().toISOString();
  const remindAt = item.remind_at ?? item.reminders?.[0]?.at ?? null;
  const remindDatePart = isoToDateLocalValue(remindAt);
  const remindTimePart = isoToTimeLocalValue(remindAt);
  const remindPreset = detectRemindPreset(item);
  const recurrence = item.recurrence;
  const recurrenceUntilDate = isoToDateLocalValue(recurrence?.until ?? null);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
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

        <DropdownMenuTrigger>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 max-w-[min(100%,16rem)] gap-1.5 px-2 font-normal",
              dueChip.overdue ? "text-destructive" : "text-muted-foreground",
              item.due_at && !dueChip.overdue ? "text-foreground" : null,
            )}
            aria-label="截止日期"
          >
            <CalendarIcon className="size-4 shrink-0" />
            <span className="truncate">{dueChip.label}</span>
          </Button>
          <DropdownMenu placement="bottom start" className="w-72 p-3">
            <DropdownMenuLabel className="px-0 pt-0">截止日期</DropdownMenuLabel>
            <div className="flex flex-col gap-2" onPointerDown={(e) => e.stopPropagation()}>
              <DatePickerInput
                className="w-full"
                value={datePart}
                aria-label="截止日期"
                onChange={(nextDate) =>
                  onChange({
                    ...item,
                    due_at: mergeDateTimeLocal(nextDate, timePart),
                  })
                }
              />
              <TimePickerInput
                className="w-full"
                value={timePart}
                disabled={!datePart}
                aria-label="截止时间"
                onChange={(nextTime) =>
                  onChange({
                    ...item,
                    due_at: mergeDateTimeLocal(datePart, nextTime),
                  })
                }
              />
              {item.due_at ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => onChange({ ...item, due_at: null })}
                >
                  清除
                </Button>
              ) : null}
            </div>
          </DropdownMenu>
        </DropdownMenuTrigger>

        <DropdownMenuTrigger>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 gap-1.5 px-2 font-normal",
              remindAt ? "text-foreground" : "text-muted-foreground",
            )}
            aria-label={`提醒：${remindLabel(item)}`}
          >
            <BellIcon className="size-4 shrink-0" />
            <span className="truncate">{remindLabel(item)}</span>
          </Button>
          <DropdownMenu placement="bottom start" className="w-72 p-3">
            <DropdownMenuLabel className="px-0 pt-0">提醒</DropdownMenuLabel>
            <div className="flex flex-col gap-2" onPointerDown={(e) => e.stopPropagation()}>
              <div className="flex flex-wrap gap-1">
                {REMIND_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant={remindPreset === preset.id ? "secondary" : "outline"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={preset.id !== "none" && preset.id !== "custom" && !item.due_at}
                    onClick={() => {
                      if (preset.id === "none") {
                        onChange(setRemindAt(item, null));
                        return;
                      }
                      if (!item.due_at) return;
                      if (preset.id === "at_due") {
                        onChange(setRemindAt(item, item.due_at));
                        return;
                      }
                      if (preset.id === "5m") {
                        onChange(setRemindAt(item, offsetFromDue(item.due_at, 5 * 60 * 1000)));
                        return;
                      }
                      if (preset.id === "1h") {
                        onChange(setRemindAt(item, offsetFromDue(item.due_at, 60 * 60 * 1000)));
                        return;
                      }
                      if (preset.id === "1d") {
                        onChange(
                          setRemindAt(item, offsetFromDue(item.due_at, 24 * 60 * 60 * 1000)),
                        );
                        return;
                      }
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              {(remindPreset === "custom" || remindAt) && (
                <>
                  <DatePickerInput
                    className="w-full"
                    value={remindDatePart}
                    aria-label="提醒日期"
                    onChange={(nextDate) =>
                      onChange(setRemindAt(item, mergeDateTimeLocal(nextDate, remindTimePart)))
                    }
                  />
                  <TimePickerInput
                    className="w-full"
                    value={remindTimePart}
                    disabled={!remindDatePart}
                    aria-label="提醒时间"
                    onChange={(nextTime) =>
                      onChange(setRemindAt(item, mergeDateTimeLocal(remindDatePart, nextTime)))
                    }
                  />
                </>
              )}
              {remindAt ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => onChange(setRemindAt(item, null))}
                >
                  清除
                </Button>
              ) : null}
            </div>
          </DropdownMenu>
        </DropdownMenuTrigger>

        <DropdownMenuTrigger>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 gap-1.5 px-2 font-normal",
              item.recurrence ? "text-foreground" : "text-muted-foreground",
            )}
            aria-label={`重复：${recurrenceLabel(item.recurrence)}`}
          >
            <RepeatIcon className="size-4 shrink-0" />
            <span className="truncate">{recurrenceLabel(item.recurrence)}</span>
          </Button>
          <DropdownMenu placement="bottom start" className="w-80 p-3">
            <DropdownMenuLabel className="px-0 pt-0">重复</DropdownMenuLabel>
            <div className="flex flex-col gap-3" onPointerDown={(e) => e.stopPropagation()}>
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
                    onClick={() =>
                      onChange({
                        ...item,
                        recurrence: preset.build(scheduleAnchor),
                      })
                    }
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
                          onChange(
                            patchRecurrence(item, {
                              freq: key as TaskItemRecurrenceDisplay["freq"],
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

                  <DropdownMenuSeparator className="my-0" />
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

                    {recurrence.freq === "yearly" ? (
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
                                    ? {
                                        lunar_month: recurrence.lunar_month ?? 1,
                                        lunar_day: recurrence.lunar_day ?? 1,
                                      }
                                    : { lunar_month: undefined, lunar_day: undefined }),
                                }),
                              );
                            }}
                          />
                          按农历年重复
                        </label>
                        {recurrence.calendar === "lunar" ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              max={12}
                              className="h-8 w-16"
                              value={String(recurrence.lunar_month ?? 1)}
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
          </DropdownMenu>
        </DropdownMenuTrigger>

        <DropdownMenuTrigger>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn("ml-auto", priorityFlagClass(item.priority))}
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
              <DropdownMenuItem key={value} id={value}>
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
          onFocus={() => onTextFieldActivate?.()}
          onChange={(e) => onChange({ ...item, title: e.target.value })}
        />
        {titleExtra}
      </div>

      <Textarea
        className="field-sizing-fixed min-h-0 w-full flex-1 resize-none overflow-y-auto border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        value={item.content}
        placeholder="描述"
        aria-label="描述"
        onFocus={() => onTextFieldActivate?.()}
        onChange={(e) => onChange({ ...item, content: e.target.value })}
      />

      {children}
    </div>
  );
}
