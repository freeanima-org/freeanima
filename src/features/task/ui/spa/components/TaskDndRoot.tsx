import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  useDndMonitor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import type { TaskItemRow, TaskListRow } from "../lib/api.ts";
import { createTaskListCollisionDetection } from "../lib/dnd-collision.ts";
import {
  isListDndId,
  isListRootDndId,
  isTaskDndId,
  parseListDndId,
  parseTaskDndId,
} from "../lib/dnd-ids.ts";
import {
  resolveFolderDropIntent,
  resolveListDragEnd,
  type FolderDropIntent,
} from "../lib/resolve-list-drag-end.ts";

type TaskDndRootProps = {
  lists: TaskListRow[];
  pendingItems: TaskItemRow[];
  taskItems: TaskItemRow[];
  children: ReactNode;
  onReorderSiblings: (ordered: TaskListRow[], parentId: number | null) => void;
  onMoveListToParent: (listId: number, parentId: number | null) => void;
  onPlaceList: (listId: number, parentId: number | null, ordered: TaskListRow[]) => void;
  onReorderPending: (ordered: TaskItemRow[]) => void;
  onMoveTaskToList: (taskId: number, listId: number) => void;
  onTaskDragStart?: () => void;
};

type TaskDndUiState = {
  draggingTask: boolean;
  draggingList: boolean;
  overListId: number | null;
  activeListId: number | null;
  overListRoot: boolean;
  folderDropIntent: FolderDropIntent | null;
};

const TaskDndUiContext = createContext<TaskDndUiState>({
  draggingTask: false,
  draggingList: false,
  overListId: null,
  activeListId: null,
  overListRoot: false,
  folderDropIntent: null,
});

export function useTaskDndUi(): TaskDndUiState {
  return useContext(TaskDndUiContext);
}

