import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Checkbox } from "@freeanima/ui-kit";
import { useRef, type MouseEvent, type TouchEvent } from "react";

import { formatDue, priorityDot } from "../lib/format-task.ts";
import { taskDndId } from "../lib/dnd-ids.ts";
import type { TaskItemRow } from "../lib/api.ts";
import { EntityIdLabel } from "./EntityIdLabel.tsx";

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
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: taskDndId(item.id),
    disabled: selectionMode || !sortable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const clearLongPress = () => {
    if (longPressTimer.current != null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchStart = (_e: TouchEvent) => {
    if (!useActionSheet || selectionMode) return;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      onLongPressSelect();
    }, 450);
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`hover:bg-muted group flex min-h-11 items-center gap-1 rounded-lg px-1 py-1 ${
        isDragging ? "opacity-50" : ""
      } ${selected ? "bg-primary/10" : ""} ${active && !selected ? "ring-primary/30 ring-1 ring-inset" : ""}`}
      onContextMenu={onContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onTouchCancel={clearLongPress}
    >
      {!selectionMode && sortable ? (
        <button
          type="button"
          title="拖拽排序或拖到左侧清单"
          className="text-foreground/40 hover:text-foreground flex min-h-11 min-w-8 shrink-0 cursor-grab items-center justify-center select-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
      ) : null}
      <Checkbox
        checked={selectionMode ? selected : false}
        onClick={(e) => {
          if (selectionMode) {
            e.preventDefault();
            onSelectItem(e.shiftKey);
          }
        }}
        onCheckedChange={selectionMode ? undefined : () => onToggleComplete()}
      />
      <button
        type="button"
        className="min-w-0 flex-1 truncate py-2 text-left text-sm"
        onClick={(e) => {
          if (selectionMode) onSelectItem(e.shiftKey);
          else onEdit();
        }}
      >
        <span className="block truncate">{item.title}</span>
        {listName ? (
          <span className="text-foreground/45 block truncate text-xs">{listName}</span>
        ) : null}
      </button>
      {!selectionMode ? (
        <>
          <EntityIdLabel id={item.id} />
          <span className={`text-xs ${priorityDot(item.priority)}`}>●</span>
          {item.due_at ? (
            <span className="text-muted-foreground shrink-0 text-xs">{formatDue(item.due_at)}</span>
          ) : null}
        </>
      ) : null}
      {useActionSheet && !selectionMode ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="任务操作"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu();
          }}
        >
          ⋯
        </Button>
      ) : null}
    </li>
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
