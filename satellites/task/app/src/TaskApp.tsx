import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useSubjectScope } from "@freeanima/shell-sdk/react";
import { ListDetailLayout } from "@freeanima/satellite-sdk/layout";
import { FormFieldLabel, FormFieldset } from "@freeanima/satellite-sdk/form";

import { ActionSheet } from "./components/ActionSheet.tsx";
import { CompletedTaskList } from "./components/CompletedTaskList.tsx";
import { ContextMenu, type ContextMenuItem } from "./components/ContextMenu.tsx";
import { ListSidebar } from "./components/ListSidebar.tsx";
import { MoveToListPicker } from "./components/MoveToListPicker.tsx";
import { SortableTaskList } from "./components/SortableTaskList.tsx";
import { TaskDndRoot } from "./components/TaskDndRoot.tsx";
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
import { isoToDatetimeLocalValue } from "./lib/format-task.ts";
import {
  readCachedTaskItems,
  readCachedTaskLists,
  resolveHubCacheScope,
  writeCachedTaskItems,
  writeCachedTaskLists,
} from "./lib/offline-cache.ts";
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

type ListMenuState = { x: number; y: number; listId: number };
type ItemMenuState = { x: number; y: number; itemId: number };
type SheetMenuState = { title?: string; items: ContextMenuItem[] };