function DragMonitor({
  lists,
  onTaskDragChange,
  onListDragChange,
  onOverListChange,
  onActiveListChange,
  onOverListRootChange,
  onFolderDropIntentChange,
  pointerYRef,
}: {
  lists: TaskListRow[];
  onTaskDragChange: (dragging: boolean) => void;
  onListDragChange: (dragging: boolean) => void;
  onOverListChange: (listId: number | null) => void;
  onActiveListChange: (listId: number | null) => void;
  onOverListRootChange: (overRoot: boolean) => void;
  onFolderDropIntentChange: (intent: FolderDropIntent | null) => void;
  pointerYRef: React.MutableRefObject<number | null>;
}) {
  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);

  useDndMonitor({
    onDragStart(event) {
      onTaskDragChange(isTaskDndId(event.active.id));
      onListDragChange(isListDndId(event.active.id));
      onActiveListChange(parseListDndId(event.active.id));
      onFolderDropIntentChange(null);
    },
    onDragMove(event) {
      if (event.over && isListDndId(event.active.id)) {
        const overListId = parseListDndId(event.over.id);
        const overList = overListId != null ? listById.get(overListId) : null;
        if (overList?.is_folder && pointerYRef.current != null) {
          onFolderDropIntentChange(
            resolveFolderDropIntent(
              { top: event.over.rect.top, height: event.over.rect.height },
              pointerYRef.current,
            ),
          );
        } else {
          onFolderDropIntentChange(null);
        }
      }
    },
    onDragOver(event) {
      if (!event.over) {
        onOverListChange(null);
        onOverListRootChange(false);
        onFolderDropIntentChange(null);
        return;
      }
      onOverListRootChange(isListRootDndId(event.over.id));
      const overListId = parseListDndId(event.over.id);
      onOverListChange(overListId);
      const overList = overListId != null ? listById.get(overListId) : null;
      if (overList?.is_folder && isListDndId(event.active.id) && pointerYRef.current != null) {
        onFolderDropIntentChange(
          resolveFolderDropIntent(
            { top: event.over.rect.top, height: event.over.rect.height },
            pointerYRef.current,
          ),
        );
      } else {
        onFolderDropIntentChange(null);
      }
    },
    onDragEnd() {
      onTaskDragChange(false);
      onListDragChange(false);
      onOverListChange(null);
      onActiveListChange(null);
      onOverListRootChange(false);
      onFolderDropIntentChange(null);
      // pointerYRef 由 TaskDndRoot.handleDragEnd 读取后再清空
    },
    onDragCancel() {
      onTaskDragChange(false);
      onListDragChange(false);
      onOverListChange(null);
      onActiveListChange(null);
      onOverListRootChange(false);
      onFolderDropIntentChange(null);
      pointerYRef.current = null;
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
  onPlaceList,
  onReorderPending,
  onMoveTaskToList,
  onTaskDragStart,
}: TaskDndRootProps) {
  const [activeTask, setActiveTask] = useState<TaskItemRow | null>(null);
  const [activeList, setActiveList] = useState<TaskListRow | null>(null);
  const [draggingTask, setDraggingTask] = useState(false);
  const [draggingList, setDraggingList] = useState(false);
  const [overListId, setOverListId] = useState<number | null>(null);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [overListRoot, setOverListRoot] = useState(false);
  const [folderDropIntent, setFolderDropIntent] = useState<FolderDropIntent | null>(null);
  const pointerYRef = useRef<number | null>(null);

  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);

  const collisionDetection = useMemo(
    () =>
      createTaskListCollisionDetection((y) => {
        pointerYRef.current = y;
      }),
    [],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const listId = parseListDndId(event.active.id);
    if (listId != null) {
      setActiveList(listById.get(listId) ?? null);
      setActiveTask(null);
      return;
    }
    const taskId = parseTaskDndId(event.active.id);
    if (taskId == null) return;
    const item = taskItems.find((i) => i.id === taskId) ?? null;
    setActiveTask(item);
    setActiveList(null);
    onTaskDragStart?.();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    setActiveList(null);
    const { active, over } = event;
    if (!over) {
      pointerYRef.current = null;
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    if (isListDndId(activeId)) {
      const activeListIdParsed = parseListDndId(activeId);
      if (activeListIdParsed == null) {
        pointerYRef.current = null;
        return;
      }

      let folderIntent: FolderDropIntent | undefined;
      const overList = listById.get(parseListDndId(overId) ?? -1);
      if (overList?.is_folder) {
        const pointerY = pointerYRef.current;
        folderIntent =
          pointerY != null
            ? resolveFolderDropIntent({ top: over.rect.top, height: over.rect.height }, pointerY)
            : "into";
      }

      const action = resolveListDragEnd(
        lists,
        activeListIdParsed,
        overId,
        folderIntent != null ? { folderIntent } : undefined,
      );
      pointerYRef.current = null;
      if (action.type === "move") {
        onMoveListToParent(action.listId, action.parentId);
      } else if (action.type === "reorder") {
        onReorderSiblings(action.ordered, action.parentId);
      } else if (action.type === "place") {
        onPlaceList(action.listId, action.parentId, action.ordered);
      }
      return;
    }

    pointerYRef.current = null;

    if (isTaskDndId(activeId)) {
      const taskId = parseTaskDndId(activeId);
      if (taskId == null) return;

      const targetListId = parseListDndId(overId);
      if (targetListId != null) {
        const targetList = listById.get(targetListId);
        const taskIdParsed = parseTaskDndId(activeId);
        const task = taskIdParsed != null ? taskItems.find((i) => i.id === taskIdParsed) : null;
        const sourceList = task?.list_id != null ? listById.get(task.list_id) : null;
        if (sourceList?.closed || targetList?.closed) return;
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
      collisionDetection={collisionDetection}
      measuring={{
        droppable: { strategy: MeasuringStrategy.Always },
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveTask(null);
        setActiveList(null);
        pointerYRef.current = null;
      }}
    >
      <DragMonitor
        lists={lists}
        onTaskDragChange={setDraggingTask}
        onListDragChange={setDraggingList}
        onOverListChange={setOverListId}
        onActiveListChange={setActiveListId}
        onOverListRootChange={setOverListRoot}
        onFolderDropIntentChange={setFolderDropIntent}
        pointerYRef={pointerYRef}
      />
      <TaskDndUiContext.Provider
        value={{
          draggingTask,
          draggingList,
          overListId,
          activeListId,
          overListRoot,
          folderDropIntent,
        }}
      >
        {children}
      </TaskDndUiContext.Provider>
      <DragOverlay>
        {activeList ? (
          <div className="bg-background border flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 shadow-lg">
            {activeList.is_folder ? <span aria-hidden>📁</span> : null}
            <span className="truncate text-sm">{activeList.name}</span>
          </div>
        ) : null}
        {activeTask ? (
          <div className="bg-background border flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 shadow-lg">
            <span className="truncate text-sm">{activeTask.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
