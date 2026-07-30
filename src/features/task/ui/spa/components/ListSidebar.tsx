import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Checkbox, Input } from "@freeanima/ui-kit";
import { ListRow } from "@freeanima/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/ui-kit/composite";
import { useDrawerNav } from "@freeanima/ui-kit/layout";
import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState, type PointerEvent, type ReactNode, type Ref } from "react";

import { LIST_ROOT_DND_ID, listDndId } from "../lib/dnd-ids.ts";
import type { TaskListRow } from "../lib/api.ts";
import {
  buildListTree,
  flattenVisibleTree,
  readExpandedFolders,
  sortedArchivedLists,
  writeExpandedFolders,
  type ListTreeNode,
} from "@freeanima/ui-kit/lib/task-list-tree.ts";
import { useTaskDndUi } from "./TaskDndRoot.tsx";
import { EntityIdLabel } from "./EntityIdLabel.tsx";

type ListSidebarProps = {
  builtinSmartListSection?: ReactNode;
  customSmartListSection?: ReactNode;
  activeLists: TaskListRow[];
  closedLists: TaskListRow[];
  showClosed: boolean;
  selectedListId: number | null;
  selectedFolderId: number | null;
  searchSelected?: boolean;
  newListName: string;
  newFolderName: string;
  useActionSheet: boolean;
  onToggleShowClosed: () => void;
  onSelectList: (id: number) => void;
  onSelectFolder: (id: number) => void;
  onSelectSearch?: () => void;
  onCreateList: () => void;
  onCreateFolder: () => void;
  onNewListNameChange: (value: string) => void;
  onNewFolderNameChange: (value: string) => void;
  onOpenListMenu: (list: TaskListRow) => void;
  contextMenuEnabled?: boolean;
  contextMenuItemsForList?: ((list: TaskListRow) => ActionSheetItem[]) | undefined;
  onEditList: (list: TaskListRow) => void;
};

const SIDEBAR_SELECTED = "bg-primary/15 font-medium";

