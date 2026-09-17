import type { TaskItemDisplay } from "../lib/task-item-display.ts";
import { EmptyState } from "./EmptyState.tsx";
import { TaskItemRowView } from "./TaskItemRowView.tsx";
import type { ActionSheetItem } from "./types.ts";

export type TaskItemListViewProps<T extends TaskItemDisplay = TaskItemDisplay> = {
  items: T[];
  activeItemId?: number | null;
  emptyMessage?: string;
  useActionSheet: boolean;
  contextMenuEnabled?: boolean;
  disabled?: boolean;
  longPressEnabled?: boolean;
  secondaryLineForItem?: (item: T) => string | null;
  showEntityId?: boolean;
  tagTitleById?: ReadonlyMap<number, string> | null;
  onToggleComplete: (item: T) => void;
  onEdit: (item: T) => void;
  onOpenItemMenu: (item: T) => void;
  contextMenuItemsForItem?: ((item: T) => ActionSheetItem[]) | undefined;
};

export function TaskItemListView<T extends TaskItemDisplay>(props: TaskItemListViewProps<T>) {
  const {
    items,
    activeItemId,
    emptyMessage = "暂无任务",
    useActionSheet,
    contextMenuEnabled = false,
    disabled = false,
    longPressEnabled = true,
    secondaryLineForItem,
    showEntityId = false,
    tagTitleById = null,
    onToggleComplete,
    onEdit,
    onOpenItemMenu,
    contextMenuItemsForItem,
  } = props;
  const pending = items.filter((i) => i.status === "pending");
  const completed = items.filter((i) => i.status === "completed");

  if (items.length === 0) {
    return <EmptyState message={emptyMessage} className="px-2" />;
  }

  const renderRow = (item: T) => (
    <TaskItemRowView
      key={item.id}
      item={item}
      active={activeItemId === item.id}
      disabled={disabled}
      useActionSheet={useActionSheet}
      contextMenuEnabled={contextMenuEnabled}
      contextMenuItems={contextMenuItemsForItem?.(item)}
      longPressEnabled={longPressEnabled}
      showEntityId={showEntityId}
      tagTitleById={tagTitleById}
      secondaryLine={secondaryLineForItem?.(item) ?? null}
      onToggleComplete={() => onToggleComplete(item)}
      onEdit={() => onEdit(item)}
      onOpenMenu={() => onOpenItemMenu(item)}
      onLongPress={() => onOpenItemMenu(item)}
    />
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-1">
      <ul className="space-y-0.5">{pending.map(renderRow)}</ul>
      {completed.length > 0 ? (
        <>
          <div className="text-muted-foreground mt-3 mb-1 px-1 text-xs font-medium uppercase">
            已完成
          </div>
          <ul className="space-y-0.5">{completed.map(renderRow)}</ul>
        </>
      ) : null}
    </div>
  );
}
