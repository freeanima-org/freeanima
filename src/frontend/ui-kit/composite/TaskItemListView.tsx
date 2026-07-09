import type { MouseEvent } from "react";

import type { TaskItemDisplay } from "../lib/task-item-display.ts";
import { EmptyState } from "./EmptyState.tsx";
import { TaskItemRowView } from "./TaskItemRowView.tsx";

export type TaskItemListViewProps<T extends TaskItemDisplay = TaskItemDisplay> = {
  items: T[];
  activeItemId?: number | null;
  emptyMessage?: string;
  useActionSheet: boolean;
  disabled?: boolean;
  longPressEnabled?: boolean;
  secondaryLineForItem?: (item: T) => string | null;
  showEntityId?: boolean;
  onToggleComplete: (item: T) => void;
  onEdit: (item: T) => void;
  onOpenItemMenu: (item: T) => void;
  onOpenItemContextMenu: (e: MouseEvent, item: T) => void;
};

export function TaskItemListView<T extends TaskItemDisplay>(props: TaskItemListViewProps<T>) {
  const {
    items,
    activeItemId,
    emptyMessage = "暂无任务",
    useActionSheet,
    disabled = false,
    longPressEnabled = true,
    secondaryLineForItem,
    showEntityId = false,
    onToggleComplete,
    onEdit,
    onOpenItemMenu,
    onOpenItemContextMenu,
  } = props;
  const pending = items.filter((i) => i.status === "pending");
  const completed = items.filter((i) => i.status === "completed");

  if (items.length === 0) {
    return <EmptyState message={emptyMessage} className="px-2" />;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-1">
      <ul className="space-y-0.5">
        {pending.map((item) => (
          <TaskItemRowView
            key={item.id}
            item={item}
            active={activeItemId === item.id}
            disabled={disabled}
            useActionSheet={useActionSheet}
            longPressEnabled={longPressEnabled}
            showEntityId={showEntityId}
            secondaryLine={secondaryLineForItem?.(item) ?? null}
            onToggleComplete={() => onToggleComplete(item)}
            onEdit={() => onEdit(item)}
            onOpenMenu={() => onOpenItemMenu(item)}
            onContextMenu={(e) => onOpenItemContextMenu(e, item)}
            onLongPress={() => onOpenItemMenu(item)}
          />
        ))}
      </ul>
      {completed.length > 0 ? (
        <>
          <div className="text-muted-foreground mt-3 mb-1 px-1 text-xs font-medium uppercase">
            已完成
          </div>
          <ul className="space-y-0.5">
            {completed.map((item) => (
              <TaskItemRowView
                key={item.id}
                item={item}
                active={activeItemId === item.id}
                disabled={disabled}
                useActionSheet={useActionSheet}
                longPressEnabled={longPressEnabled}
                showEntityId={showEntityId}
                secondaryLine={secondaryLineForItem?.(item) ?? null}
                onToggleComplete={() => onToggleComplete(item)}
                onEdit={() => onEdit(item)}
                onOpenMenu={() => onOpenItemMenu(item)}
                onContextMenu={(e) => onOpenItemContextMenu(e, item)}
                onLongPress={() => onOpenItemMenu(item)}
              />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
