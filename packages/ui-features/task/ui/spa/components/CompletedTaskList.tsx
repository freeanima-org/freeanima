import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@freeanima/ui-kit";
import { TaskItemRowView } from "@freeanima/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/ui-kit/composite";
import { useState } from "react";

import { taskDndId } from "../lib/dnd-ids.ts";
import type { TaskItemRow } from "../lib/api.ts";

type CompletedTaskListProps = {
  items: TaskItemRow[];
  sortable?: boolean;
  listNameForItem?: (item: TaskItemRow) => string | null;
  activeItemId?: number | null;
  useActionSheet: boolean;
  contextMenuEnabled?: boolean;
  selectionMode: boolean;
  selectedIds: ReadonlySet<number>;
  tagTitleById?: ReadonlyMap<number, string> | null;
  onToggleComplete: (item: TaskItemRow) => void;
  onEdit: (item: TaskItemRow) => void;
  onOpenItemMenu: (item: TaskItemRow) => void;
  contextMenuItemsForItem?: ((item: TaskItemRow) => ActionSheetItem[]) | undefined;
  onSelectItem: (itemId: number, shiftKey: boolean) => void;
  onLongPressSelect: (itemId: number) => void;
};

function CompletedDraggableRow({
  item,
  sortable,
  listName,
  useActionSheet,
  contextMenuEnabled,
  contextMenuItems,
  active,
  selectionMode,
  selected,
  tagTitleById = null,
  onToggleComplete,
  onEdit,
  onOpenMenu,
  onSelectItem,
  onLongPressSelect,
}: {
  item: TaskItemRow;
  sortable: boolean;
  listName: string | null;
  useActionSheet: boolean;
  contextMenuEnabled: boolean;
  contextMenuItems?: ActionSheetItem[] | undefined;
  active: boolean;
  selectionMode: boolean;
  selected: boolean;
  tagTitleById?: ReadonlyMap<number, string> | null;
  onToggleComplete: () => void;
  onEdit: () => void;
  onOpenMenu: () => void;
  onSelectItem: (shiftKey: boolean) => void;
  onLongPressSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: taskDndId(item.id),
    disabled: selectionMode || !sortable,
  });

  return (
    <TaskItemRowView
      item={item}
      active={active}
      selected={selected}
      selectionMode={selectionMode}
      useActionSheet={useActionSheet}
      contextMenuEnabled={contextMenuEnabled}
      contextMenuItems={contextMenuItems}
      secondaryLine={listName}
      showEntityId={!selectionMode}
      tagTitleById={tagTitleById}
      {...(sortable && !selectionMode
        ? { dragAttributes: { ...attributes }, dragListeners: { ...listeners } }
        : {})}
      rowRef={setNodeRef}
      dragging={isDragging}
      longPressEnabled={useActionSheet && !selectionMode}
      onToggleComplete={onToggleComplete}
      onEdit={onEdit}
      onOpenMenu={onOpenMenu}
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
  contextMenuEnabled = false,
  selectionMode,
  selectedIds,
  tagTitleById = null,
  onToggleComplete,
  onEdit,
  onOpenItemMenu,
  contextMenuItemsForItem,
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
              contextMenuEnabled={contextMenuEnabled}
              contextMenuItems={contextMenuItemsForItem?.(item)}
              selectionMode={selectionMode}
              selected={selectedIds.has(item.id)}
              tagTitleById={tagTitleById}
              onToggleComplete={() => onToggleComplete(item)}
              onEdit={() => onEdit(item)}
              onOpenMenu={() => onOpenItemMenu(item)}
              onSelectItem={(shiftKey) => onSelectItem(item.id, shiftKey)}
              onLongPressSelect={() => onLongPressSelect(item.id)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
