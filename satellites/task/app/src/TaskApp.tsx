import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useSubjectScope } from "@freeanima/shell-sdk/react";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Spinner,
} from "@freeanima/ui-kit";

import { ActionSheet, ConfirmDialog, EmptyState } from "@freeanima/ui-kit/composite";
import { CompletedTaskList } from "./components/CompletedTaskList.tsx";
import { ContextMenu, type ContextMenuItem } from "./components/ContextMenu.tsx";
import { ListSidebar } from "./components/ListSidebar.tsx";
import { MoveToListPicker } from "./components/MoveToListPicker.tsx";
import { SortableTaskList } from "./components/SortableTaskList.tsx";
import { TaskDetailPanel } from "./components/TaskDetailPanel.tsx";
import { TaskDndRoot } from "./components/TaskDndRoot.tsx";
import { ThreeColumnLayout } from "@freeanima/ui-kit/layout";
import {
  completeTaskItem,
  createTaskItem,
  createTaskList,
  closeTaskList,
  deleteTaskItem,
  deleteTaskList,
  fetchTaskItems,
  fetchTaskLists,
  reopenTaskList,
  searchTaskItems,
  uncompleteTaskItem,
  updateTaskItem,
  updateTaskList,
  type TaskItemRow,
  type TaskListRow,
} from "./lib/api.ts";
import {
  readCachedTaskItems,
  readCachedTaskLists,
  resolveHubCacheScope,
  writeCachedTaskItems,
  writeCachedTaskLists,
} from "./lib/offline-cache.ts";
import { useTaskLayoutMode } from "./lib/layout-mode.ts";
import {
  isTaskContextMenuEnabled,
  isWebShell,
  useDrawerNav,
  useTaskActionSheet,
} from "./lib/platform.ts";
import { readListIdFromUrl, writeListIdToUrl } from "./lib/list-url.ts";
import { moveTaskItemsToList } from "./lib/move-items.ts";
import { applyShiftRangeSelect } from "./lib/range-select.ts";
import { resolveDefaultListId, resolveSelectedListIdWithUrl } from "./lib/resolve-list.ts";
import { getParentId, getSiblings } from "./lib/list-tree.ts";
import { sortOrderUpdates } from "./lib/reorder.ts";
import { buildItemMenuItems, buildListMenuItems } from "./lib/task-menus.ts";
import { cloneTaskItem, isTaskItemDirty } from "./lib/task-detail-dirty.ts";

type ListMenuState = { x: number; y: number; listId: number };
type ItemMenuState = { x: number; y: number; itemId: number };
type SheetMenuState = { title?: string; items: ContextMenuItem[] };
type ChildNamePromptState = { kind: "list" | "folder"; parentId: number };

