import { useDraggable } from "@dnd-kit/core";
import { useRef, useState, type MouseEvent, type TouchEvent } from "react";

import { taskDndId } from "../lib/dnd-ids.ts";
import type { TaskItemRow } from "../lib/api.ts";

type CompletedTaskListProps = {
  items: TaskItemRow[];
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
    disabled: selectionMode,
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
      className={`hover:bg-base-200 flex min-h-11 items-center gap-1 rounded-lg px-1 py-1 opacity-70 ${
        isDragging ? "opacity-40" : ""
      } ${selected ? "bg-primary/10 opacity-100" : ""}`}
      onContextMenu={onContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onTouchCancel={clearLongPress}
    >
      {!selectionMode ? (
        <button
          type="button"
          title="拖到左侧清单以移动"
          className="text-base-content/40 hover:text-base-content flex min-h-11 min-w-8 shrink-0 cursor-grab items-center justify-center select-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
      ) : null}
      <input
        type="checkbox"
        className="checkbox checkbox-sm"
        checked={selectionMode ? selected : true}
        onClick={(e) => {
          if (selectionMode) {
            e.preventDefault();
            onSelectItem(e.shiftKey);
          }
        }}
        onChange={selectionMode ? undefined : onToggleComplete}
      />
      <button
        type="button"
        className={`min-w-0 flex-1 truncate py-2 text-left text-sm ${selectionMode ? "" : "line-through"}`}
        onClick={(e) => {
          if (selectionMode) onSelectItem(e.shiftKey);
        }}
      >
        {item.title}
      </button>
      {useActionSheet && !selectionMode ? (
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square shrink-0"
          aria-label="任务操作"
          onClick={() => onOpenMenu()}
        >
          ⋯
        </button>
      ) : null}
    </li>
  );
}

export function CompletedTaskList({
  items,
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
        className="text-base-content/50 hover:text-base-content flex w-full items-center gap-2 rounded-lg py-2 text-left text-xs font-medium"
        aria-expanded={showList}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-base-content/40 w-4 shrink-0">{showList ? "▾" : "▸"}</span>
        <span>已完成</span>
        <span className="badge badge-ghost badge-sm">{items.length}</span>
      </button>
      {showList ? (
        <ul className="space-y-1">
          {items.map((item) => (
            <CompletedTaskRow
              key={item.id}
              item={item}
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
