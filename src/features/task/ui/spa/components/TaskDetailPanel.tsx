import type { MouseEvent } from "react";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@freeanima/frontend/ui-kit";
import { FormFieldLabel, FormFieldset } from "@freeanima/frontend/ui-kit/form/FormFieldset.tsx";

import {
  isoToDateLocalValue,
  isoToTimeLocalValue,
  mergeDateTimeLocal,
} from "../lib/format-task.ts";
import type { TaskItemRow } from "../lib/api.ts";

function openNativePicker(event: MouseEvent<HTMLInputElement>): void {
  const input = event.currentTarget;
  if (typeof input.showPicker !== "function") return;
  try {
    input.showPicker();
  } catch {
    // 已打开或不支持时忽略
  }
}

export type DetailSaveStatus = "idle" | "saving" | "saved" | "error";

function saveStatusLabel(status: DetailSaveStatus): string {
  switch (status) {
    case "saving":
      return "保存中…";
    case "saved":
      return "已保存";
    case "error":
      return "保存失败";
    default:
      return "";
  }
}

type TaskDetailPanelProps = {
  item: TaskItemRow;
  onChange: (item: TaskItemRow) => void;
  onCancel: () => void;
  saveStatus?: DetailSaveStatus;
};

export function TaskDetailPanel({
  item,
  onChange,
  onCancel,
  saveStatus = "idle",
}: TaskDetailPanelProps) {
  const statusLabel = saveStatusLabel(saveStatus);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <FormFieldset legend="详情" bordered={false} className="gap-3 p-4">
          <div>
            <FormFieldLabel>标题</FormFieldLabel>
            <Input
              className="w-full"
              value={item.title}
              onChange={(e) => onChange({ ...item, title: e.target.value })}
            />
          </div>
          <div>
            <FormFieldLabel>优先级</FormFieldLabel>
            <Select
              value={item.priority}
              onValueChange={(value) =>
                onChange({ ...item, priority: value as TaskItemRow["priority"] })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无</SelectItem>
                <SelectItem value="low">低</SelectItem>
                <SelectItem value="medium">中</SelectItem>
                <SelectItem value="high">高</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <FormFieldLabel>截止日期</FormFieldLabel>
            <div className="flex gap-2">
              <Input
                type="date"
                className="min-w-0 flex-1"
                value={isoToDateLocalValue(item.due_at)}
                onClick={openNativePicker}
                onChange={(e) =>
                  onChange({
                    ...item,
                    due_at: mergeDateTimeLocal(e.target.value, isoToTimeLocalValue(item.due_at)),
                  })
                }
              />
              <Input
                type="time"
                className="w-32 shrink-0"
                value={isoToTimeLocalValue(item.due_at)}
                disabled={!isoToDateLocalValue(item.due_at)}
                onClick={openNativePicker}
                onChange={(e) =>
                  onChange({
                    ...item,
                    due_at: mergeDateTimeLocal(isoToDateLocalValue(item.due_at), e.target.value),
                  })
                }
              />
            </div>
          </div>
          <div>
            <FormFieldLabel>内容</FormFieldLabel>
            <Textarea
              className="w-full"
              rows={6}
              value={item.content}
              onChange={(e) => onChange({ ...item, content: e.target.value })}
            />
          </div>
          <div>
            <FormFieldLabel>标签</FormFieldLabel>
            <Input
              className="w-full"
              placeholder="逗号分隔，如：工作,紧急"
              value={item.tags.join(", ")}
              onChange={(e) =>
                onChange({
                  ...item,
                  tags: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        </FormFieldset>
      </div>
      <div className="border safe-area-pb flex shrink-0 items-center gap-2 border-t p-4">
        <Button type="button" variant="ghost" className="min-w-24 flex-1" onClick={onCancel}>
          取消
        </Button>
        {statusLabel ? (
          <span className="text-muted-foreground min-w-0 flex-1 text-right text-xs">
            {statusLabel}
          </span>
        ) : (
          <span className="flex-1" aria-hidden />
        )}
      </div>
    </div>
  );
}
