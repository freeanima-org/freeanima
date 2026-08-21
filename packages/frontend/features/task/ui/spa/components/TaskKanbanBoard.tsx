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
  const priorityGrouped = useMemo(() => {
    const map = new Map<TaskItemPriority, TaskItemRowPayload[]>();
    for (const col of PRIORITY_COLS) map.set(col.key, []);
    for (const item of items) {
      if (item.parent_id != null) continue;
      map.get(item.priority)?.push(item);
    }
    return map;
  }, [items]);

  const statusGrouped = useMemo(() => {
    const map = new Map<"pending" | "completed", TaskItemRowPayload[]>();
    for (const col of STATUS_COLS) map.set(col.key, []);
    for (const item of items) {
      if (item.parent_id != null) continue;
      map.get(item.status)?.push(item);
    }
    return map;
  }, [items]);

  const renderCard = (item: TaskItemRowPayload) => (
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
            <div className="text-muted-foreground mt-1 text-xs">{item.due_at.slice(0, 16)}</div>
          ) : null}
        </span>
      </button>
    </li>
  );

  return (
    <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto p-1">
      {groupBy === "priority"
        ? PRIORITY_COLS.map((col) => {
            const list = priorityGrouped.get(col.key) ?? [];
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
                  onChangePriority(id, col.key);
                }}
              >
                <header
                  className={cn(
                    "border-b border-border/50 px-3 py-2 text-sm font-medium",
                    priorityToneText(col.key),
                  )}
                >
                  {col.label}
                  <span className="text-muted-foreground ml-1 text-xs">({list.length})</span>
                </header>
                <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
                  {list.map(renderCard)}
                </ul>
              </section>
            );
          })
        : STATUS_COLS.map((col) => {
            const list = statusGrouped.get(col.key) ?? [];
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
                  onChangeStatus(id, col.key);
                }}
              >
                <header className="border-b border-border/50 px-3 py-2 text-sm font-medium">
                  {col.label}
                  <span className="text-muted-foreground ml-1 text-xs">({list.length})</span>
                </header>
                <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
                  {list.map(renderCard)}
                </ul>
              </section>
            );
          })}
    </div>
  );
}
