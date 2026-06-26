import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDndMonitor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { createContext, useContext, useState, type ReactNode } from "react";

import type { TaskItemRow, TaskListRow } from "../lib/api.ts";
import { isListDndId, isTaskDndId, parseListDndId, parseTaskDndId } from "../lib/dnd-ids.ts";

type TaskDndRootProps = {
  lists: TaskListRow[];
  pendingItems: TaskItemRow[];
  taskItems: TaskItemRow[];
  children: ReactNode;
  onReorderLists: (ordered: TaskListRow[]) => void;
  onReorderPending: (ordered: TaskItemRow[]) => void;
  onMoveTaskToList: (taskId: number, listId: number) => void;
  onTaskDragStart?: () => void;
};

type TaskDndUiState = {
  draggingTask: boolean;
  overListId: number | null;
};

const TaskDndUiContext = createContext<TaskDndUiState>({
  draggingTask: false,
  overListId: null,
});

export function useTaskDndUi(): TaskDndUiState {
  return useContext(TaskDndUiContext);
}

function DragMonitor({
  onTaskDragChange,
  onOverListChange,
}: {
  onTaskDragChange: (dragging: boolean) => void;
  onOverListChange: (listId: number | null) => void;
}) {
  useDndMonitor({
    onDragStart(event) {
      onTaskDragChange(isTaskDndId(event.active.id));
    },
    onDragOver(event) {
      if (!isTaskDndId(event.active.id) || !event.over) {
        onOverListChange(null);
        return;
      }
      const listId = parseListDndId(event.over.id);
      onOverListChange(listId);
    },
    onDragEnd() {
      onTaskDragChange(false);
      onOverListChange(null);
    },
    onDragCancel() {
      onTaskDragChange(false);
      onOverListChange(null);
    },
  });
  return null;
}

export function TaskDndRoot({
  lists,
  pendingItems,
  taskItems,
  children,
  onReorderLists,
  onReorderPending,
  onMoveTaskToList,
  onTaskDragStart,
}: TaskDndRootProps) {
  const [activeTask, setActiveTask] = useState<TaskItemRow | null>(null);
  const [draggingTask, setDraggingTask] = useState(false);
  const [overListId, setOverListId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = parseTaskDndId(event.active.id);
    if (taskId == null) return;
    const item = taskItems.find((i) => i.id === taskId) ?? null;
    setActiveTask(item);
    onTaskDragStart?.();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (isListDndId(activeId)) {
      if (!isListDndId(overId) || activeId === overId) return;
      const activeListId = parseListDndId(activeId);
      const overListIdParsed = parseListDndId(overId);
      if (activeListId == null || overListIdParsed == null) return;
      const from = lists.findIndex((l) => l.id === activeListId);
      const to = lists.findIndex((l) => l.id === overListIdParsed);
      if (from < 0 || to < 0 || from === to) return;
      onReorderLists(arrayMove(lists, from, to));
      return;
    }

    if (isTaskDndId(activeId)) {
      const taskId = parseTaskDndId(activeId);
      if (taskId == null) return;

      const targetListId = parseListDndId(overId);
      if (targetListId != null) {
        onMoveTaskToList(taskId, targetListId);
        return;
      }

      if (isTaskDndId(overId) && activeId !== overId) {
        const overTaskId = parseTaskDndId(overId);
        if (overTaskId == null) return;
        const from = pendingItems.findIndex((i) => i.id === taskId);
        const to = pendingItems.findIndex((i) => i.id === overTaskId);
        if (from < 0 || to < 0) return;
        onReorderPending(arrayMove(pendingItems, from, to));
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <DragMonitor onTaskDragChange={setDraggingTask} onOverListChange={setOverListId} />
      <TaskDndUiContext.Provider value={{ draggingTask, overListId }}>
        {children}
      </TaskDndUiContext.Provider>
      <DragOverlay>
        {activeTask ? (
          <div className="bg-base-100 border-base-300 flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 shadow-lg">
            <span className="text-base-content/40">⋮⋮</span>
            <span className="truncate text-sm">{activeTask.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