export function TaskApp() {
  const { kind: subjectKind } = useSubjectScope();
  const contextMenuEnabled = isTaskContextMenuEnabled();
  const useActionSheet = useTaskActionSheet();
  const useDrawer = useDrawerNav();
  const layoutMode = useTaskLayoutMode();
  const webShell = isWebShell();
  const renameInputRef = useRef<HTMLInputElement>(null);
  const selectionAnchorRef = useRef<number | null>(null);
  const detailDiscardRef = useRef(false);

  const [lists, setLists] = useState<TaskListRow[]>([]);
  const [items, setItems] = useState<TaskItemRow[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newListName, setNewListName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<TaskItemRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [detailItem, setDetailItem] = useState<TaskItemRow | null>(null);
  const [detailBaseline, setDetailBaseline] = useState<TaskItemRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [editingListName, setEditingListName] = useState("");

  const [listMenu, setListMenu] = useState<ListMenuState | null>(null);
  const [itemMenu, setItemMenu] = useState<ItemMenuState | null>(null);
  const [sheetMenu, setSheetMenu] = useState<SheetMenuState | null>(null);
  const [listToDelete, setListToDelete] = useState<TaskListRow | null>(null);
  const [childNamePrompt, setChildNamePrompt] = useState<ChildNamePromptState | null>(null);
  const [childNamePromptValue, setChildNamePromptValue] = useState("");

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(() => new Set());
  const [movePickerItemIds, setMovePickerItemIds] = useState<number[] | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const loadLists = useCallback(async (): Promise<TaskListRow[]> => {
    const scope = resolveHubCacheScope();
    const cached = await readCachedTaskLists(scope);
    if (cached?.length) setLists(cached);
    try {
      const rows = await fetchTaskLists({ includeClosed: true });
      setLists(rows);
      void writeCachedTaskLists(scope, rows);
      if (rows.length === 0) {
        setSelectedListId(null);
        setItems([]);
        return rows;
      }
      setSelectedListId((prev) => {
        const next = resolveSelectedListIdWithUrl(rows, {
          webShell,
          currentId: prev,
          urlListId: webShell ? readListIdFromUrl() : null,
        });
        if (webShell && next != null) writeListIdToUrl(next);
        return next;
      });
      return rows;
    } catch {
      if (!cached?.length) setError("无法加载任务清单");
      return cached ?? [];
    }
  }, [webShell]);

  const loadItems = useCallback(async (listId: number) => {
    const scope = resolveHubCacheScope();
    const cached = await readCachedTaskItems(scope, listId);
    if (cached) setItems(cached);
    try {
      const rows = await fetchTaskItems(listId);
      setItems(rows);
      void writeCachedTaskItems(scope, listId, rows);
    } catch {
      if (!cached) setItems([]);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [loadLists]);

  useEffect(() => {
    setSelectedListId(null);
    setItems([]);
    setSearchQuery("");
    setSearchHits([]);
    void refresh();
  }, [subjectKind, refresh]);

  useEffect(() => {
    if (selectedListId == null) return;
    void loadItems(selectedListId).catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
    setSelectionMode(false);
    setSelectedItemIds(new Set());
    selectionAnchorRef.current = null;
    setSearchQuery("");
    setSearchHits([]);
    setDetailItem(null);
    setDetailBaseline(null);
    setDetailOpen(false);
  }, [selectedListId, loadItems]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      void searchTaskItems({ query: q, limit: 30 })
        .then(setSearchHits)
        .catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setSearchHits([]);
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const refreshSearchHits = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    try {
      setSearchHits(await searchTaskItems({ query: q, limit: 30 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [searchQuery]);

  const searchActive = searchQuery.trim().length > 0;

  useEffect(() => {
    if (editingListId == null) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [editingListId]);

  const selectList = (id: number) => {
    setSelectedListId(id);
    setSelectedFolderId(null);
    if (lists.find((l) => l.id === id)?.closed) setShowClosed(true);
    if (webShell) writeListIdToUrl(id);
    if (useDrawer) setSidebarOpen(false);
  };

  const selectFolder = (id: number) => {
    setSelectedFolderId(id);
  };

  const createParentId = selectedFolderId;

  const handleCreateList = async (opts?: { parentId?: number | null; name?: string }) => {
    const name = (opts?.name ?? newListName).trim();
    if (!name) return;
    const parent_id = opts?.parentId !== undefined ? opts.parentId : createParentId;
    try {
      const siblings = getSiblings(
        lists.filter((l) => !l.closed),
        parent_id ?? null,
      );
      const list = await createTaskList({
        name,
        parent_id: parent_id ?? null,
        sort_order: siblings.length,
      });
      if (!opts?.name) setNewListName("");
      await loadLists();
      selectList(list.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreateFolder = async (opts?: { parentId?: number | null; name?: string }) => {
    const name = (opts?.name ?? newFolderName).trim();
    if (!name) return;
    const parent_id = opts?.parentId !== undefined ? opts.parentId : createParentId;
    try {
      const siblings = getSiblings(
        lists.filter((l) => !l.closed),
        parent_id ?? null,
      );
      const folder = await createTaskList({
        name,
        is_folder: true,
        parent_id: parent_id ?? null,
        sort_order: siblings.length,
      });
      if (!opts?.name) setNewFolderName("");
      setSelectedFolderId(folder.id);
      await loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const startRenameList = (list: TaskListRow) => {
    if (list.closed) return;
    setEditingListId(list.id);
    setEditingListName(list.name);
  };

  const commitRenameList = async () => {
    if (editingListId == null) return;
    const name = editingListName.trim();
    setEditingListId(null);
    if (!name) return;
    const current = lists.find((l) => l.id === editingListId);
    if (!current || current.name === name) return;
    try {
      await updateTaskList(editingListId, { name });
      await loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteList = (list: TaskListRow) => {
    if (list.is_default) return;
    setListToDelete(list);
  };

  const confirmDeleteList = async () => {
    const list = listToDelete;
    if (!list) return;
    setListToDelete(null);
    try {
      await deleteTaskList(list.id);
      if (selectedFolderId === list.id) setSelectedFolderId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCloseList = async (list: TaskListRow) => {
    if (list.is_default || list.closed || list.is_folder) return;
    const wasSelected = selectedListId === list.id;
    try {
      await closeTaskList(list.id);
      const rows = await loadLists();
      if (wasSelected) {
        const nextId = resolveDefaultListId(rows.filter((l) => !l.closed));
        setSelectedListId(nextId);
        if (webShell && nextId != null) writeListIdToUrl(nextId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReopenList = async (list: TaskListRow) => {
    if (!list.closed) return;
    try {
      await reopenTaskList(list.id);
      await loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const persistSiblingOrder = async (ordered: TaskListRow[], parentId: number | null) => {
    const closed = lists.filter((l) => l.closed);
    const active = lists.filter((l) => !l.closed);
    const siblingIds = new Set(ordered.map((l) => l.id));
    const others = active.filter((l) => getParentId(l) !== parentId || !siblingIds.has(l.id));
    const nextSiblings = ordered.map((list, index) => ({ ...list, sort_order: index }));
    const mergedActive = [...others, ...nextSiblings].toSorted(
      (a, b) => a.sort_order - b.sort_order || a.id - b.id,
    );
    setLists([...mergedActive, ...closed]);
    const updates = sortOrderUpdates(nextSiblings);
    try {
      await Promise.all(updates.map((u) => updateTaskList(u.id, { sort_order: u.sort_order })));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await loadLists();
    }
  };

  const persistMoveListToParent = async (listId: number, parentId: number | null) => {
    const siblings = getSiblings(
      lists.filter((l) => !l.closed),
      parentId,
    ).filter((l) => l.id !== listId);
    try {
      await updateTaskList(listId, {
        parent_id: parentId,
        sort_order: siblings.length,
      });
      await loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await loadLists();
    }
  };

  const persistItemOrder = async (orderedPending: TaskItemRow[]) => {
    const completed = items.filter((i) => i.status === "completed");
    const merged = [...orderedPending, ...completed];
    setItems(merged.map((item, index) => ({ ...item, sort_order: index })));
    const updates = sortOrderUpdates(orderedPending);
    try {
      await Promise.all(updates.map((u) => updateTaskItem(u.id, { sort_order: u.sort_order })));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      if (selectedListId != null) await loadItems(selectedListId);
    }
  };

  const handleQuickAdd = async () => {
    const title = quickTitle.trim();
    if (!title || selectedListId == null) return;
    try {
      const pending = items.filter((i) => i.status === "pending");
      await createTaskItem({ title, list_id: selectedListId, sort_order: pending.length });
      setQuickTitle("");
      await Promise.all([loadItems(selectedListId), loadLists()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleComplete = async (item: TaskItemRow) => {
    try {
      if (item.status === "completed") {
        await uncompleteTaskItem(item.id);
      } else {
        await completeTaskItem(item.id);
      }
      if (selectedListId != null) {
        await Promise.all([loadItems(selectedListId), loadLists()]);
      }
      if (searchActive) await refreshSearchHits();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteItem = async (item: TaskItemRow) => {
    try {
      await deleteTaskItem(item.id);
      setSelectedItemIds((prev) => {
        if (!prev.has(item.id)) return prev;
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      if (selectedListId != null) {
        await Promise.all([loadItems(selectedListId), loadLists()]);
      }
      if (searchActive) await refreshSearchHits();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedItemIds(new Set());
    selectionAnchorRef.current = null;
  };

  const enterSelectionWithItem = (itemId: number) => {
    setSelectionMode(true);
    setSelectedItemIds(new Set([itemId]));
    selectionAnchorRef.current = itemId;
  };

  const handleMoveItemsToList = async (itemIds: number[], targetListId: number) => {
    if (itemIds.length === 0 || targetListId === selectedListId) return;
    try {
      await moveTaskItemsToList(itemIds, targetListId);
      setMovePickerItemIds(null);
      exitSelectionMode();
      await Promise.all([
        selectedListId != null ? loadItems(selectedListId) : Promise.resolve(),
        loadLists(),
      ]);
      if (searchActive) await refreshSearchHits();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const openMovePickerForItems = (itemIds: number[]) => {
    if (itemIds.length === 0) return;
    setMovePickerItemIds(itemIds);
  };

  const openTaskDetail = useCallback(
    (item: TaskItemRow) => {
      setDetailItem((prev) => {
        if (prev?.id === item.id) return prev;
        const copy = cloneTaskItem(item);
        setDetailBaseline(copy);
        return copy;
      });
      if (layoutMode !== "wide") setDetailOpen(true);
    },
    [layoutMode],
  );

  const closeTaskDetail = useCallback((opts?: { discard?: boolean }) => {
    if (opts?.discard) detailDiscardRef.current = true;
    setDetailItem(null);
    setDetailBaseline(null);
    setDetailOpen(false);
  }, []);

  const saveDetailItem = useCallback(async () => {
    const item = detailItem;
    if (!item) return;
    setDetailSaving(true);
    try {
      await updateTaskItem(item.id, {
        title: item.title,
        content: item.content,
        tags: item.tags,
        priority: item.priority,
        due_at: item.due_at,
      });
      detailDiscardRef.current = false;
      setDetailItem(null);
      setDetailBaseline(null);
      setDetailOpen(false);
      if (selectedListId != null) await loadItems(selectedListId);
      if (searchQuery.trim()) await refreshSearchHits();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDetailSaving(false);
    }
  }, [detailItem, loadItems, refreshSearchHits, searchQuery, selectedListId]);

  const handleDetailOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setDetailOpen(true);
        return;
      }
      if (detailDiscardRef.current) {
        detailDiscardRef.current = false;
        setDetailItem(null);
        setDetailBaseline(null);
        setDetailOpen(false);
        return;
      }
      if (
        detailItem &&
        detailBaseline &&
        isTaskItemDirty(detailItem, detailBaseline) &&
        !detailSaving
      ) {
        void saveDetailItem();
        return;
      }
      setDetailItem(null);
      setDetailBaseline(null);
      setDetailOpen(false);
    },
    [detailBaseline, detailItem, detailSaving, saveDetailItem],
  );

  useEffect(() => {
    if (layoutMode === "wide") {
      setDetailOpen(false);
    } else if (detailItem) {
      setDetailOpen(true);
    }
  }, [layoutMode, detailItem?.id]);

  const selectedList = lists.find((l) => l.id === selectedListId) ?? null;
  const activeLists = useMemo(() => lists.filter((l) => !l.closed), [lists]);
  const closedLists = useMemo(() => lists.filter((l) => l.closed), [lists]);
  const moveTargetLists = activeLists;
  const listNameById = useMemo(() => new Map(lists.map((l) => [l.id, l.name])), [lists]);
  const pendingItems = items.filter((i) => i.status === "pending");
  const completedItems = items.filter((i) => i.status === "completed");
  const searchPending = searchHits.filter((i) => i.status === "pending");
  const searchCompleted = searchHits.filter((i) => i.status === "completed");
  const displayPending = searchActive ? searchPending : pendingItems;
  const displayCompleted = searchActive ? searchCompleted : completedItems;
  const resolveListName = useCallback(
    (item: TaskItemRow) => listNameById.get(item.list_id) ?? `#${item.list_id}`,
    [listNameById],
  );
  const allVisibleItems = searchActive ? searchHits : items;
  const selectableOrder = useMemo(() => allVisibleItems.map((i) => i.id), [allVisibleItems]);

  const handleSelectItem = (itemId: number, shiftKey: boolean) => {
    if (!selectionMode) return;

    setSelectedItemIds((prev) => {
      if (shiftKey) {
        return applyShiftRangeSelect(prev, selectableOrder, selectionAnchorRef.current, itemId);
      }
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

    if (!shiftKey) {
      selectionAnchorRef.current = itemId;
    }
  };

  const openChildNamePrompt = (kind: ChildNamePromptState["kind"], parentId: number) => {
    setChildNamePromptValue("");
    setChildNamePrompt({ kind, parentId });
  };

  const confirmChildNamePrompt = () => {
    const name = childNamePromptValue.trim();
    if (!name || childNamePrompt == null) return;
    if (childNamePrompt.kind === "folder") {
      void handleCreateFolder({ parentId: childNamePrompt.parentId, name });
    } else {
      void handleCreateList({ parentId: childNamePrompt.parentId, name });
    }
    setChildNamePrompt(null);
  };

  const menuHandlers = {
    onRename: startRenameList,
    onClose: handleCloseList,
    onReopen: handleReopenList,
    onDelete: handleDeleteList,
    onCreateChildFolder: (folder: TaskListRow) => openChildNamePrompt("folder", folder.id),
    onCreateChildList: (folder: TaskListRow) => openChildNamePrompt("list", folder.id),
  };

  const itemHandlers = {
    onEdit: openTaskDetail,
    onToggleComplete: toggleComplete,
    onMoveTo: (item: TaskItemRow) => openMovePickerForItems([item.id]),
    onDelete: handleDeleteItem,
  };

  const selectionToolbar = (
    <>
      <Button
        type="button"
        variant={selectionMode ? "secondary" : "ghost"}
        size="sm"
        onClick={() => {
          if (selectionMode) exitSelectionMode();
          else setSelectionMode(true);
        }}
      >
        {selectionMode ? "取消" : "选择"}
      </Button>
      {selectionMode && selectedItemIds.size > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => openMovePickerForItems(Array.from(selectedItemIds))}
        >
          移动
        </Button>
      ) : null}
    </>
  );

  const menuList = listMenu ? lists.find((l) => l.id === listMenu.listId) : null;
  const menuItem = itemMenu
    ? (items.find((i) => i.id === itemMenu.itemId) ??
      searchHits.find((i) => i.id === itemMenu.itemId))
    : null;

  const listMenuItems: ContextMenuItem[] = menuList
    ? buildListMenuItems(menuList, menuHandlers)
    : [];

  const itemMenuItems: ContextMenuItem[] = menuItem
    ? buildItemMenuItems(menuItem, itemHandlers, { listArchived: selectedList?.closed === true })
    : [];

  const openListMenuSheet = (list: TaskListRow) => {
    setItemMenu(null);
    setListMenu(null);
    setSheetMenu({
      title: list.name,
      items: buildListMenuItems(list, menuHandlers),
    });
  };

  const openItemMenuSheet = (item: TaskItemRow) => {
    setListMenu(null);
    setItemMenu(null);
    setSheetMenu({
      title: item.title,
      items: buildItemMenuItems(item, itemHandlers, {
        listArchived: selectedList?.closed === true,
      }),
    });
  };

  const openListContextMenu = (e: MouseEvent, list: TaskListRow) => {
    if (useActionSheet) return;
    if (!contextMenuEnabled) return;
    e.preventDefault();
    e.stopPropagation();
    setItemMenu(null);
    setSheetMenu(null);
    setListMenu({ x: e.clientX, y: e.clientY, listId: list.id });
  };

  const openItemContextMenu = (e: MouseEvent, item: TaskItemRow) => {
    if (useActionSheet) return;
    if (!contextMenuEnabled) return;
    e.preventDefault();
    e.stopPropagation();
    setListMenu(null);
    setSheetMenu(null);
    setItemMenu({ x: e.clientX, y: e.clientY, itemId: item.id });
  };

  return (
    <TaskDndRoot
      lists={activeLists}
      pendingItems={pendingItems}
      taskItems={items}
      onReorderSiblings={(ordered, parentId) => void persistSiblingOrder(ordered, parentId)}
      onMoveListToParent={(listId, parentId) => void persistMoveListToParent(listId, parentId)}
      onReorderPending={(ordered) => void persistItemOrder(ordered)}
      onMoveTaskToList={(taskId, listId) => void handleMoveItemsToList([taskId], listId)}
      onTaskDragStart={() => {
        if (useDrawer) setSidebarOpen(true);
      }}
    >
      <div className="h-full min-h-0">
        <ThreeColumnLayout
          layoutMode={layoutMode}
          listTitle="清单"
          middleTitle={selectedList?.name ?? "任务"}
          detailTitle={detailItem?.title ?? "任务详情"}
          listOpen={sidebarOpen}
          onListOpenChange={setSidebarOpen}
          listToggleAriaLabel="打开清单"
          detailOpen={detailOpen}
          onDetailOpenChange={handleDetailOpenChange}
          middleActions={
            <>
              {selectedList ? selectionToolbar : null}
              {loading || searching ? <Spinner className="size-4" /> : null}
            </>
          }
          middleHeaderExtra={
            selectedList ? (
              <Input
                className="h-8 w-full max-w-md"
                placeholder="搜索全部清单…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            ) : null
          }
          list={
            <ListSidebar
              activeLists={activeLists}
              closedLists={closedLists}
              showClosed={showClosed}
              selectedListId={selectedListId}
              selectedFolderId={selectedFolderId}
              editingListId={editingListId}
              editingListName={editingListName}
              newListName={newListName}
              newFolderName={newFolderName}
              renameInputRef={renameInputRef}
              useActionSheet={useActionSheet}
              onToggleShowClosed={() => setShowClosed((v) => !v)}
              onSelectList={selectList}
              onSelectFolder={selectFolder}
              onCreateList={() => void handleCreateList()}
              onCreateFolder={() => void handleCreateFolder()}
              onNewListNameChange={setNewListName}
              onNewFolderNameChange={setNewFolderName}
              onEditingListNameChange={setEditingListName}
              onCommitRename={() => void commitRenameList()}
              onCancelRename={() => setEditingListId(null)}
              onOpenListMenu={openListMenuSheet}
              onOpenListContextMenu={openListContextMenu}
              onStartRename={startRenameList}
            />
          }
          middle={
            <div className="flex min-h-0 flex-1 flex-col">
              {error ? (
                <Alert variant="error" className="m-3 shrink-0">
                  <AlertDescription className="flex items-center justify-between gap-2 text-sm">
                    <span>{error}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setError("")}
                    >
                      关闭
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : null}

              {!selectedList && !loading ? (
                <div className="text-muted-foreground flex flex-1 items-center justify-center p-8 text-sm">
                  创建第一个清单开始使用
                </div>
              ) : null}

              {selectedList ? (
                <>
                  {selectedList.closed ? (
                    <div className="border bg-muted/60 text-muted-foreground m-3 shrink-0 rounded-lg border px-3 py-2 text-sm">
                      此清单已归档，无法添加新任务。可在清单菜单中取消归档。
                    </div>
                  ) : null}
                  <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                    {displayPending.length === 0 && displayCompleted.length === 0 ? (
                      <EmptyState
                        message={searchActive ? "全部清单中无匹配任务" : "暂无任务，在下方快速添加"}
                        className="px-2"
                      />
                    ) : null}

                    {searchActive ? (
                      <p className="text-muted-foreground px-2 pb-2 text-xs">搜索范围：全部清单</p>
                    ) : null}

                    <SortableTaskList
                      items={displayPending}
                      sortable={!searchActive}
                      listNameForItem={searchActive ? resolveListName : undefined}
                      activeItemId={detailItem?.id}
                      useActionSheet={useActionSheet}
                      selectionMode={selectionMode}
                      selectedIds={selectedItemIds}
                      onToggleComplete={toggleComplete}
                      onEdit={openTaskDetail}
                      onOpenItemMenu={openItemMenuSheet}
                      onOpenItemContextMenu={openItemContextMenu}
                      onSelectItem={handleSelectItem}
                      onLongPressSelect={enterSelectionWithItem}
                    />

                    <CompletedTaskList
                      items={displayCompleted}
                      sortable={!searchActive}
                      listNameForItem={searchActive ? resolveListName : undefined}
                      activeItemId={detailItem?.id}
                      useActionSheet={useActionSheet}
                      selectionMode={selectionMode}
                      selectedIds={selectedItemIds}
                      onToggleComplete={toggleComplete}
                      onEdit={openTaskDetail}
                      onOpenItemMenu={openItemMenuSheet}
                      onOpenItemContextMenu={openItemContextMenu}
                      onSelectItem={handleSelectItem}
                      onLongPressSelect={enterSelectionWithItem}
                    />
                  </div>

                  {selectionMode && selectedItemIds.size > 0 ? (
                    <div className="border bg-muted/95 safe-area-pb flex shrink-0 items-center gap-2 border-t p-3">
                      <span className="text-muted-foreground min-w-0 flex-1 text-sm">
                        已选 {selectedItemIds.size} 项
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openMovePickerForItems(Array.from(selectedItemIds))}
                      >
                        移动到…
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={exitSelectionMode}>
                        取消
                      </Button>
                    </div>
                  ) : searchActive || selectedList.closed ? null : (
                    <div className="border safe-area-pb flex shrink-0 gap-2 border-t p-3">
                      <Input
                        className="min-w-0 flex-1"
                        placeholder="添加任务，Enter 确认"
                        value={quickTitle}
                        onChange={(e) => setQuickTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleQuickAdd();
                        }}
                      />
                      <Button type="button" onClick={() => void handleQuickAdd()}>
                        添加
                      </Button>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          }
          detail={
            detailItem ? (
              <TaskDetailPanel
                item={detailItem}
                onChange={setDetailItem}
                onSave={() => void saveDetailItem()}
                onCancel={() => closeTaskDetail({ discard: true })}
                saving={detailSaving}
              />
            ) : (
              <div className="text-muted-foreground flex h-full min-h-0 items-center justify-center p-8 text-sm">
                选择任务查看详情
              </div>
            )
          }
        />
      </div>

      {listMenu ? (
        <ContextMenu
          x={listMenu.x}
          y={listMenu.y}
          items={listMenuItems}
          onClose={() => setListMenu(null)}
        />
      ) : null}

      {itemMenu ? (
        <ContextMenu
          x={itemMenu.x}
          y={itemMenu.y}
          items={itemMenuItems}
          onClose={() => setItemMenu(null)}
        />
      ) : null}

      {sheetMenu ? (
        <ActionSheet
          title={sheetMenu.title}
          items={sheetMenu.items}
          onClose={() => setSheetMenu(null)}
        />
      ) : null}

      <Dialog
        open={childNamePrompt != null}
        onOpenChange={(open) => {
          if (!open) setChildNamePrompt(null);
        }}
      >
        <DialogContent className="max-w-sm safe-area-pt safe-area-pb" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {childNamePrompt?.kind === "folder" ? "新建子文件夹" : "新建子清单"}
            </DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={childNamePromptValue}
            placeholder={childNamePrompt?.kind === "folder" ? "文件夹名称" : "清单名称"}
            onChange={(e) => setChildNamePromptValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmChildNamePrompt();
            }}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setChildNamePrompt(null)}
            >
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!childNamePromptValue.trim()}
              onClick={confirmChildNamePrompt}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={listToDelete != null}
        title="删除确认"
        description={
          listToDelete
            ? listToDelete.is_folder
              ? `删除文件夹「${listToDelete.name}」？子文件夹将被删除，其内清单将升至顶级`
              : `删除清单「${listToDelete.name}」及其任务？`
            : undefined
        }
        confirmLabel="删除"
        variant="error"
        onConfirm={() => void confirmDeleteList()}
        onCancel={() => setListToDelete(null)}
      />

      {movePickerItemIds ? (
        <MoveToListPicker
          lists={moveTargetLists}
          currentListId={selectedListId}
          title={
            movePickerItemIds.length > 1 ? `移动 ${movePickerItemIds.length} 项到…` : "移动到清单"
          }
          onSelect={(listId) => void handleMoveItemsToList(movePickerItemIds, listId)}
          onClose={() => setMovePickerItemIds(null)}
        />
      ) : null}
    </TaskDndRoot>
  );
}
