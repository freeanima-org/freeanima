import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@freeanima/ui-kit";

import { dayHeadingLabel } from "../lib/format-calendar.ts";

type TaskCreateDialogProps = {
  open: boolean;
  day: string | null;
  today: string;
  onClose: () => void;
  onSave: (input: { title: string; day: string }) => void | Promise<void>;
};

export function TaskCreateDialog({ open, day, today, onClose, onSave }: TaskCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setSaving(false);
  }, [open, day]);

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed || day == null) return;
    setSaving(true);
    try {
      await onSave({ title: trimmed, day });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog isOpen={open} onOpenChange={(next) => !next && onClose()} className="max-w-md">
      <DialogHeader>
        <DialogTitle>{"新建任务"}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3 px-1 py-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cal-task-title">{"标题"}</Label>
          <Input
            id="cal-task-title"
            focusOnMount
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSave();
              }
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{"计划开始"}</Label>
          <p className="text-sm text-muted-foreground">
            {day != null ? dayHeadingLabel(day, today) : "—"}
          </p>
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" isDisabled={saving} onPress={onClose}>
          {"取消"}
        </Button>
        <Button
          type="button"
          isDisabled={saving || !title.trim() || day == null}
          onPress={() => void handleSave()}
        >
          {"保存"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
