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
import { m } from "@paraglide/messages";

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
  }) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onConvertToTask?: () => void | Promise<void>;
};

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
  const [remindDate, setRemindDate] = useState("");
  const [remindTime, setRemindTime] = useState("");
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
      setRemindDate("");
      setRemindTime("");
    } else {
      const ev = target.event;
      setTitle(ev.title);
      setContent(ev.content);
      setAllDay(ev.all_day);
      setStartDate(isoToDateLocalValue(ev.start_at) || todayDateLocalValue());
      setStartTime(isoToTimeLocalValue(ev.start_at) || "09:00");
      setEndDate(isoToDateLocalValue(ev.end_at));
      setEndTime(isoToTimeLocalValue(ev.end_at));
      setRemindDate(isoToDateLocalValue(ev.remind_at));
      setRemindTime(isoToTimeLocalValue(ev.remind_at));
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
      let remind_at: string | null = null;
      if (remindDate) {
        remind_at = mergeDateTimeLocal(remindDate, remindTime || "09:00");
      }
      await onSave({
        title: trimmed,
        content: content.trim(),
        start_at,
        end_at,
        all_day: allDay,
        remind_at,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog isOpen={open} onOpenChange={(next) => !next && onClose()} className="max-w-md">
      <DialogHeader>
        <DialogTitle>
          {target?.mode === "edit" ? m.calendar_edit_event() : m.calendar_new_event()}
        </DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3 px-1 py-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cal-title">{m.calendar_field_title()}</Label>
          <Input id="cal-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="cal-allday">{m.calendar_all_day()}</Label>
          <Switch id="cal-allday" isSelected={allDay} onChange={setAllDay} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label>{m.calendar_field_start()}</Label>
            <DatePickerInput value={startDate} onChange={setStartDate} />
          </div>
          {!allDay ? (
            <div className="flex flex-col gap-1.5">
              <Label>{m.calendar_field_start_time()}</Label>
              <TimePickerInput value={startTime} onChange={setStartTime} />
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label>{m.calendar_field_end()}</Label>
            <DatePickerInput value={endDate} onChange={setEndDate} />
          </div>
          {!allDay ? (
            <div className="flex flex-col gap-1.5">
              <Label>{m.calendar_field_end_time()}</Label>
              <TimePickerInput value={endTime} onChange={setEndTime} />
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label>{m.calendar_field_remind()}</Label>
            <DatePickerInput value={remindDate} onChange={setRemindDate} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{m.calendar_field_remind_time()}</Label>
            <TimePickerInput value={remindTime} onChange={setRemindTime} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cal-content">{m.calendar_field_content()}</Label>
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
            {m.calendar_delete_event()}
          </Button>
        ) : null}
        {target?.mode === "edit" && onConvertToTask ? (
          <Button
            type="button"
            variant="ghost"
            isDisabled={saving}
            onPress={() => void onConvertToTask()}
          >
            {m.calendar_convert_to_task()}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onPress={onClose} isDisabled={saving}>
          {m.calendar_cancel()}
        </Button>
        <Button
          type="button"
          onPress={() => void handleSave()}
          isDisabled={saving || !title.trim()}
        >
          {m.calendar_save()}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
