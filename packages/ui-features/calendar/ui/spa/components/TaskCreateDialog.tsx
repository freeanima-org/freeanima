import { useMemo } from "react";
import { Dialog, DialogHeader, DialogTitle } from "@freeanima/ui-kit";
import {
  TaskQuickAddComposer,
  type ProjectPickerRow,
  type QuickAddSubmitPayload,
  type QuickAddTagOption,
} from "@freeanima/ui-kit/composite";
import type { TaskListRowLike } from "@freeanima/ui-kit/lib/task-list-tree.ts";

import { dayHeadingLabel } from "../lib/format-calendar.ts";

type TaskCreateDialogProps = {
  open: boolean;
  day: string | null;
  today: string;
  lists: TaskListRowLike[];
  projects: ProjectPickerRow[];
  defaultListId: number | null;
  searchTags: (query: string) => Promise<QuickAddTagOption[]>;
  onClose: () => void;
  onSave: (payload: QuickAddSubmitPayload) => void | Promise<void>;
};

export function TaskCreateDialog({
  open,
  day,
  today,
  lists,
  projects,
  defaultListId,
  searchTags,
  onClose,
  onSave,
}: TaskCreateDialogProps) {
  const defaultContainer = useMemo(() => {
    if (defaultListId == null) return null;
    const row = lists.find((l) => l.id === defaultListId);
    return { kind: "list" as const, id: defaultListId, label: row?.name ?? "收件箱" };
  }, [defaultListId, lists]);

  if (!open || day == null) return null;

  return (
    <Dialog isOpen={open} onOpenChange={(next) => !next && onClose()} className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{"新建任务"}</DialogTitle>
        <p className="text-muted-foreground text-sm">
          {"计划开始："}
          {dayHeadingLabel(day, today)}
        </p>
      </DialogHeader>
      <TaskQuickAddComposer
        lists={lists}
        projects={projects}
        defaultContainer={defaultContainer}
        fixedStartDay={day}
        searchTags={searchTags}
        onSubmit={async (payload) => {
          await onSave(payload);
          onClose();
        }}
        className="flex flex-col gap-2 px-1 py-2"
        submitLabel="保存"
      />
    </Dialog>
  );
}
