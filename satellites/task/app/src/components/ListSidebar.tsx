import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Checkbox, Input } from "@freeanima/ui-kit";
import { useDrawerNav } from "@freeanima/ui-kit/layout";
import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { listDndId } from "../lib/dnd-ids.ts";
import type { TaskListRow } from "../lib/api.ts";
import {
  buildListTree,
  flattenVisibleTree,
  readExpandedFolders,
  writeExpandedFolders,
  type ListTreeNode,
} from "../lib/list-tree.ts";
import { useTaskDndUi } from "./TaskDndRoot.tsx";
import { EntityIdLabel } from "./EntityIdLabel.tsx";

type ListSidebarProps = {
  activeLists: TaskListRow[];
  closedLists: TaskListRow[];
  showClosed: boolean;
  selectedListId: number | null;
  selectedFolderId: number | null;
  editingListId: number | null;
  editingListName: string;
  newListName: string;
  newFolderName: string;
  renameInputRef: RefObject<HTMLInputElement | null>;
  useActionSheet: boolean;
  onToggleShowClosed: () => void;
  onSelectList: (id: number) => void;
  onSelectFolder: (id: number) => void;
  onCreateList: () => void;
  onCreateFolder: () => void;
  onNewListNameChange: (value: string) => void;
  onNewFolderNameChange: (value: string) => void;
  onEditingListNameChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onOpenListMenu: (list: TaskListRow) => void;
  onOpenListContextMenu: (e: MouseEvent, list: TaskListRow) => void;
  onStartRename: (list: TaskListRow) => void;
};

