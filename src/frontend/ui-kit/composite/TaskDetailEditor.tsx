import type { ReactNode } from "react";
import { CalendarIcon, FlagIcon } from "lucide-react";

import { Button } from "../components/ui/button.tsx";
import { Checkbox } from "../components/ui/checkbox.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import type { TaskItemDisplay, TaskItemPriority } from "../lib/task-item-display.ts";

export type TaskDetailEditorProps<T extends TaskItemDisplay = TaskItemDisplay> = {
  item: T;
  onChange: (item: T) => void;
  /** @deprecated 不再显示图例 */
  legend?: string;
  titleExtra?: ReactNode;
  children?: ReactNode;
};

const PRIORITY_LABEL: Record<TaskItemPriority, string> = {
  none: "无",
  low: "低",
  medium: "中",
  high: "高",
};

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
}: TaskDetailEditorProps<T>) {
  const dueChip = formatDueChip(item.due_at);
  const datePart = isoToDateLocalValue(item.due_at);
  const timePart = isoToTimeLocalValue(item.due_at);
  const completed = item.status === "completed";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div className="flex shrink-0 items-center gap-1">
        <Checkbox
          checked={completed}
          aria-label={completed ? "标记为未完成" : "标记为已完成"}
          onCheckedChange={(checked) =>
            onChange({
              ...item,
              status: checked === true ? "completed" : "pending",
            })
          }
        />

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
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
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-72 p-3"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
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
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
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
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            <DropdownMenuLabel>优先级</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={item.priority}
              onValueChange={(value) => onChange({ ...item, priority: value as TaskItemPriority })}
            >
              {(Object.keys(PRIORITY_LABEL) as TaskItemPriority[]).map((value) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {PRIORITY_LABEL[value]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
          onChange={(e) => onChange({ ...item, title: e.target.value })}
        />
        {titleExtra}
      </div>

      <Textarea
        className="field-sizing-fixed min-h-0 w-full flex-1 resize-none overflow-y-auto border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        value={item.content}
        placeholder="描述"
        aria-label="描述"
        onChange={(e) => onChange({ ...item, content: e.target.value })}
      />

      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}
