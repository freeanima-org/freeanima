import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
  Textarea,
} from "@freeanima/ui-kit";
import { DatePickerInput } from "@freeanima/ui-kit/form/DatePickerInput.tsx";
import { TimePickerInput } from "@freeanima/ui-kit/form/TimePickerInput.tsx";
import { formatCstIso } from "@freeanima/shared/util/time.ts";

import type { CalendarEventRow } from "../lib/api.ts";
import {
  dateLocalToIso,
  isoToDateLocalValue,
  isoToTimeLocalValue,
  mergeDateTimeLocal,
  todayDateLocalValue,
} from "../lib/format-calendar.ts";

export type EventEditorTarget =
  | { mode: "create"; day?: string }
  | { mode: "edit"; event: CalendarEventRow };

type EventReminderPresetId = "none" | "at_start" | "5m" | "1h" | "1d" | "9am";

type EventEditorDialogProps = {
  open: boolean;
  target: EventEditorTarget | null;
  onClose: () => void;
  onSave: (input: {
    title: string;
    content: string;
    start_at: string;
    end_at: string | null;
    all_day: boolean;
    remind_at: string | null;
    reminders: Array<{ at: string; anchor: "start" }>;
  }) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onConvertToTask?: () => void | Promise<void>;
};

const REMIND_PRESETS: Array<{ id: EventReminderPresetId; label: string }> = [
  { id: "none", label: "无提醒" },
  { id: "at_start", label: "开始时" },
  { id: "5m", label: "提前 5 分钟" },
  { id: "1h", label: "提前 1 小时" },
  { id: "1d", label: "提前 1 天" },
  { id: "9am", label: "当天 09:00" },
];

function offsetFromStart(startAt: string, offsetMs: number): string | null {
  const startMs = Date.parse(startAt);
  if (!Number.isFinite(startMs)) return null;
  return formatCstIso(new Date(startMs - offsetMs));
}

function remindAtNineOnStartDay(startAt: string): string | null {
  const datePart = isoToDateLocalValue(startAt);
  if (!datePart) return null;
  return mergeDateTimeLocal(datePart, "09:00");
}

function buildReminderFromPreset(
  preset: EventReminderPresetId,
  startAt: string,
): { remind_at: string | null; reminders: Array<{ at: string; anchor: "start" }> } {
  if (preset === "none") return { remind_at: null, reminders: [] };
  let at: string | null = null;
  if (preset === "at_start") at = startAt;
  else if (preset === "5m") at = offsetFromStart(startAt, 5 * 60 * 1000);
  else if (preset === "1h") at = offsetFromStart(startAt, 60 * 60 * 1000);
  else if (preset === "1d") at = offsetFromStart(startAt, 24 * 60 * 60 * 1000);
  else if (preset === "9am") at = remindAtNineOnStartDay(startAt);
  if (!at) return { remind_at: null, reminders: [] };
  return { remind_at: at, reminders: [{ at, anchor: "start" }] };
}

function detectPresetFromEvent(event: CalendarEventRow): EventReminderPresetId {
  const start = event.start_at;
  const at = event.reminders?.find((r) => r.at)?.at ?? event.remind_at ?? null;
  if (!at) return "none";
  if (at === start) return "at_start";
  const diffMs = Date.parse(start) - Date.parse(at);
  if (diffMs === 5 * 60 * 1000) return "5m";
  if (diffMs === 60 * 60 * 1000) return "1h";
  if (diffMs === 24 * 60 * 60 * 1000) return "1d";
  const nine = remindAtNineOnStartDay(start);
  if (nine && at === nine) return "9am";
  return "at_start";
}

export function EventEditorDialog({
  open,
  target,
  onClose,
  onSave,
  onDelete,
  onConvertToTask,
}: EventEditorDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState(todayDateLocalValue());
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [remindPreset, setRemindPreset] = useState<EventReminderPresetId>("none");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || target == null) return;
    if (target.mode === "create") {
      const day = target.day ?? todayDateLocalValue();
      setTitle("");
      setContent("");
      setAllDay(false);
      setStartDate(day);
      setStartTime("09:00");
      setEndDate("");
      setEndTime("");
      setRemindPreset("none");
    } else {
      const ev = target.event;
      setTitle(ev.title);
      setContent(ev.content);
      setAllDay(ev.all_day);
      setStartDate(isoToDateLocalValue(ev.start_at) || todayDateLocalValue());
      setStartTime(isoToTimeLocalValue(ev.start_at) || "09:00");
      setEndDate(isoToDateLocalValue(ev.end_at));
      setEndTime(isoToTimeLocalValue(ev.end_at));
      setRemindPreset(detectPresetFromEvent(ev));
    }
    setSaving(false);
  }, [open, target]);

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed || !startDate) return;
    setSaving(true);
    try {
      const start_at = allDay
        ? (dateLocalToIso(startDate) ?? `${startDate}T00:00:00.000Z`)
        : (mergeDateTimeLocal(startDate, startTime) ?? `${startDate}T00:00:00.000Z`);
      let end_at: string | null = null;
      if (endDate) {
        end_at = allDay ? dateLocalToIso(endDate) : mergeDateTimeLocal(endDate, endTime || "23:59");
      }
      const reminder = buildReminderFromPreset(remindPreset, start_at);
      await onSave({
        title: trimmed,
        content: content.trim(),
        start_at,
        end_at,
        all_day: allDay,
        remind_at: reminder.remind_at,
        reminders: reminder.reminders,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog isOpen={open} onOpenChange={(next) => !next && onClose()} className="max-w-md">
      <DialogHeader>
        <DialogTitle>{target?.mode === "edit" ? "编辑事件" : "新建事件"}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3 px-1 py-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cal-title">{"标题"}</Label>
          <Input id="cal-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="cal-allday">{"全天"}</Label>
          <Switch id="cal-allday" isSelected={allDay} onChange={setAllDay} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label>{"开始日期"}</Label>
            <DatePickerInput value={startDate} onChange={setStartDate} />
          </div>
          {!allDay ? (
            <div className="flex flex-col gap-1.5">
              <Label>{"开始时间"}</Label>
              <TimePickerInput value={startTime} onChange={setStartTime} />
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label>{"结束日期"}</Label>
            <DatePickerInput value={endDate} onChange={setEndDate} />
          </div>
          {!allDay ? (
            <div className="flex flex-col gap-1.5">
              <Label>{"结束时间"}</Label>
              <TimePickerInput value={endTime} onChange={setEndTime} />
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{"提醒（相对开始）"}</Label>
          <div className="flex flex-wrap gap-1">
            {REMIND_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant={remindPreset === preset.id ? "secondary" : "outline"}
                size="sm"
                className="h-7 px-2 text-xs"
                onPress={() => setRemindPreset(preset.id)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cal-content">{"备注"}</Label>
          <Textarea
            id="cal-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />
        </div>
      </div>
      <DialogFooter className="gap-2">
        {target?.mode === "edit" && onDelete ? (
          <Button
            type="button"
            variant="destructive"
            className="mr-auto"
            isDisabled={saving}
            onPress={() => void onDelete()}
          >
            {"删除"}
          </Button>
        ) : null}
        {target?.mode === "edit" && onConvertToTask ? (
          <Button
            type="button"
            variant="ghost"
            isDisabled={saving}
            onPress={() => void onConvertToTask()}
          >
            {"转为任务"}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" isDisabled={saving} onPress={onClose}>
          {"取消"}
        </Button>
        <Button
          type="button"
          isDisabled={saving || !title.trim()}
          onPress={() => void handleSave()}
        >
          {"保存"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
