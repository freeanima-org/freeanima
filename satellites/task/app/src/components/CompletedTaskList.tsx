import type { MouseEvent } from "react";

import type { TaskItemRow } from "../lib/api.ts";

type CompletedTaskListProps = {
  items: TaskItemRow[];
  useActionSheet: boolean;
  onToggleComplete: (item: TaskItemRow) => void;
  onOpenItemMenu: (item: TaskItemRow) => void;
  onOpenItemContextMenu: (e: MouseEvent, item: TaskItemRow) => void;
};

export function CompletedTaskList({
  items,
  useActionSheet,
  onToggleComplete,
  onOpenItemMenu,
  onOpenItemContextMenu,
}: CompletedTaskListProps) {
  if (items.length === 0) return null;

  return (
    <div className="mt-4 px-2">
      <p className="text-base-content/50 mb-2 text-xs font-medium">已完成</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={item.id}
            className="hover:bg-base-200 flex min-h-11 items-center gap-2 rounded-lg px-2 py-1 opacity-70"
            onContextMenu={(e) => onOpenItemContextMenu(e, item)}
          >
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked
              onChange={() => onToggleComplete(item)}
            />
            <span className="min-w-0 flex-1 truncate py-2 text-sm line-through">{item.title}</span>
            {useActionSheet ? (
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square shrink-0"
                aria-label="任务操作"
                onClick={() => onOpenItemMenu(item)}
              >
                ⋯
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
