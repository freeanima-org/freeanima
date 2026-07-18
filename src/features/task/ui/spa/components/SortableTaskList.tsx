import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskItemRowView } from "@freeanima/frontend/ui-kit/composite";
import type { MouseEvent } from "react";

import { taskDndId } from "../lib/dnd-ids.ts";
import type { TaskItemRow } from "../lib/api.ts";

type SortableTaskListProps = {
  items: TaskItemRow[];
  sortable?: boolean;
  listNameForItem?: (item: TaskItemRow) => string | null;
  activeItemId?: number | null;
  useActionSheet: boolean;
  selectionMode: boolean;
  selectedIds: ReadonlySet<number>;
  tagTitleById?: ReadonlyMap<number, string> | null;
  onToggleComplete: (item: TaskItemRow) => void;
  onEdit: (item: TaskItemRow) => void;
  onOpenItemMenu: (item: TaskItemRow) => void;
  onOpenItemContextMenu: (e: MouseEvent, item: TaskItemRow) => void;
  onSelectItem: (itemId: number, shiftKey: boolean) => void;
  onLongPressSelect: (itemId: number) => void;
};

function SortableTaskRow({
  item,
  sortable,
  listName,
  useActionSheet,
  active,
  selectionMode,
  selected,
  tagTitleById = null,
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
  tagTitleById?: ReadonlyMap<number, string> | null;
  onToggleComplete: () => void;
  onEdit: () => void;
  onOpenMenu: () => void;
  onContextMenu: (e: MouseEvent) => void;
  onSelectItem: (shiftKey: boolean) => void;
  onLongPressSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
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
      secondaryLine={listName}
      showEntityId={!selectionMode}
      tagTitleById={tagTitleById}
      {...(sortable && !selectionMode
        ? { dragAttributes: { ...attributes }, dragListeners: { ...listeners } }
        : {})}
      rowRef={setNodeRef}
      rowStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      dragging={isDragging}
      longPressEnabled={false}
      onToggleComplete={onToggleComplete}
      onEdit={onEdit}
      onOpenMenu={onOpenMenu}
      onContextMenu={onContextMenu}
      onSelectItem={onSelectItem}
      onLongPress={() => onLongPressSelect()}
    />
  );
}

export function SortableTaskList({
  items,
  sortable = true,
  listNameForItem,
  activeItemId,
  useActionSheet,
  selectionMode,
  selectedIds,
  tagTitleById = null,
  onToggleComplete,
  onEdit,
  onOpenItemMenu,
  onOpenItemContextMenu,
  onSelectItem,
  onLongPressSelect,
}: SortableTaskListProps) {
  if (items.length === 0) return null;

  return (
    <SortableContext
      items={items.map((i) => taskDndId(i.id))}
      strategy={verticalListSortingStrategy}
    >
      <ul className="space-y-1">
        {items.map((item) => (
          <SortableTaskRow
            key={item.id}
            item={item}
            sortable={sortable}
            listName={listNameForItem?.(item) ?? null}
            active={activeItemId === item.id}
            useActionSheet={useActionSheet}
            selectionMode={selectionMode}
            selected={selectedIds.has(item.id)}
            tagTitleById={tagTitleById}
            onToggleComplete={() => onToggleComplete(item)}
            onEdit={() => onEdit(item)}
            onOpenMenu={() => onOpenItemMenu(item)}
            onContextMenu={(e) => onOpenItemContextMenu(e, item)}
            onSelectItem={(shiftKey) => onSelectItem(item.id, shiftKey)}
            onLongPressSelect={() => onLongPressSelect(item.id)}
          />
        ))}
      </ul>
    </SortableContext>
  );
}