function SortableTreeRow({
  node,
  expanded,
  selected,
  useActionSheet,
  contextMenuEnabled,
  contextMenuItems,
  onToggleExpand,
  onSelectList,
  onSelectFolder,
  onOpenMenu,
  onEdit,
}: {
  node: ListTreeNode;
  expanded: boolean;
  selected: boolean;
  useActionSheet: boolean;
  contextMenuEnabled: boolean;
  contextMenuItems?: ActionSheetItem[] | undefined;
  onToggleExpand: () => void;
  onSelectList: () => void;
  onSelectFolder: () => void;
  onOpenMenu: () => void;
  onEdit: () => void;
}) {
  const { list, depth } = node;
  const { draggingTask, draggingList, overListId, activeListId, folderDropIntent } = useTaskDndUi();
  const isFolder = list.is_folder;
  const isTaskDropTarget = draggingTask && overListId === list.id && !isFolder;
  const isFolderIntoTarget =
    draggingList &&
    overListId === list.id &&
    isFolder &&
    activeListId !== list.id &&
    folderDropIntent === "into";
  const showBeforeLine =
    draggingList && overListId === list.id && isFolder && folderDropIntent === "before";
  const showAfterLine =
    draggingList && overListId === list.id && isFolder && folderDropIntent === "after";

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: listDndId(list.id),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${8 + depth * 16}px`,
  };

  return (
    <ListRow
      as="div"
      selected={selected}
      selectedClassName={SIDEBAR_SELECTED}
      dragging={isDragging}
      useActionSheet={useActionSheet}
      contextMenuEnabled={contextMenuEnabled}
      contextMenuItems={contextMenuItems}
      onOpenMenu={onOpenMenu}
      dragAttributes={attributes}
      dragListeners={listeners}
      rowRef={setNodeRef as Ref<HTMLElement | null>}
      rowStyle={style}
      className={[
        "touch-manipulation gap-0.5 pr-1 text-sm select-none",
        isTaskDropTarget || isFolderIntoTarget ? "ring-primary bg-primary/10 ring-2" : "",
      ].join(" ")}
      onDoubleClick={useActionSheet ? undefined : onEdit}
      overlays={
        <>
          {showBeforeLine ? (
            <div className="bg-primary absolute top-0 right-1 left-1 z-20 h-0.5 rounded-full" />
          ) : null}
          {showAfterLine ? (
            <div className="bg-primary absolute right-1 bottom-0 left-1 z-20 h-0.5 rounded-full" />
          ) : null}
        </>
      }
      leading={
        isFolder ? (
          <button
            type="button"
            className="text-muted-foreground flex min-h-11 min-w-6 shrink-0 items-center justify-center"
            aria-label={expanded ? "折叠" : "展开"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            onPointerDown={(e: PointerEvent) => e.stopPropagation()}
          >
            {expanded ? "▼" : "▶"}
          </button>
        ) : (
          <span className="min-w-6 shrink-0" aria-hidden />
        )
      }
    >
      {isFolder ? (
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 truncate py-2 text-left"
          onClick={onSelectFolder}
        >
          <span className="mr-1 shrink-0" aria-hidden>
            📁
          </span>
          <span className="min-w-0 flex-1 truncate">{list.name}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            <EntityIdLabel id={list.id} />
          </span>
        </button>
      ) : (
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 truncate py-2 text-left"
          onClick={onSelectList}
        >
          <span className="min-w-0 flex-1 truncate">{list.name}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5 tabular-nums">
            <EntityIdLabel id={list.id} />
            <span className="text-muted-foreground text-xs">{list.item_count}</span>
          </span>
        </button>
      )}
    </ListRow>
  );
}

function ClosedListRow({
  list,
  depth,
  selected,
  useActionSheet,
  contextMenuEnabled,
  contextMenuItems,
  onSelect,
  onOpenMenu,
}: {
  list: TaskListRow;
  depth: number;
  selected: boolean;
  useActionSheet: boolean;
  contextMenuEnabled: boolean;
  contextMenuItems?: ActionSheetItem[] | undefined;
  onSelect: () => void;
  onOpenMenu: () => void;
}) {
  return (
    <ListRow
      as="div"
      selected={selected}
      selectedClassName={`${SIDEBAR_SELECTED} opacity-100`}
      useActionSheet={useActionSheet}
      contextMenuEnabled={contextMenuEnabled}
      contextMenuItems={contextMenuItems}
      onOpenMenu={onOpenMenu}
      rowStyle={{ paddingLeft: `${8 + depth * 16}px` }}
      className="gap-0.5 pr-1 text-sm opacity-70"
      leading={
        <>
          <span className="min-w-6 shrink-0" aria-hidden />
          <span className="min-w-8 shrink-0" aria-hidden />
        </>
      }
    >
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
            <span className="min-w-0 flex-1 truncate">{list.name}</span>
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              <EntityIdLabel id={list.id} />
            </span>
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate">{list.name}</span>
            <span className="ml-auto flex shrink-0 items-center gap-1.5 tabular-nums">
              <EntityIdLabel id={list.id} />
              <span className="text-muted-foreground text-xs">{list.item_count}</span>
            </span>
          </>
        )}
      </button>
    </ListRow>
  );
}

function ClosedListsSection({
  closedLists,
  selectedListId,
  useActionSheet,
  contextMenuEnabled,
  contextMenuItemsForList,
  onSelectList,
  onOpenListMenu,
}: {
  closedLists: TaskListRow[];
  selectedListId: number | null;
  useActionSheet: boolean;
  contextMenuEnabled: boolean;
  contextMenuItemsForList?: ((list: TaskListRow) => ActionSheetItem[]) | undefined;
  onSelectList: (id: number) => void;
  onOpenListMenu: (list: TaskListRow) => void;
}) {
  const rows = sortedArchivedLists(closedLists);

  return (
    <>
      {rows.map((list) => (
        <ClosedListRow
          key={list.id}
          list={list}
          depth={0}
          selected={selectedListId === list.id}
          useActionSheet={useActionSheet}
          contextMenuEnabled={contextMenuEnabled}
          contextMenuItems={contextMenuItemsForList?.(list)}
          onSelect={() => onSelectList(list.id)}
          onOpenMenu={() => onOpenListMenu(list)}
        />
      ))}
    </>
  );
}

export function ListSidebar({
  builtinSmartListSection,
  customSmartListSection,
  activeLists,
  closedLists,
  showClosed,
  selectedListId,
  selectedFolderId,
  searchSelected = false,
  newListName,
  newFolderName,
  useActionSheet,
  onToggleShowClosed,
  onSelectList,
  onSelectFolder,
  onSelectSearch,
  onCreateList,
  onCreateFolder,
  onNewListNameChange,
  onNewFolderNameChange,
  onOpenListMenu,
  contextMenuEnabled = false,
  contextMenuItemsForList,
  onEditList,
}: ListSidebarProps) {
  const useDrawer = useDrawerNav();
  const { draggingTask, draggingList, overListRoot } = useTaskDndUi();
  const { setNodeRef: setListRootRef } = useDroppable({ id: LIST_ROOT_DND_ID });
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

  const isRootDropTarget = draggingList && overListRoot;

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
        <div className="flex-1 overflow-y-auto">
          {onSelectSearch ? (
            <div className="p-2 pb-0">
              <ListRow
                as="div"
                selected={searchSelected}
                selectedClassName={SIDEBAR_SELECTED}
                useActionSheet={false}
                showPersistentMenu={false}
                className="w-full gap-2 px-2 text-sm"
                onClick={onSelectSearch}
                leading={<SearchIcon className="size-4 shrink-0" aria-hidden />}
              >
                <span className="min-w-0 flex-1 truncate text-left">搜索</span>
              </ListRow>
            </div>
          ) : null}
          {builtinSmartListSection}
          {customSmartListSection}
          <div className="border-t p-2">
            {/* 固定高度根 droppable：始终预留边框，避免 dragStart 改尺寸导致 Overlay 错位 */}
            <div
              ref={setListRootRef}
              className={[
                "sticky top-0 z-10 mb-1 flex h-8 items-center rounded-md border border-transparent px-2 text-xs font-medium",
                draggingList && !isRootDropTarget
                  ? "text-muted-foreground/80 border-muted-foreground/30 border-dashed"
                  : "text-muted-foreground",
                isRootDropTarget
                  ? "ring-primary bg-primary/15 border-primary text-foreground border-dashed ring-2"
                  : "",
              ].join(" ")}
            >
              {isRootDropTarget ? "移到顶级" : draggingList ? "清单（拖到此处移到顶级）" : "清单"}
            </div>
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
                useActionSheet={useActionSheet}
                contextMenuEnabled={contextMenuEnabled}
                contextMenuItems={contextMenuItemsForList?.(node.list)}
                onToggleExpand={() => toggleExpand(node.list.id)}
                onSelectList={() => onSelectList(node.list.id)}
                onSelectFolder={() => onSelectFolder(node.list.id)}
                onOpenMenu={() => onOpenListMenu(node.list)}
                onEdit={() => onEditList(node.list)}
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
                  <ClosedListsSection
                    closedLists={closedLists}
                    selectedListId={selectedListId}
                    useActionSheet={useActionSheet}
                    contextMenuEnabled={contextMenuEnabled}
                    contextMenuItemsForList={contextMenuItemsForList}
                    onSelectList={onSelectList}
                    onOpenListMenu={onOpenListMenu}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
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