function SortableTreeRow({
  node,
  expanded,
  selected,
  editing,
  editingName,
  renameInputRef,
  useActionSheet,
  onToggleExpand,
  onSelectList,
  onSelectFolder,
  onEditingNameChange,
  onCommitRename,
  onCancelRename,
  onOpenMenu,
  onContextMenu,
  onDoubleClickRename,
}: {
  node: ListTreeNode;
  expanded: boolean;
  selected: boolean;
  editing: boolean;
  editingName: string;
  renameInputRef: RefObject<HTMLInputElement | null>;
  useActionSheet: boolean;
  onToggleExpand: () => void;
  onSelectList: () => void;
  onSelectFolder: () => void;
  onEditingNameChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onOpenMenu: () => void;
  onContextMenu: (e: MouseEvent) => void;
  onDoubleClickRename?: () => void;
}) {
  const { list, depth } = node;
  const { draggingTask, draggingList, overListId } = useTaskDndUi();
  const isFolder = list.is_folder;
  const isTaskDropTarget = draggingTask && overListId === list.id && !isFolder;
  const isFolderDropTarget =
    draggingList && overListId === list.id && isFolder && list.id !== node.list.id;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: listDndId(list.id),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${8 + depth * 16}px`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "group flex min-h-11 items-center gap-0.5 rounded-lg py-1 pr-1 text-sm",
        selected ? "bg-primary/15 font-medium" : "hover:bg-muted",
        isDragging ? "opacity-50" : "",
        isTaskDropTarget || isFolderDropTarget ? "ring-primary bg-primary/10 ring-2" : "",
      ].join(" ")}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClickRename}
    >
      {isFolder ? (
        <button
          type="button"
          className="text-muted-foreground flex min-h-11 min-w-6 shrink-0 items-center justify-center"
          aria-label={expanded ? "折叠" : "展开"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
        >
          {expanded ? "▼" : "▶"}
        </button>
      ) : (
        <span className="min-w-6 shrink-0" aria-hidden />
      )}
      <button
        type="button"
        title="拖拽排序"
        className="text-foreground/40 hover:text-foreground flex min-h-11 min-w-8 shrink-0 cursor-grab items-center justify-center select-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        ⋮⋮
      </button>
      {editing ? (
        <Input
          ref={renameInputRef}
          className="h-7 min-w-0 flex-1 px-2 text-xs"
          value={editingName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onBlur={() => onCommitRename()}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitRename();
            if (e.key === "Escape") onCancelRename();
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : isFolder ? (
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 truncate py-2 text-left"
          onClick={onSelectFolder}
        >
          <span className="mr-1 shrink-0" aria-hidden>
            📁
          </span>
          <span className="truncate">{list.name}</span>
          <EntityIdLabel id={list.id} />
        </button>
      ) : (
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 truncate py-2 text-left"
          onClick={onSelectList}
        >
          <span className="truncate">{list.name}</span>
          <EntityIdLabel id={list.id} />
          <span className="text-muted-foreground shrink-0 text-xs">{list.item_count}</span>
        </button>
      )}
      {useActionSheet && !editing ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="操作"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu();
          }}
        >
          ⋯
        </Button>
      ) : null}
    </div>
  );
}

function ClosedListRow({
  list,
  depth,
  selected,
  useActionSheet,
  onSelect,
  onOpenMenu,
  onContextMenu,
}: {
  list: TaskListRow;
  depth: number;
  selected: boolean;
  useActionSheet: boolean;
  onSelect: () => void;
  onOpenMenu: () => void;
  onContextMenu: (e: MouseEvent) => void;
}) {
  return (
    <div
      style={{ paddingLeft: `${8 + depth * 16}px` }}
      className={[
        "group flex min-h-11 items-center gap-0.5 rounded-lg py-1 pr-1 text-sm opacity-70",
        selected ? "bg-primary/15 font-medium opacity-100" : "hover:bg-muted",
      ].join(" ")}
      onContextMenu={onContextMenu}
    >
      <span className="min-w-6 shrink-0" aria-hidden />
      <span className="min-w-8 shrink-0" aria-hidden />
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-1 truncate py-2 text-left"
        onClick={onSelect}
      >
        {list.is_folder ? (
          <>
            <span className="mr-1 shrink-0" aria-hidden>
              📁
            </span>
            <span className="truncate">{list.name}</span>
            <EntityIdLabel id={list.id} />
          </>
        ) : (
          <>
            <span className="truncate">{list.name}</span>
            <EntityIdLabel id={list.id} />
            <span className="text-muted-foreground shrink-0 text-xs">{list.item_count}</span>
          </>
        )}
      </button>
      {useActionSheet ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="操作"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu();
          }}
        >
          ⋯
        </Button>
      ) : null}
    </div>
  );
}

function ClosedTreeSection({
  closedLists,
  selectedListId,
  useActionSheet,
  onSelectList,
  onOpenListMenu,
  onOpenListContextMenu,
}: {
  closedLists: TaskListRow[];
  selectedListId: number | null;
  useActionSheet: boolean;
  onSelectList: (id: number) => void;
  onOpenListMenu: (list: TaskListRow) => void;
  onOpenListContextMenu: (e: MouseEvent, list: TaskListRow) => void;
}) {
  const nodes = buildListTree(closedLists);

  function renderNodes(treeNodes: ListTreeNode[]): ReactNode {
    return treeNodes.map((node) => (
      <div key={node.list.id}>
        <ClosedListRow
          list={node.list}
          depth={node.depth}
          selected={selectedListId === node.list.id}
          useActionSheet={useActionSheet}
          onSelect={() => {
            if (!node.list.is_folder) onSelectList(node.list.id);
          }}
          onOpenMenu={() => onOpenListMenu(node.list)}
          onContextMenu={(e) => onOpenListContextMenu(e, node.list)}
        />
        {node.list.is_folder && node.children.length > 0 ? renderNodes(node.children) : null}
      </div>
    ));
  }

  return <>{renderNodes(nodes)}</>;
}

export function ListSidebar({
  activeLists,
  closedLists,
  showClosed,
  selectedListId,
  selectedFolderId,
  editingListId,
  editingListName,
  newListName,
  newFolderName,
  renameInputRef,
  useActionSheet,
  onToggleShowClosed,
  onSelectList,
  onSelectFolder,
  onCreateList,
  onCreateFolder,
  onNewListNameChange,
  onNewFolderNameChange,
  onEditingListNameChange,
  onCommitRename,
  onCancelRename,
  onOpenListMenu,
  onOpenListContextMenu,
  onStartRename,
}: ListSidebarProps) {
  const useDrawer = useDrawerNav();
  const { draggingTask } = useTaskDndUi();
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(() =>
    readExpandedFolders(),
  );

  useEffect(() => {
    writeExpandedFolders(expandedFolderIds);
  }, [expandedFolderIds]);

  const tree = useMemo(() => buildListTree(activeLists), [activeLists]);
  const visibleNodes = useMemo(
    () => flattenVisibleTree(tree, expandedFolderIds),
    [tree, expandedFolderIds],
  );

  const toggleExpand = (folderId: number) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {draggingTask && useDrawer ? (
        <div className="border bg-muted/80 text-muted-foreground shrink-0 border-b px-3 py-1.5 text-xs">
          拖放到清单以移动任务
        </div>
      ) : null}
      {draggingTask && !useDrawer ? (
        <div className="border text-muted-foreground shrink-0 border-b px-3 pb-2 text-xs">
          拖到清单以移动任务
        </div>
      ) : null}
      <SortableContext
        items={visibleNodes.map((n) => listDndId(n.list.id))}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 overflow-y-auto p-2">
          {visibleNodes.map((node) => (
            <SortableTreeRow
              key={node.list.id}
              node={node}
              expanded={expandedFolderIds.has(node.list.id)}
              selected={
                node.list.is_folder
                  ? selectedFolderId === node.list.id
                  : selectedListId === node.list.id
              }
              editing={editingListId === node.list.id}
              editingName={editingListName}
              renameInputRef={renameInputRef}
              useActionSheet={useActionSheet}
              onToggleExpand={() => toggleExpand(node.list.id)}
              onSelectList={() => onSelectList(node.list.id)}
              onSelectFolder={() => onSelectFolder(node.list.id)}
              onEditingNameChange={onEditingListNameChange}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onOpenMenu={() => onOpenListMenu(node.list)}
              onContextMenu={(e) => onOpenListContextMenu(e, node.list)}
              onDoubleClickRename={useActionSheet ? undefined : () => onStartRename(node.list)}
            />
          ))}
          {closedLists.length > 0 ? (
            <div className="border/60 mt-2 space-y-1 border-t pt-2">
              <label className="text-muted-foreground flex cursor-pointer select-none items-center gap-2 px-1 py-1 text-xs">
                <Checkbox
                  className="size-3.5"
                  checked={showClosed}
                  onCheckedChange={onToggleShowClosed}
                />
                显示已归档
              </label>
              {showClosed ? (
                <ClosedTreeSection
                  closedLists={closedLists}
                  selectedListId={selectedListId}
                  useActionSheet={useActionSheet}
                  onSelectList={onSelectList}
                  onOpenListMenu={onOpenListMenu}
                  onOpenListContextMenu={onOpenListContextMenu}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </SortableContext>
      <div className="border flex shrink-0 flex-col gap-1 border-t p-2">
        <div className="flex gap-1">
          <Input
            className="h-8 min-w-0 flex-1"
            placeholder="新清单"
            value={newListName}
            onChange={(e) => onNewListNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCreateList();
            }}
          />
          <Button type="button" size="sm" onClick={onCreateList}>
            +
          </Button>
        </div>
        <div className="flex gap-1">
          <Input
            className="h-8 min-w-0 flex-1"
            placeholder="新文件夹"
            value={newFolderName}
            onChange={(e) => onNewFolderNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCreateFolder();
            }}
          />
          <Button type="button" variant="ghost" size="sm" onClick={onCreateFolder}>
            📁
          </Button>
        </div>
      </div>
    </div>
  );
}
