import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@freeanima/ui-kit";
import { FormFieldLabel, FormFieldset } from "@freeanima/ui-kit/form";

import { isoToDatetimeLocalValue } from "../lib/format-task.ts";
import type { TaskItemRow } from "../lib/api.ts";

type TaskDetailPanelProps = {
  item: TaskItemRow;
  onChange: (item: TaskItemRow) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
};

export function TaskDetailPanel({
  item,
  onChange,
  onSave,
  onCancel,
  saving,
}: TaskDetailPanelProps) {
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
            <Input
              type="datetime-local"
              className="w-full"
              value={isoToDatetimeLocalValue(item.due_at)}
              onChange={(e) =>
                onChange({
                  ...item,
                  due_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
            />
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
      <div className="border safe-area-pb flex shrink-0 gap-2 border-t p-4">
        <Button type="button" variant="ghost" className="min-w-24 flex-1" onClick={onCancel}>
          取消
        </Button>
        <Button
          type="button"
          className="min-w-24 flex-1"
          disabled={saving}
          onClick={() => void onSave()}
        >
          保存
        </Button>
      </div>
    </div>
  );
}
