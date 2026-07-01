import { useDraggable } from "@dnd-kit/core";
import { Badge, Button, Checkbox } from "@freeanima/ui-kit";
import { useRef, useState, type MouseEvent, type TouchEvent } from "react";

import { taskDndId } from "../lib/dnd-ids.ts";
import type { TaskItemRow } from "../lib/api.ts";
import { EntityIdLabel } from "./EntityIdLabel.tsx";

type CompletedTaskListProps = {
  items: TaskItemRow[];
  sortable?: boolean;
  listNameForItem?: (item: TaskItemRow) => string | null;
  useActionSheet: boolean;
  selectionMode: boolean;
  selectedIds: ReadonlySet<number>;
  onToggleComplete: (item: TaskItemRow) => void;
  onOpenItemMenu: (item: TaskItemRow) => void;
  onOpenItemContextMenu: (e: MouseEvent, item: TaskItemRow) => void;
  onSelectItem: (itemId: number, shiftKey: boolean) => void;
  onLongPressSelect: (itemId: number) => void;
};

function CompletedTaskRow({
  item,
  sortable,
  listName,
  useActionSheet,
  selectionMode,
  selected,
  onToggleComplete,
  onOpenMenu,
  onContextMenu,
  onSelectItem,
  onLongPressSelect,
}: {
  item: TaskItemRow;
  sortable: boolean;
  listName: string | null;
  useActionSheet: boolean;
  selectionMode: boolean;
  selected: boolean;
  onToggleComplete: () => void;
  onOpenMenu: () => void;
  onContextMenu: (e: MouseEvent) => void;
  onSelectItem: (shiftKey: boolean) => void;
  onLongPressSelect: () => void;
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: taskDndId(item.id),
    disabled: selectionMode || !sortable,
  });

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
      className={`hover:bg-muted flex min-h-11 items-center gap-1 rounded-lg px-1 py-1 opacity-70 ${
        isDragging ? "opacity-40" : ""
      } ${selected ? "bg-primary/10 opacity-100" : ""}`}
      onContextMenu={onContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onTouchCancel={clearLongPress}
    >
      {!selectionMode && sortable ? (
        <button
          type="button"
          title="拖到左侧清单以移动"
          className="text-foreground/40 hover:text-foreground flex min-h-11 min-w-8 shrink-0 cursor-grab items-center justify-center select-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
      ) : null}
      <Checkbox
        className="size-4"
        checked={selectionMode ? selected : true}
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
        className={`min-w-0 flex-1 truncate py-2 text-left text-sm ${selectionMode ? "" : "line-through"}`}
        onClick={(e) => {
          if (selectionMode) onSelectItem(e.shiftKey);
        }}
      >
        <span className="block truncate">{item.title}</span>
        {listName ? (
          <span className="text-foreground/45 block truncate text-xs no-underline">{listName}</span>
        ) : null}
      </button>
      {!selectionMode ? <EntityIdLabel id={item.id} /> : null}
      {useActionSheet && !selectionMode ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="任务操作"
          onClick={() => onOpenMenu()}
        >
          ⋯
        </Button>
      ) : null}
    </li>
  );
}

export function CompletedTaskList({
  items,
  sortable = true,
  listNameForItem,
  useActionSheet,
  selectionMode,
  selectedIds,
  onToggleComplete,
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
            <CompletedTaskRow
              key={item.id}
              item={item}
              sortable={sortable}
              listName={listNameForItem?.(item) ?? null}
              useActionSheet={useActionSheet}
              selectionMode={selectionMode}
              selected={selectedIds.has(item.id)}
              onToggleComplete={() => onToggleComplete(item)}
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
