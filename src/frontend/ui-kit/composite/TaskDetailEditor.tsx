import type { ReactNode } from "react";

import { Input } from "../components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select.tsx";
import { Textarea } from "../components/ui/textarea.tsx";
import { DatePickerInput } from "../form/DatePickerInput.tsx";
import { FormFieldLabel, FormFieldset } from "../form/FormFieldset.tsx";
import { TimePickerInput } from "../form/TimePickerInput.tsx";
import {
  isoToDateLocalValue,
  isoToTimeLocalValue,
  mergeDateTimeLocal,
} from "../lib/datetime-local.ts";
import type { TaskItemDisplay, TaskItemPriority } from "../lib/task-item-display.ts";

export type TaskDetailEditorProps<T extends TaskItemDisplay = TaskItemDisplay> = {
  item: T;
  onChange: (item: T) => void;
  legend?: string;
  titleExtra?: ReactNode;
  children?: ReactNode;
};

export function TaskDetailEditor<T extends TaskItemDisplay>({
  item,
  onChange,
  legend = "详情",
  titleExtra,
  children,
}: TaskDetailEditorProps<T>) {
  return (
    <FormFieldset legend={legend} bordered={false} className="gap-3 p-4">
      <div>
        <FormFieldLabel>标题</FormFieldLabel>
        <Input
          className="w-full"
          value={item.title}
          onChange={(e) => onChange({ ...item, title: e.target.value })}
        />
        {titleExtra}
      </div>
      <div>
        <FormFieldLabel>优先级</FormFieldLabel>
        <Select
          value={item.priority}
          onValueChange={(value) => onChange({ ...item, priority: value as TaskItemPriority })}
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
          <DatePickerInput
            className="min-w-0 flex-1"
            value={isoToDateLocalValue(item.due_at)}
            aria-label="截止日期"
            onChange={(datePart) =>
              onChange({
                ...item,
                due_at: mergeDateTimeLocal(datePart, isoToTimeLocalValue(item.due_at)),
              })
            }
          />
          <TimePickerInput
            className="w-32 shrink-0"
            value={isoToTimeLocalValue(item.due_at)}
            disabled={!isoToDateLocalValue(item.due_at)}
            aria-label="截止时间"
            onChange={(timePart) =>
              onChange({
                ...item,
                due_at: mergeDateTimeLocal(isoToDateLocalValue(item.due_at), timePart),
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
          placeholder="逗号分隔"
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
      {children}
    </FormFieldset>
  );
}
