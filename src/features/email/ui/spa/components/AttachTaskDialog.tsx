import { useEffect, useState } from "react";
import { Button, Dialog, DialogFooter, DialogHeader, DialogTitle, Label } from "@freeanima/ui-kit";
import { DatePickerInput } from "@freeanima/ui-kit/form/DatePickerInput.tsx";
import { TimePickerInput } from "@freeanima/ui-kit/form/TimePickerInput.tsx";
import { m } from "@paraglide/messages";

type AttachTaskDialogProps = {
  open: boolean;
  subject: string;
  onClose: () => void;
  onSubmit: (input: { due_at: string | null; remind_at: string | null }) => void | Promise<void>;
};

function todayDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function mergeLocal(date: string, time: string): string | null {
  if (!date.trim()) return null;
  const t = time.trim() || "09:00";
  return `${date}T${t}:00+08:00`;
}

export function AttachTaskDialog({ open, subject, onClose, onSubmit }: AttachTaskDialogProps) {
  const [dueDate, setDueDate] = useState(todayDate);
  const [dueTime, setDueTime] = useState("18:00");
  const [remindDate, setRemindDate] = useState("");
  const [remindTime, setRemindTime] = useState("09:00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDueDate(todayDate());
    setDueTime("18:00");
    setRemindDate("");
    setRemindTime("09:00");
  }, [open]);

  const handleSave = async () => {
    const due_at = mergeLocal(dueDate, dueTime);
    const remind_at = remindDate.trim() ? mergeLocal(remindDate, remindTime) : null;
    setSaving(true);
    try {
      await onSubmit({ due_at, remind_at });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog isOpen={open} onOpenChange={(v) => !v && onClose()} className="max-w-md">
      <DialogHeader>
        <DialogTitle>{m.email_attach_task_title()}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3 px-1 py-2">
        <p className="text-muted-foreground line-clamp-2 text-sm">{subject}</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label>{m.email_attach_task_due()}</Label>
            <DatePickerInput value={dueDate} onChange={setDueDate} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{m.email_attach_task_due_time()}</Label>
            <TimePickerInput value={dueTime} onChange={setDueTime} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label>{m.email_attach_task_remind()}</Label>
            <DatePickerInput value={remindDate} onChange={setRemindDate} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{m.email_attach_task_remind_time()}</Label>
            <TimePickerInput value={remindTime} onChange={setRemindTime} />
          </div>
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onPress={onClose} isDisabled={saving}>
          {m.email_cancel()}
        </Button>
        <Button type="button" onPress={() => void handleSave()} isDisabled={saving}>
          {m.email_attach_task_confirm()}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
