import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@freeanima/frontend/ui-kit";
import { TaskItemRowView } from "@freeanima/frontend/ui-kit/composite";
import { useState, type MouseEvent } from "react";

import { taskDndId } from "../lib/dnd-ids.ts";
import type { TaskItemRow } from "../lib/api.ts";

type CompletedTaskListProps = {
  items: TaskItemRow[];
  sortable?: boolean;
  listNameForItem?: (item: TaskItemRow) => string | null;
  activeItemId?: number | null;
  useActionSheet: boolean;
  selectionMode: boolean;
  selectedIds: ReadonlySet<number>;
  onToggleComplete: (item: TaskItemRow) => void;
  onEdit: (item: TaskItemRow) => void;
  onOpenItemMenu: (item: TaskItemRow) => void;
  onOpenItemContextMenu: (e: MouseEvent, item: TaskItemRow) => void;
  onSelectItem: (itemId: number, shiftKey: boolean) => void;
  onLongPressSelect: (itemId: number) => void;
};

function CompletedDraggableRow({
  item,
  sortable,
  listName,
  useActionSheet,
  active,
  selectionMode,
  selected,
  onToggleComplete,
  onEdit,
  onOpenMenu,
  onContextMenu,
  onSelectItem,
  onLongPressSelect,
}: {
  item: TaskItemRow;
  sortable: boolean;
  listName: string | null;
  useActionSheet: boolean;
  active: boolean;
  selectionMode: boolean;
  selected: boolean;
  onToggleComplete: () => void;
  onEdit: () => void;
  onOpenMenu: () => void;
  onContextMenu: (e: MouseEvent) => void;
  onSelectItem: (shiftKey: boolean) => void;
  onLongPressSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: taskDndId(item.id),
    disabled: selectionMode || !sortable,
  });

  const dragHandle =
    !selectionMode && sortable ? (
      <button
        type="button"
        title="拖到左侧清单以移动"
        className="text-foreground/40 hover:text-foreground flex min-h-11 min-w-8 shrink-0 cursor-grab items-center justify-center select-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
    ) : null;

  return (
    <TaskItemRowView
      item={item}
      active={active}
      selected={selected}
      selectionMode={selectionMode}
      useActionSheet={useActionSheet}
      secondaryLine={listName}
      showEntityId={!selectionMode}
      dragHandle={dragHandle}
      rowRef={setNodeRef}
      dragging={isDragging}
      longPressEnabled={useActionSheet && !selectionMode}
      onToggleComplete={onToggleComplete}
      onEdit={onEdit}
      onOpenMenu={onOpenMenu}
      onContextMenu={onContextMenu}
      onSelectItem={onSelectItem}
      onLongPress={onLongPressSelect}
    />
  );
}

export function CompletedTaskList({
  items,
  sortable = true,
  listNameForItem,
  activeItemId,
  useActionSheet,
  selectionMode,
  selectedIds,
  onToggleComplete,
  onEdit,
  onOpenItemMenu,
  onOpenItemContextMenu,
  onSelectItem,
  onLongPressSelect,
}: CompletedTaskListProps) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const showList = expanded || (selectionMode && items.some((i) => selectedIds.has(i.id)));

  return (
    <div className="mt-4 px-2">
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 rounded-lg py-2 text-left text-xs font-medium"
        aria-expanded={showList}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-foreground/40 w-4 shrink-0">{showList ? "▾" : "▸"}</span>
        <span>已完成</span>
        <Badge variant="ghost">{items.length}</Badge>
      </button>
      {showList ? (
        <ul className="space-y-1">
          {items.map((item) => (
            <CompletedDraggableRow
              key={item.id}
              item={item}
              sortable={sortable}
              listName={listNameForItem?.(item) ?? null}
              active={activeItemId === item.id}
              useActionSheet={useActionSheet}
              selectionMode={selectionMode}
              selected={selectedIds.has(item.id)}
              onToggleComplete={() => onToggleComplete(item)}
              onEdit={() => onEdit(item)}
              onOpenMenu={() => onOpenItemMenu(item)}
              onContextMenu={(e) => onOpenItemContextMenu(e, item)}
              onSelectItem={(shiftKey) => onSelectItem(item.id, shiftKey)}
              onLongPressSelect={() => onLongPressSelect(item.id)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
