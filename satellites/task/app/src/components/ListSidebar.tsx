import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MouseEvent, RefObject } from "react";

import { listDndId } from "../lib/dnd-ids.ts";
import type { TaskListRow } from "../lib/api.ts";
import { useMobileLayout } from "../lib/platform.ts";
import { useTaskDndUi } from "./TaskDndRoot.tsx";

type ListSidebarProps = {
  lists: TaskListRow[];
  selectedListId: number | null;
  editingListId: number | null;
  editingListName: string;
  newListName: string;
  renameInputRef: RefObject<HTMLInputElement | null>;
  useActionSheet: boolean;
  onSelectList: (id: number) => void;
  onCreateList: () => void;
  onNewListNameChange: (value: string) => void;
  onEditingListNameChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onOpenListMenu: (list: TaskListRow) => void;
  onOpenListContextMenu: (e: MouseEvent, list: TaskListRow) => void;
  onStartRename: (list: TaskListRow) => void;
};

function SortableListRow({
  list,
  selected,
  editing,
  editingName,
  renameInputRef,
  useActionSheet,
  onSelect,
  onEditingNameChange,
  onCommitRename,
  onCancelRename,
  onOpenMenu,
  onContextMenu,
  onDoubleClickRename,
}: {
  list: TaskListRow;
  selected: boolean;
  editing: boolean;
  editingName: string;
  renameInputRef: RefObject<HTMLInputElement | null>;
  useActionSheet: boolean;
  onSelect: () => void;
  onEditingNameChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onOpenMenu: () => void;
  onContextMenu: (e: MouseEvent) => void;
  onDoubleClickRename?: () => void;
}) {
  const { draggingTask, overListId } = useTaskDndUi();
  const isDropTarget = draggingTask && overListId === list.id;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: listDndId(list.id),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "group flex min-h-11 items-center gap-0.5 rounded-lg px-1 py-1 text-sm",
        selected ? "bg-primary/15 font-medium" : "hover:bg-base-200",
        isDragging ? "opacity-50" : "",
        isDropTarget ? "ring-primary bg-primary/10 ring-2" : "",
      ].join(" ")}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClickRename}
    >
      <button
        type="button"
        title="拖拽排序"
        className="text-base-content/40 hover:text-base-content flex min-h-11 min-w-8 shrink-0 cursor-grab items-center justify-center select-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        ⋮⋮
      </button>
      {editing ? (
        <input
          ref={renameInputRef}
          className="input input-xs input-bordered min-w-0 flex-1"
          value={editingName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onBlur={() => onCommitRename()}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitRename();
            if (e.key === "Escape") onCancelRename();
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <button type="button" className="min-w-0 flex-1 truncate py-2 text-left" onClick={onSelect}>
          {list.name}
          <span className="text-base-content/50 ml-1 text-xs">{list.item_count}</span>
        </button>
      )}
      {useActionSheet && !editing ? (
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square shrink-0"
          aria-label="清单操作"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu();
          }}
        >
          ⋯
        </button>
      ) : null}
    </div>
  );
}

export function ListSidebar({
  lists,
  selectedListId,
  editingListId,
  editingListName,
  newListName,
  renameInputRef,
  useActionSheet,
  onSelectList,
  onCreateList,
  onNewListNameChange,
  onEditingListNameChange,
  onCommitRename,
  onCancelRename,
  onOpenListMenu,
  onOpenListContextMenu,
  onStartRename,
}: ListSidebarProps) {
  const mobileLayout = useMobileLayout();
  const { draggingTask } = useTaskDndUi();

  return (
    <>
      {draggingTask && mobileLayout ? (
        <div className="border-base-300 bg-base-200/80 text-base-content/70 border-b px-3 py-1.5 text-xs lg:hidden">
          拖放到清单以移动任务
        </div>
      ) : null}
      <div className="border-base-300 hidden border-b p-3 lg:block">
        <h2 className="text-sm font-semibold">清单</h2>
        {draggingTask ? (
          <p className="text-base-content/50 mt-1 text-xs">拖到清单以移动任务</p>
        ) : null}
      </div>
      <SortableContext
        items={lists.map((l) => listDndId(l.id))}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 overflow-y-auto p-2">
          {lists.map((list) => (
            <SortableListRow
              key={list.id}
              list={list}
              selected={selectedListId === list.id}
              editing={editingListId === list.id}
              editingName={editingListName}
              renameInputRef={renameInputRef}
              useActionSheet={useActionSheet}
              onSelect={() => onSelectList(list.id)}
              onEditingNameChange={onEditingListNameChange}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onOpenMenu={() => onOpenListMenu(list)}
              onContextMenu={(e) => onOpenListContextMenu(e, list)}
              onDoubleClickRename={useActionSheet ? undefined : () => onStartRename(list)}
            />
          ))}
        </div>
      </SortableContext>
      <div className="border-base-300 flex gap-1 border-t p-2">
        <input
          className="input input-sm input-bordered min-w-0 flex-1"
          placeholder="新清单"
          value={newListName}
          onChange={(e) => onNewListNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCreateList();
          }}
        />
        <button type="button" className="btn btn-primary btn-sm" onClick={onCreateList}>
          +
        </button>
      </div>
    </>
  );
}