export function TaskApp() {
  const { kind: subjectKind } = useSubjectScope();
  const contextMenuEnabled = isTaskContextMenuEnabled();
  const useActionSheet = useTaskActionSheet();
  const useDrawer = useDrawerNav();
  const webShell = isWebShell();
  const renameInputRef = useRef<HTMLInputElement>(null);
  const selectionAnchorRef = useRef<number | null>(null);

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
  const [editingItem, setEditingItem] = useState<TaskItemRow | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [editingListName, setEditingListName] = useState("");

  const [listMenu, setListMenu] = useState<ListMenuState | null>(null);
  const [itemMenu, setItemMenu] = useState<ItemMenuState | null>(null);
  const [sheetMenu, setSheetMenu] = useState<SheetMenuState | null>(null);

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

  const handleDeleteList = async (list: TaskListRow) => {
    if (list.is_default) return;
    const label = list.is_folder ? "文件夹" : "清单";
    const extra = list.is_folder ? "及其子文件夹、清单和任务" : "及其任务";
    if (!confirm(`删除${label}「${list.name}」${extra}？`)) return;
    try {
      await deleteTaskList(list.id);
      if (selectedFolderId === list.id) setSelectedFolderId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCloseList = async (list: TaskListRow) => {
    if (list.is_default || list.closed) return;
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

  const saveEditingItem = async () => {
    if (!editingItem) return;
    try {
      await updateTaskItem(editingItem.id, {
        title: editingItem.title,
        content: editingItem.content,
        tags: editingItem.tags,
        priority: editingItem.priority,
        due_at: editingItem.due_at,
      });
      setEditingItem(null);
      if (selectedListId != null) await loadItems(selectedListId);
      if (searchActive) await refreshSearchHits();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

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

  const menuHandlers = {
    onRename: startRenameList,
    onClose: handleCloseList,
    onReopen: handleReopenList,
    onDelete: handleDeleteList,
    onCreateChildFolder: (folder: TaskListRow) => {
      const name = prompt("子文件夹名称");
      if (name?.trim()) void handleCreateFolder({ parentId: folder.id, name: name.trim() });
    },
    onCreateChildList: (folder: TaskListRow) => {
      const name = prompt("子清单名称");
      if (name?.trim()) void handleCreateList({ parentId: folder.id, name: name.trim() });
    },
  };

  const itemHandlers = {
    onEdit: (item: TaskItemRow) => setEditingItem({ ...item }),
    onToggleComplete: toggleComplete,
    onMoveTo: (item: TaskItemRow) => openMovePickerForItems([item.id]),
    onDelete: handleDeleteItem,
  };

  const selectionToolbar = (
    <>
      <button
        type="button"
        className={`btn btn-ghost btn-sm ${selectionMode ? "btn-active" : ""}`}
        onClick={() => {
          if (selectionMode) exitSelectionMode();
          else setSelectionMode(true);
        }}
      >
        {selectionMode ? "取消" : "选择"}
      </button>
      {selectionMode && selectedItemIds.size > 0 ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => openMovePickerForItems(Array.from(selectedItemIds))}
        >
          移动
        </button>
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
    ? buildItemMenuItems(menuItem, itemHandlers)
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
      items: buildItemMenuItems(item, itemHandlers),
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
      <ListDetailLayout
        detailTitle={selectedList?.name ?? "任务"}
        listTitle="清单"
        listOpen={sidebarOpen}
        onListOpenChange={setSidebarOpen}
        listToggleAriaLabel="打开清单"
        detailActions={
          <>
            {selectedList ? selectionToolbar : null}
            {loading || searching ? <span className="loading loading-spinner loading-sm" /> : null}
          </>
        }
        detailHeaderExtra={
          selectedList ? (
            <input
              className="input input-bordered input-sm w-full max-w-md"
              placeholder="搜索全部清单…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          ) : null
        }
        list={() => (
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
        )}
      >
        {error ? (
          <div className="alert alert-error m-3 text-sm">
            <span>{error}</span>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setError("")}>
              关闭
            </button>
          </div>
        ) : null}

        {!selectedList && !loading ? (
          <div className="text-base-content/60 flex flex-1 items-center justify-center p-8 text-sm">
            创建第一个清单开始使用
          </div>
        ) : null}

        {selectedList ? (
          <>
            {selectedList.closed ? (
              <div className="border-base-300 bg-base-200/60 text-base-content/70 m-3 rounded-lg border px-3 py-2 text-sm">
                此清单已归档，无法添加新任务。可在清单菜单中取消归档。
              </div>
            ) : null}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {displayPending.length === 0 && displayCompleted.length === 0 ? (
                <p className="text-base-content/50 px-2 py-6 text-sm">
                  {searchActive ? "全部清单中无匹配任务" : "暂无任务，在下方快速添加"}
                </p>
              ) : null}

              {searchActive ? (
                <p className="text-base-content/50 px-2 pb-2 text-xs">搜索范围：全部清单</p>
              ) : null}

              <SortableTaskList
                items={displayPending}
                sortable={!searchActive}
                listNameForItem={searchActive ? resolveListName : undefined}
                useActionSheet={useActionSheet}
                selectionMode={selectionMode}
                selectedIds={selectedItemIds}
                onToggleComplete={toggleComplete}
                onEdit={(item) => setEditingItem({ ...item })}
                onOpenItemMenu={openItemMenuSheet}
                onOpenItemContextMenu={openItemContextMenu}
                onSelectItem={handleSelectItem}
                onLongPressSelect={enterSelectionWithItem}
              />

              <CompletedTaskList
                items={displayCompleted}
                sortable={!searchActive}
                listNameForItem={searchActive ? resolveListName : undefined}
                useActionSheet={useActionSheet}
                selectionMode={selectionMode}
                selectedIds={selectedItemIds}
                onToggleComplete={toggleComplete}
                onOpenItemMenu={openItemMenuSheet}
                onOpenItemContextMenu={openItemContextMenu}
                onSelectItem={handleSelectItem}
                onLongPressSelect={enterSelectionWithItem}
              />
            </div>

            {selectionMode && selectedItemIds.size > 0 ? (
              <div className="border-base-300 bg-base-200/95 safe-area-pb flex items-center gap-2 border-t p-3">
                <span className="text-base-content/70 min-w-0 flex-1 text-sm">
                  已选 {selectedItemIds.size} 项
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => openMovePickerForItems(Array.from(selectedItemIds))}
                >
                  移动到…
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={exitSelectionMode}>
                  取消
                </button>
              </div>
            ) : searchActive || selectedList.closed ? null : (
              <div className="border-base-300 safe-area-pb flex gap-2 border-t p-3">
                <input
                  className="input input-bordered min-w-0 flex-1"
                  placeholder="添加任务，Enter 确认"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleQuickAdd();
                  }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleQuickAdd()}
                >
                  添加
                </button>
              </div>
            )}
          </>
        ) : null}
      </ListDetailLayout>

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

      {editingItem ? (
        <dialog open className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box w-full max-w-md rounded-t-2xl p-4 sm:rounded-box">
            <h3 className="text-lg font-bold">编辑任务</h3>
            <div className="max-h-[70vh] overflow-y-auto">
              <FormFieldset legend="详情" bordered={false} className="mt-4 gap-3">
                <div>
                  <FormFieldLabel>标题</FormFieldLabel>
                  <input
                    className="input input-bordered w-full"
                    value={editingItem.title}
                    onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  />
                </div>
                <div>
                  <FormFieldLabel>优先级</FormFieldLabel>
                  <select
                    className="select select-bordered w-full"
                    value={editingItem.priority}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        priority: e.target.value as TaskItemRow["priority"],
                      })
                    }
                  >
                    <option value="none">无</option>
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                  </select>
                </div>
                <div>
                  <FormFieldLabel>截止日期</FormFieldLabel>
                  <input
                    type="datetime-local"
                    className="input input-bordered w-full"
                    value={isoToDatetimeLocalValue(editingItem.due_at)}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        due_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                  />
                </div>
                <div>
                  <FormFieldLabel>内容</FormFieldLabel>
                  <textarea
                    className="textarea textarea-bordered w-full"
                    rows={3}
                    value={editingItem.content}
                    onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
                  />
                </div>
                <div>
                  <FormFieldLabel>标签</FormFieldLabel>
                  <input
                    className="input input-bordered w-full"
                    placeholder="逗号分隔，如：工作,紧急"
                    value={editingItem.tags.join(", ")}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        tags: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              </FormFieldset>
            </div>
            <div className="modal-action flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn btn-ghost btn-block sm:btn-wide"
                onClick={() => setEditingItem(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary btn-block sm:btn-wide"
                onClick={() => void saveEditingItem()}
              >
                保存
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setEditingItem(null)}>
              close
            </button>
          </form>
        </dialog>
      ) : null}
    </TaskDndRoot>
  );
}
