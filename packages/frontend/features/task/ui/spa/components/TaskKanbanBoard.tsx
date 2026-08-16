import { useMemo } from "react";
import { cn } from "@freeanima/ui-kit";
import {
  PRIORITY_LABEL,
  priorityToneBg,
  priorityToneText,
  type TaskItemPriority,
} from "@freeanima/ui-kit/lib/task-item-display.ts";
import type { TaskItemRowPayload } from "@freeanima/shared/rpc-contract/frames/task.ts";

export type KanbanGroupBy = "priority" | "status";

type Props = {
  items: TaskItemRowPayload[];
  groupBy: KanbanGroupBy;
  onOpen: (item: TaskItemRowPayload) => void;
  onChangePriority: (id: number, priority: TaskItemRowPayload["priority"]) => void;
  onChangeStatus: (id: number, status: "pending" | "completed") => void;
};

const PRIORITY_COLS: Array<{ key: TaskItemPriority; label: string }> = (
  ["high", "medium", "low", "none"] as const
).map((key) => ({ key, label: PRIORITY_LABEL[key] }));

const STATUS_COLS: Array<{ key: "pending" | "completed"; label: string }> = [
  { key: "pending", label: "待办" },
  { key: "completed", label: "已完成" },
];

export function TaskKanbanBoard({
  items,
  groupBy,
  onOpen,
  onChangePriority,
  onChangeStatus,
}: Props) {
  const columns = groupBy === "priority" ? PRIORITY_COLS : STATUS_COLS;

  const grouped = useMemo(() => {
    const map = new Map<string, TaskItemRowPayload[]>();
    for (const col of columns) map.set(col.key, []);
    for (const item of items) {
      if (item.parent_id != null) continue;
      const key = groupBy === "priority" ? item.priority : item.status;
      map.get(key)?.push(item);
    }
    return map;
  }, [columns, groupBy, items]);

  return (
    <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto p-1">
      {columns.map((col) => {
        const list = grouped.get(col.key) ?? [];
        return (
          <section
            key={col.key}
            className="flex w-64 shrink-0 flex-col rounded-lg border border-border/60 bg-muted/20"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = Number(e.dataTransfer.getData("application/x-freeanima-task-id"));
              if (!Number.isFinite(id) || id <= 0) return;
              if (groupBy === "priority") {
                onChangePriority(id, col.key as TaskItemRowPayload["priority"]);
              } else {
                onChangeStatus(id, col.key as "pending" | "completed");
              }
            }}
          >
            <header
              className={cn(
                "border-b border-border/50 px-3 py-2 text-sm font-medium",
                groupBy === "priority" ? priorityToneText(col.key as TaskItemPriority) : null,
              )}
            >
              {col.label}
              <span className="text-muted-foreground ml-1 text-xs">({list.length})</span>
            </header>
            <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
              {list.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-freeanima-task-id", String(item.id));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => onOpen(item)}
                    className={cn(
                      "flex w-full gap-2 rounded-md border border-border/50 bg-background px-2 py-2 text-left text-sm shadow-sm",
                      "hover:border-primary/40",
                    )}
                  >
                    {item.priority !== "none" ? (
                      <span
                        className={cn(
                          "mt-0.5 w-1 shrink-0 self-stretch rounded-full",
                          priorityToneBg(item.priority),
                        )}
                        aria-hidden
                      />
                    ) : (
                      <span className="w-1 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <div className="truncate font-medium">{item.title}</div>
                      {item.subtask_total != null && item.subtask_total > 0 ? (
                        <div className="text-muted-foreground mt-1 text-xs">
                          子任务 {item.subtask_done ?? 0}/{item.subtask_total}
                        </div>
                      ) : null}
                      {item.due_at ? (
                        <div className="text-muted-foreground mt-1 text-xs">
                          {item.due_at.slice(0, 16)}
                        </div>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
