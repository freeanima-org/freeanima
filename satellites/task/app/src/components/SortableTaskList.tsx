import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MouseEvent } from "react";

import { formatDue, priorityDot } from "../lib/format-task.ts";
import type { TaskItemRow } from "../lib/api.ts";

type SortableTaskListProps = {
  items: TaskItemRow[];
  useActionSheet: boolean;
  onToggleComplete: (item: TaskItemRow) => void;
  onEdit: (item: TaskItemRow) => void;
  onOpenItemMenu: (item: TaskItemRow) => void;
  onOpenItemContextMenu: (e: MouseEvent, item: TaskItemRow) => void;
  onReorder: (ordered: TaskItemRow[]) => void;
};

function SortableTaskRow({
  item,
  useActionSheet,
  onToggleComplete,
  onEdit,
  onOpenMenu,
  onContextMenu,
}: {
  item: TaskItemRow;
  useActionSheet: boolean;
  onToggleComplete: () => void;
  onEdit: () => void;
  onOpenMenu: () => void;
  onContextMenu: (e: MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`hover:bg-base-200 group flex min-h-11 items-center gap-1 rounded-lg px-1 py-1 ${
        isDragging ? "opacity-50" : ""
      }`}
      onContextMenu={onContextMenu}
    >
      <button
        type="button"
        title="拖拽排序"
        className="text-base-content/40 hover:text-base-content flex min-h-11 min-w-8 shrink-0 cursor-grab items-center justify-center select-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <input
        type="checkbox"
        className="checkbox checkbox-sm"
        checked={false}
        onChange={onToggleComplete}
      />
      <button
        type="button"
        className="min-w-0 flex-1 truncate py-2 text-left text-sm"
        onClick={onEdit}
      >
        {item.title}
      </button>
      <span className={`text-xs ${priorityDot(item.priority)}`}>●</span>
      {item.due_at ? (
        <span className="text-base-content/50 shrink-0 text-xs">{formatDue(item.due_at)}</span>
      ) : null}
      {useActionSheet ? (
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square shrink-0"
          aria-label="任务操作"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu();
          }}
        >
          ⋯
        </button>
      ) : null}
    </li>
  );
}

export function SortableTaskList({
  items,
  useActionSheet,
  onToggleComplete,
  onEdit,
  onOpenItemMenu,
  onOpenItemContextMenu,
  onReorder,
}: SortableTaskListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  if (items.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1">
          {items.map((item) => (
            <SortableTaskRow
              key={item.id}
              item={item}
              useActionSheet={useActionSheet}
              onToggleComplete={() => onToggleComplete(item)}
              onEdit={() => onEdit(item)}
              onOpenMenu={() => onOpenItemMenu(item)}
              onContextMenu={(e) => onOpenItemContextMenu(e, item)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
