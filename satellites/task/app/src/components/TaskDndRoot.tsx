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
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { TaskItemRow, TaskListRow } from "../lib/api.ts";
import { getParentId, getSiblings, isDescendant } from "../lib/list-tree.ts";
import { isListDndId, isTaskDndId, parseListDndId, parseTaskDndId } from "../lib/dnd-ids.ts";

type TaskDndRootProps = {
  lists: TaskListRow[];
  pendingItems: TaskItemRow[];
  taskItems: TaskItemRow[];
  children: ReactNode;
  onReorderSiblings: (ordered: TaskListRow[], parentId: number | null) => void;
  onMoveListToParent: (listId: number, parentId: number | null) => void;
  onReorderPending: (ordered: TaskItemRow[]) => void;
  onMoveTaskToList: (taskId: number, listId: number) => void;
  onTaskDragStart?: () => void;
};

type TaskDndUiState = {
  draggingTask: boolean;
  draggingList: boolean;
  overListId: number | null;
};

const TaskDndUiContext = createContext<TaskDndUiState>({
  draggingTask: false,
  draggingList: false,
  overListId: null,
});

export function useTaskDndUi(): TaskDndUiState {
  return useContext(TaskDndUiContext);
}

function DragMonitor({
  onTaskDragChange,
  onListDragChange,
  onOverListChange,
}: {
  onTaskDragChange: (dragging: boolean) => void;
  onListDragChange: (dragging: boolean) => void;
  onOverListChange: (listId: number | null) => void;
}) {
  useDndMonitor({
    onDragStart(event) {
      onTaskDragChange(isTaskDndId(event.active.id));
      onListDragChange(isListDndId(event.active.id));
    },
    onDragOver(event) {
      if (!event.over) {
        onOverListChange(null);
        return;
      }
      const listId = parseListDndId(event.over.id);
      onOverListChange(listId);
    },
    onDragEnd() {
      onTaskDragChange(false);
      onListDragChange(false);
      onOverListChange(null);
    },
    onDragCancel() {
      onTaskDragChange(false);
      onListDragChange(false);
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
  onReorderSiblings,
  onMoveListToParent,
  onReorderPending,
  onMoveTaskToList,
  onTaskDragStart,
}: TaskDndRootProps) {
  const [activeTask, setActiveTask] = useState<TaskItemRow | null>(null);
  const [draggingTask, setDraggingTask] = useState(false);
  const [draggingList, setDraggingList] = useState(false);
  const [overListId, setOverListId] = useState<number | null>(null);

  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);

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
      const activeListId = parseListDndId(activeId);
      const overListIdParsed = parseListDndId(overId);
      if (activeListId == null || overListIdParsed == null || activeListId === overListIdParsed) {
        return;
      }

      const activeList = listById.get(activeListId);
      const overList = listById.get(overListIdParsed);
      if (!activeList || !overList) return;

      if (overList.is_folder && !isDescendant(lists, activeListId, overListIdParsed)) {
        onMoveListToParent(activeListId, overListIdParsed);
        return;
      }

      if (overList.is_folder) return;

      const targetParentId = getParentId(overList);
      const siblings = getSiblings(lists, targetParentId);
      const from = siblings.findIndex((l) => l.id === activeListId);
      const to = siblings.findIndex((l) => l.id === overListIdParsed);
      if (from < 0 || to < 0) {
        if (!isDescendant(lists, activeListId, overListIdParsed)) {
          onMoveListToParent(activeListId, targetParentId);
        }
        return;
      }
      if (getParentId(activeList) !== targetParentId) {
        onMoveListToParent(activeListId, targetParentId);
        return;
      }
      if (from !== to) {
        onReorderSiblings(arrayMove(siblings, from, to), targetParentId);
      }
      return;
    }

    if (isTaskDndId(activeId)) {
      const taskId = parseTaskDndId(activeId);
      if (taskId == null) return;

      const targetListId = parseListDndId(overId);
      if (targetListId != null) {
        const targetList = listById.get(targetListId);
        if (targetList && !targetList.is_folder) {
          onMoveTaskToList(taskId, targetListId);
        }
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
      <DragMonitor
        onTaskDragChange={setDraggingTask}
        onListDragChange={setDraggingList}
        onOverListChange={setOverListId}
      />
      <TaskDndUiContext.Provider value={{ draggingTask, draggingList, overListId }}>
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
