import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EmptyState, TaskItemRowView } from "@freeanima/frontend/ui-kit/composite";
import { useMemo, useState, type MouseEvent } from "react";

import type { TaskItemRow } from "../lib/api.ts";

const TASK_PREFIX = "project-task:";

function taskDndId(id: number): string {
  return `${TASK_PREFIX}${id}`;
}

function parseTaskDndId(id: string | number): number | null {
  const raw = String(id);
  if (!raw.startsWith(TASK_PREFIX)) return null;
  const n = Number(raw.slice(TASK_PREFIX.length));
  return Number.isFinite(n) ? n : null;
}

type ProjectTaskListProps = {
  items: TaskItemRow[];
  activeItemId?: number | null;
  hideCompleted?: boolean;
  useActionSheet: boolean;
  disabled?: boolean;
  writesDisabled?: boolean;
  onToggleComplete: (item: TaskItemRow) => void;
  onEdit: (item: TaskItemRow) => void;
  onOpenItemMenu: (item: TaskItemRow) => void;
  onOpenItemContextMenu: (e: MouseEvent, item: TaskItemRow) => void;
  onReorderPending: (ordered: TaskItemRow[]) => void;
};

function SortableProjectTaskRow({
  item,
  active,
  disabled,
  sortable,
  useActionSheet,
  onToggleComplete,
  onEdit,
  onOpenMenu,
  onContextMenu,
}: {
  item: TaskItemRow;
  active: boolean;
  disabled: boolean;
  sortable: boolean;
  useActionSheet: boolean;
  onToggleComplete: () => void;
  onEdit: () => void;
  onOpenMenu: () => void;
  onContextMenu: (e: MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: taskDndId(item.id),
    disabled: !sortable || disabled,
  });

  return (
    <TaskItemRowView
      item={item}
      active={active}
      disabled={disabled}
      useActionSheet={useActionSheet}
      showEntityId
      {...(sortable && !disabled
        ? { dragAttributes: { ...attributes }, dragListeners: { ...listeners } }
        : {})}
      rowRef={setNodeRef}
      rowStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      dragging={isDragging}
      longPressEnabled={useActionSheet && (!sortable || disabled)}
      onToggleComplete={onToggleComplete}
      onEdit={onEdit}
      onOpenMenu={onOpenMenu}
      onContextMenu={onContextMenu}
      onLongPress={onOpenMenu}
    />
  );
}

export function ProjectTaskList({
  items,
  activeItemId,
  hideCompleted = false,
  useActionSheet,
  disabled = false,
  writesDisabled = false,
  onToggleComplete,
  onEdit,
  onOpenItemMenu,
  onOpenItemContextMenu,
  onReorderPending,
}: ProjectTaskListProps) {
  const pending = useMemo(() => items.filter((i) => i.status === "pending"), [items]);
  const completed = useMemo(() => items.filter((i) => i.status === "completed"), [items]);
  const showCompleted = !hideCompleted && completed.length > 0;
  const [activeDrag, setActiveDrag] = useState<TaskItemRow | null>(null);

  const sortable = !writesDisabled && !disabled;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const id = parseTaskDndId(event.active.id);
    if (id == null) return;
    setActiveDrag(pending.find((i) => i.id === id) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromId = parseTaskDndId(active.id);
    const toId = parseTaskDndId(over.id);
    if (fromId == null || toId == null) return;
    const from = pending.findIndex((i) => i.id === fromId);
    const to = pending.findIndex((i) => i.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    onReorderPending(arrayMove(pending, from, to));
  };

  if (items.length === 0) {
    return <EmptyState message="暂无任务" className="px-2" />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="px-1">
        <SortableContext
          items={pending.map((i) => taskDndId(i.id))}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-0.5">
            {pending.map((item) => (
              <SortableProjectTaskRow
                key={item.id}
                item={item}
                active={activeItemId === item.id}
                disabled={disabled}
                sortable={sortable}
                useActionSheet={useActionSheet}
                onToggleComplete={() => onToggleComplete(item)}
                onEdit={() => onEdit(item)}
                onOpenMenu={() => onOpenItemMenu(item)}
                onContextMenu={(e) => onOpenItemContextMenu(e, item)}
              />
            ))}
          </ul>
        </SortableContext>
        {showCompleted ? (
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
                  showEntityId
                  longPressEnabled={useActionSheet}
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
      <DragOverlay>
        {activeDrag ? (
          <div className="bg-background rounded-lg border px-2 shadow-lg">
            <TaskItemRowView
              item={activeDrag}
              useActionSheet={false}
              showEntityId
              onToggleComplete={() => {}}
              onEdit={() => {}}
              onOpenMenu={() => {}}
              onContextMenu={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
