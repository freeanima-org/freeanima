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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: taskDndId(item.id),
    disabled: selectionMode || !sortable,
  });

  const dragHandle =
    !selectionMode && sortable ? (
      <button
        type="button"
        title="拖拽排序或拖到左侧清单"
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
