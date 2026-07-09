import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from "@freeanima/frontend/ui-kit";
import { FormFieldLabel } from "@freeanima/frontend/ui-kit/form/FormFieldset.tsx";
import { DatePickerInput } from "@freeanima/frontend/ui-kit/form/DatePickerInput.tsx";

import type { MilestoneRow } from "../lib/api.ts";
import { isoToDateLocalValue } from "../lib/format-task.ts";

type MilestoneDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestones: MilestoneRow[];
  newTitle: string;
  newDue: string;
  writesDisabled: boolean;
  onNewTitleChange: (value: string) => void;
  onNewDueChange: (value: string) => void;
  onCreate: () => void;
  onStatusChange: (id: number, status: MilestoneRow["status"]) => void;
};

export function MilestoneDialog({
  open,
  onOpenChange,
  milestones,
  newTitle,
  newDue,
  writesDisabled,
  onNewTitleChange,
  onNewDueChange,
  onCreate,
  onStatusChange,
}: MilestoneDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md safe-area-pt safe-area-pb">
        <DialogHeader>
          <DialogTitle>里程碑</DialogTitle>
        </DialogHeader>
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {milestones.map((m) => (
            <li key={m.id} className="rounded border border-base-300 px-3 py-2 text-sm">
              <div className="font-medium">{m.title}</div>
              <div className="text-muted-foreground text-xs">
                {isoToDateLocalValue(m.due_at) || m.due_at} · {m.status}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(["pending", "in_progress", "completed", "delayed"] as const).map((st) => (
                  <Button
                    key={st}
                    size="sm"
                    variant={m.status === st ? "secondary" : "ghost"}
                    disabled={writesDisabled}
                    onClick={() => onStatusChange(m.id, st)}
                  >
                    {st}
                  </Button>
                ))}
              </div>
            </li>
          ))}
          {milestones.length === 0 ? (
            <li className="text-muted-foreground text-sm">暂无里程碑</li>
          ) : null}
        </ul>
        <div className="space-y-2 border-t border-base-300 pt-3">
          <div>
            <FormFieldLabel>标题</FormFieldLabel>
            <Input
              value={newTitle}
              onChange={(e) => onNewTitleChange(e.target.value)}
              placeholder="里程碑标题"
              disabled={writesDisabled}
            />
          </div>
          <div>
            <FormFieldLabel>截止日期</FormFieldLabel>
            <DatePickerInput
              value={newDue}
              disabled={writesDisabled}
              aria-label="截止日期"
              onChange={onNewDueChange}
            />
          </div>
          <Button
            className="w-full"
            disabled={writesDisabled || !newTitle.trim() || !newDue}
            onClick={() => onCreate()}
          >
            添加里程碑
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
