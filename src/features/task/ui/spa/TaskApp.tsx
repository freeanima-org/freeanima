import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { readModuleSelection, writeModuleSelection } from "@freeanima/frontend/shell-sdk";
import type { TaskModuleSelection } from "@freeanima/frontend/shell-sdk";
import { useSubjectScope, SubjectScopeToggle } from "@freeanima/frontend/shell-sdk/react.tsx";
import { mergeDraftAfterSave } from "@freeanima/frontend/ui-kit/lib/merge-draft-after-save.ts";
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
} from "@freeanima/frontend/ui-kit";

import {
  ActionSheet,
  ConfirmDialog,
  ContextMenu,
  EmptyState,
} from "@freeanima/frontend/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/frontend/ui-kit/composite";
import { CompletedTaskList } from "./components/CompletedTaskList.tsx";
import { ListSidebar } from "./components/ListSidebar.tsx";
import { SmartListEditorDialog } from "./components/SmartListEditorDialog.tsx";
import {
  BuiltinSmartListSection,
  CustomSmartListSection,
} from "./components/SmartListSidebarSection.tsx";
import { MoveToListPicker } from "./components/MoveToListPicker.tsx";
import { SortableTaskList } from "./components/SortableTaskList.tsx";
import { TaskDetailPanel, type DetailSaveStatus } from "./components/TaskDetailPanel.tsx";
import { TaskDndRoot } from "./components/TaskDndRoot.tsx";
import { ThreeColumnLayout } from "@freeanima/frontend/ui-kit/layout";
import {
  completeTaskItem,
  createSmartList,
  createTaskItem,
  createTaskList,
  closeTaskList,
  deleteSmartList,
  deleteTaskItem,
  deleteTaskList,
  fetchSmartLists,
  fetchTaskItems,
  fetchTaskItemsByFilters,
  fetchTaskLists,
  reopenTaskList,
  searchTaskItems,
  uncompleteTaskItem,
  updateSmartList,
  updateTaskItem,
  updateTaskList,
  type SmartListRow,
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
  isWebShell,
  useContextMenuCapability,
  useDrawerNav,
  useTaskActionSheet,
} from "./lib/platform.ts";
import { readTaskSelectionFromUrl, writeTaskSelectionToUrl } from "./lib/task-selection-url.ts";
import { moveTaskItemsToList } from "./lib/move-items.ts";
import { applyShiftRangeSelect } from "./lib/range-select.ts";
import { resolveTaskSelection } from "./lib/resolve-task-selection.ts";
import { resolveDefaultListId } from "./lib/resolve-list.ts";
import {
  allowsSmartListQuickAdd,
  findSmartListRowByKey,
  isCompletedOnlyFilters,
  smartListRowKey,
} from "./lib/task-smart-list-utils.ts";
import { getParentId, getSiblings } from "./lib/list-tree.ts";
import { sortOrderUpdates } from "./lib/reorder.ts";
import {
  buildItemMenuItems,
  buildListMenuItems,
  buildSmartListMenuItems,
} from "./lib/task-menus.ts";
import { cloneTaskItem, isTaskItemDirty, isTaskItemEqual } from "./lib/task-detail-dirty.ts";

type ListMenuState = { x: number; y: number; listId: number };
type SmartListMenuState = { x: number; y: number; smartListId: number };
type ItemMenuState = { x: number; y: number; itemId: number };
type SheetMenuState = { title?: string; items: ActionSheetItem[] };
type ChildNamePromptState = { kind: "list" | "folder"; parentId: number };

export function TaskApp() {
  const { kind: subjectKind } = useSubjectScope();
  const contextMenuEnabled = useContextMenuCapability();
  const useActionSheet = useTaskActionSheet();
  const useDrawer = useDrawerNav();
  const layoutMode = useTaskLayoutMode();
  const webShell = isWebShell();
  const renameInputRef = useRef<HTMLInputElement>(null);
  const selectionAnchorRef = useRef<number | null>(null);
  const detailDiscardRef = useRef(false);
  const listsLoadGenRef = useRef(0);
  const itemsLoadGenRef = useRef(0);

  const [lists, setLists] = useState<TaskListRow[]>([]);
  const [smartLists, setSmartLists] = useState<SmartListRow[]>([]);
  const [items, setItems] = useState<TaskItemRow[]>([]);
  const [selection, setSelection] = useState<TaskModuleSelection | null>(null);
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
  const [detailSaveStatus, setDetailSaveStatus] = useState<DetailSaveStatus>("idle");
  const detailSaveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [editingListName, setEditingListName] = useState("");

  const [listMenu, setListMenu] = useState<ListMenuState | null>(null);
  const [smartListMenu, setSmartListMenu] = useState<SmartListMenuState | null>(null);
  const [itemMenu, setItemMenu] = useState<ItemMenuState | null>(null);
  const [sheetMenu, setSheetMenu] = useState<SheetMenuState | null>(null);
  const [listToDelete, setListToDelete] = useState<TaskListRow | null>(null);
  const [childNamePrompt, setChildNamePrompt] = useState<ChildNamePromptState | null>(null);
  const [childNamePromptValue, setChildNamePromptValue] = useState("");

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(() => new Set());
  const [movePickerItemIds, setMovePickerItemIds] = useState<number[] | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [smartListEditor, setSmartListEditor] = useState<SmartListRow | null | undefined>(
    undefined,
  );

  const persistSelection = useCallback(
    (next: TaskModuleSelection) => {
      writeModuleSelection("tasks", next);
      if (webShell) writeTaskSelectionToUrl(next);
    },
    [webShell],
  );

  const loadItemsByFilters = useCallback(async (filters: SmartListRow["filters"]) => {
    const generation = ++itemsLoadGenRef.current;
    try {
      const rows = await fetchTaskItemsByFilters(filters);
      if (generation !== itemsLoadGenRef.current) return;
      setItems(rows);
    } catch {
      if (generation !== itemsLoadGenRef.current) return;
      setItems([]);
    }
  }, []);

  const loadItems = useCallback(async (listId: number) => {
    const generation = ++itemsLoadGenRef.current;
    const scope = resolveHubCacheScope();
    const cached = await readCachedTaskItems(scope, listId);
    if (generation !== itemsLoadGenRef.current) return;
    if (cached) setItems(cached);
    try {
      const rows = await fetchTaskItems(listId);
      if (generation !== itemsLoadGenRef.current) return;
      setItems(rows);
      void writeCachedTaskItems(scope, listId, rows);
    } catch {
      if (generation !== itemsLoadGenRef.current) return;
      if (!cached) setItems([]);
    }
  }, []);

  const loadLists = useCallback(async (): Promise<TaskListRow[]> => {
    const generation = ++listsLoadGenRef.current;
    const scope = resolveHubCacheScope();
    const cached = await readCachedTaskLists(scope);
    if (generation !== listsLoadGenRef.current) return cached ?? [];
    if (cached?.length) setLists(cached);
    try {
      const [rows, smartRows] = await Promise.all([
        fetchTaskLists({ includeClosed: true }),
        fetchSmartLists(),
      ]);
      if (generation !== listsLoadGenRef.current) return rows;
      setLists(rows);
      setSmartLists(smartRows);
      void writeCachedTaskLists(scope, rows);
      const next = resolveTaskSelection(rows, smartRows, {
        stored: readModuleSelection("tasks"),
        urlSelection: webShell ? readTaskSelectionFromUrl() : null,
        preferUrl: webShell,
      });
      setSelection(next);
      persistSelection(next);
      if (rows.length === 0) setItems([]);
      return rows;
    } catch {
      if (generation !== listsLoadGenRef.current) return cached ?? [];
      if (!cached?.length) setError("无法加载任务清单");
      return cached ?? [];
    }
  }, [persistSelection, webShell]);

  const reloadCurrentItems = useCallback(async () => {
    if (selection == null) return;
    if (selection.kind === "list") {
      await loadItems(selection.id);
    } else {
      const row = findSmartListRowByKey(smartLists, selection.key);
      if (row) await loadItemsByFilters(row.filters);
    }
  }, [loadItems, loadItemsByFilters, selection, smartLists]);

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
    listsLoadGenRef.current += 1;
    itemsLoadGenRef.current += 1;
    setLists([]);
    setSmartLists([]);
    setSelection(null);
    setSelectedFolderId(null);
    setItems([]);
    setSearchQuery("");
    setSearchHits([]);
    void refresh();
  }, [subjectKind, refresh]);

  useEffect(() => {
    if (selection == null) return;
    const run = async () => {
      if (selection.kind === "list") {
        await loadItems(selection.id);
      } else {
        const row = findSmartListRowByKey(smartLists, selection.key);
        if (row) await loadItemsByFilters(row.filters);
      }
    };
    void run().catch((err) => {
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
  }, [selection, smartLists, loadItems, loadItemsByFilters]);

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

  const applySelection = (next: TaskModuleSelection) => {
    setSelection(next);
    persistSelection(next);
    if (useDrawer) setSidebarOpen(false);
  };

  const selectSmartList = (row: SmartListRow) => {
    setSelectedFolderId(null);
    applySelection({ kind: "smart_list", key: smartListRowKey(row) });
  };

  const selectInbox = () => {
    const inboxId = resolveDefaultListId(lists);
    if (inboxId == null) return;
    setSelectedFolderId(null);
    applySelection({ kind: "list", id: inboxId });
  };

  const selectList = (id: number) => {
    setSelectedFolderId(null);
    if (lists.find((l) => l.id === id)?.closed) setShowClosed(true);
    applySelection({ kind: "list", id });
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
    const wasSelected = selection?.kind === "list" && selection.id === list.id;
    try {
      await closeTaskList(list.id);
      const rows = await loadLists();
      if (wasSelected) {
        const smartRows = await fetchSmartLists();
        const next = resolveTaskSelection(rows, smartRows, {
          stored: null,
          urlSelection: null,
          preferUrl: false,
        });
        setSelection(next);
        persistSelection(next);
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
      if (selection?.kind === "list") await loadItems(selection.id);
      else await reloadCurrentItems();
    }
  };

  const handleQuickAdd = async () => {
    const title = quickTitle.trim();
    if (!title) return;
    const targetListId = selection?.kind === "list" ? selection.id : resolveDefaultListId(lists);
    if (targetListId == null) return;
    try {
      const pending = items.filter((i) => i.status === "pending");
      await createTaskItem({ title, list_id: targetListId, sort_order: pending.length });
      setQuickTitle("");
      await Promise.all([reloadCurrentItems(), loadLists()]);
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
      await Promise.all([reloadCurrentItems(), loadLists()]);
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
      await Promise.all([reloadCurrentItems(), loadLists()]);
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

  const closeMovePicker = useCallback(() => {
    setMovePickerItemIds(null);
  }, []);

  const openMovePickerForItems = useCallback((itemIds: number[]) => {
    if (itemIds.length === 0) return;
    setSheetMenu(null);
    setItemMenu(null);
    setListMenu(null);
    setDetailOpen(false);
    window.setTimeout(() => setMovePickerItemIds(itemIds), 0);
  }, []);

  const handleMoveItemsToList = async (itemIds: number[], targetListId: number) => {
    if (itemIds.length === 0 || (selection?.kind === "list" && targetListId === selection.id))
      return;
    try {
      await moveTaskItemsToList(itemIds, targetListId);
      closeMovePicker();
      exitSelectionMode();
      await Promise.all([reloadCurrentItems(), loadLists()]);
      if (searchActive) await refreshSearchHits();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const markDetailSaved = useCallback(() => {
    if (detailSaveStatusTimerRef.current) clearTimeout(detailSaveStatusTimerRef.current);
    setDetailSaveStatus("saved");
    detailSaveStatusTimerRef.current = setTimeout(() => setDetailSaveStatus("idle"), 2000);
  }, []);

  const persistDetailItem = useCallback(
    async (opts?: { closeAfter?: boolean }): Promise<boolean> => {
      const item = detailItem;
      const baseline = detailBaseline;
      if (!item || !baseline || !isTaskItemDirty(item, baseline)) return true;
      if (detailSaving) return false;
      const savingSnapshot = cloneTaskItem(item);
      setDetailSaving(true);
      setDetailSaveStatus("saving");
      try {
        const saved = await updateTaskItem(item.id, {
          title: savingSnapshot.title,
          content: savingSnapshot.content,
          tags: savingSnapshot.tags,
          priority: savingSnapshot.priority,
          due_at: savingSnapshot.due_at,
        });
        detailDiscardRef.current = false;
        const synced = cloneTaskItem(saved);
        if (opts?.closeAfter) {
          setDetailItem(null);
          setDetailBaseline(null);
          setDetailOpen(false);
        } else {
          setDetailBaseline(synced);
          setDetailItem((current) => {
            if (!current) return synced;
            return mergeDraftAfterSave({
              current,
              savingSnapshot,
              synced,
              isEqual: isTaskItemEqual,
            }).draft;
          });
        }
        setItems((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
        setSearchHits((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
        markDetailSaved();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setDetailSaveStatus("error");
        return false;
      } finally {
        setDetailSaving(false);
      }
    },
    [detailBaseline, detailItem, detailSaving, markDetailSaved],
  );

  const flushDetailSave = useCallback(async (): Promise<boolean> => {
    return persistDetailItem();
  }, [persistDetailItem]);

  const openTaskDetail = useCallback(
    (item: TaskItemRow) => {
      void (async () => {
        await flushDetailSave();
        setDetailItem((prev) => {
          if (prev?.id === item.id) return prev;
          const copy = cloneTaskItem(item);
          setDetailBaseline(copy);
          return copy;
        });
        setDetailSaveStatus("idle");
        if (layoutMode === "compact") setDetailOpen(true);
      })();
    },
    [flushDetailSave, layoutMode],
  );

  const closeTaskDetail = useCallback((opts?: { discard?: boolean }) => {
    if (opts?.discard) detailDiscardRef.current = true;
    setDetailItem(null);
    setDetailBaseline(null);
    setDetailOpen(false);
    setDetailSaveStatus("idle");
  }, []);

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
        setDetailSaveStatus("idle");
        return;
      }
      void (async () => {
        const dirty =
          detailItem != null &&
          detailBaseline != null &&
          isTaskItemDirty(detailItem, detailBaseline);
        if (dirty) {
          const ok = await persistDetailItem({ closeAfter: true });
          if (!ok) return;
          return;
        }
        setDetailItem(null);
        setDetailBaseline(null);
        setDetailOpen(false);
        setDetailSaveStatus("idle");
      })();
    },
    [detailBaseline, detailItem, persistDetailItem],
  );

  useEffect(() => {
    if (!detailItem || !detailBaseline || !isTaskItemDirty(detailItem, detailBaseline)) return;
    if (detailSaving) return;
    const timer = setTimeout(() => {
      void persistDetailItem();
    }, 700);
    return () => clearTimeout(timer);
  }, [detailBaseline, detailItem, detailSaving, persistDetailItem]);

  useEffect(() => {
    return () => {
      if (detailSaveStatusTimerRef.current) clearTimeout(detailSaveStatusTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (layoutMode !== "compact") {
      setDetailOpen(false);
    } else if (detailItem && movePickerItemIds == null) {
      setDetailOpen(true);
    }
  }, [layoutMode, detailItem?.id, movePickerItemIds]);

  const defaultInboxId = useMemo(() => resolveDefaultListId(lists), [lists]);
  const inboxItemCount = useMemo(
    () => lists.find((l) => l.id === defaultInboxId)?.item_count ?? 0,
    [lists, defaultInboxId],
  );
  const inboxSelected =
    selection?.kind === "list" && defaultInboxId != null && selection.id === defaultInboxId;
  const listSidebarSelectedId = selection?.kind === "list" && !inboxSelected ? selection.id : null;
  const activeSmartListRow =
    selection?.kind === "smart_list" ? findSmartListRowByKey(smartLists, selection.key) : null;
  const smartListMode = selection?.kind === "smart_list";
  const smartListCompletedOnly = activeSmartListRow
    ? isCompletedOnlyFilters(activeSmartListRow.filters)
    : false;
  const selectedList =
    selection?.kind === "list" ? (lists.find((l) => l.id === selection.id) ?? null) : null;
  const activeLists = useMemo(() => lists.filter((l) => !l.closed && !l.is_default), [lists]);
  const closedLists = useMemo(() => lists.filter((l) => l.closed), [lists]);
  const moveTargetLists = useMemo(() => lists.filter((l) => !l.closed && !l.is_folder), [lists]);
  const listNameById = useMemo(() => new Map(lists.map((l) => [l.id, l.name])), [lists]);
  const pendingItems = items.filter((i) => i.status === "pending");
  const completedItems = items.filter((i) => i.status === "completed");
  const searchPending = searchHits.filter((i) => i.status === "pending");
  const searchCompleted = searchHits.filter((i) => i.status === "completed");
  const displayPending = searchActive ? searchPending : smartListCompletedOnly ? [] : pendingItems;
  const displayCompleted = searchActive
    ? searchCompleted
    : smartListCompletedOnly
      ? items
      : completedItems;
  const showCompletedSection =
    !smartListCompletedOnly && (searchActive || selection?.kind === "list");
  const itemsSortable = !searchActive && !smartListMode;
  const showListNameColumn = searchActive || smartListMode;
  const middleTitle =
    selection?.kind === "smart_list"
      ? (activeSmartListRow?.title ?? "智能清单")
      : inboxSelected
        ? "收件箱"
        : (selectedList?.name ?? "任务");
  const canQuickAdd =
    selection != null &&
    (selection.kind === "list"
      ? selectedList != null && !selectedList.closed
      : activeSmartListRow != null && allowsSmartListQuickAdd(activeSmartListRow.filters));
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

  const handleSaveSmartList = async (input: {
    title: string;
    filters: SmartListRow["filters"];
  }) => {
    try {
      if (smartListEditor?.id != null) {
        await updateSmartList(smartListEditor.id, input);
      } else {
        await createSmartList(input);
      }
      const smartRows = await fetchSmartLists();
      setSmartLists(smartRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteSmartList = async (row: SmartListRow) => {
    if (row.id == null) return;
    try {
      await deleteSmartList(row.id);
      const smartRows = await fetchSmartLists();
      setSmartLists(smartRows);
      if (selection?.kind === "smart_list" && selection.key === smartListRowKey(row)) {
        const next = resolveTaskSelection(lists, smartRows, {
          stored: null,
          urlSelection: null,
          preferUrl: false,
        });
        setSelection(next);
        persistSelection(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const smartListMenuHandlers = {
    onEdit: (row: SmartListRow) => setSmartListEditor(row),
    onDelete: handleDeleteSmartList,
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
  const menuSmartList = smartListMenu
    ? smartLists.find((row) => row.id === smartListMenu.smartListId)
    : null;
  const menuItem = itemMenu
    ? (items.find((i) => i.id === itemMenu.itemId) ??
      searchHits.find((i) => i.id === itemMenu.itemId))
    : null;

  const listMenuItems: ActionSheetItem[] = menuList
    ? buildListMenuItems(menuList, menuHandlers)
    : [];

  const smartListMenuItems: ActionSheetItem[] = menuSmartList
    ? buildSmartListMenuItems(menuSmartList, smartListMenuHandlers)
    : [];

  const itemMenuItems: ActionSheetItem[] = menuItem
    ? buildItemMenuItems(menuItem, itemHandlers, { listArchived: selectedList?.closed === true })
    : [];

  const openListMenuSheet = (list: TaskListRow) => {
    setItemMenu(null);
    setListMenu(null);
    setSmartListMenu(null);
    setSheetMenu({
      title: list.name,
      items: buildListMenuItems(list, menuHandlers),
    });
  };

  const openSmartListMenuSheet = (row: SmartListRow) => {
    setItemMenu(null);
    setListMenu(null);
    setSmartListMenu(null);
    setSheetMenu({
      title: row.title,
      items: buildSmartListMenuItems(row, smartListMenuHandlers),
    });
  };

  const openItemMenuSheet = (item: TaskItemRow) => {
    setListMenu(null);
    setSmartListMenu(null);
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
    setSmartListMenu(null);
    setSheetMenu(null);
    setListMenu({ x: e.clientX, y: e.clientY, listId: list.id });
  };

  const openSmartListContextMenu = (e: MouseEvent, row: SmartListRow) => {
    if (row.id == null) return;
    if (useActionSheet) return;
    if (!contextMenuEnabled) return;
    e.preventDefault();
    e.stopPropagation();
    setItemMenu(null);
    setListMenu(null);
    setSheetMenu(null);
    setSmartListMenu({ x: e.clientX, y: e.clientY, smartListId: row.id });
  };

  const openItemContextMenu = (e: MouseEvent, item: TaskItemRow) => {
    if (useActionSheet) return;
    if (!contextMenuEnabled) return;
    e.preventDefault();
    e.stopPropagation();
    setListMenu(null);
    setSmartListMenu(null);
    setSheetMenu(null);
    setItemMenu({ x: e.clientX, y: e.clientY, itemId: item.id });
  };

  const showMiddleContent = selection != null && !loading;

  return (
    <>
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
            columnSplitKey="task"
            listTitle="任务"
            middleTitle={middleTitle}
            detailTitle={detailItem?.title ?? "任务详情"}
            listOpen={sidebarOpen}
            onListOpenChange={setSidebarOpen}
            listToggleAriaLabel="打开清单"
            detailOpen={detailOpen}
            onDetailOpenChange={handleDetailOpenChange}
            middleActions={
              <>
                {showMiddleContent ? selectionToolbar : null}
                {loading || searching ? <Spinner className="size-4" /> : null}
              </>
            }
            middleHeaderExtra={
              showMiddleContent ? (
                <Input
                  className="h-8 w-full max-w-md"
                  placeholder="搜索全部清单…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              ) : null
            }
            list={
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 border-b p-2">
                  <SubjectScopeToggle />
                </div>
                <ListSidebar
                  key={subjectKind}
                  builtinSmartListSection={
                    <BuiltinSmartListSection
                      smartLists={smartLists}
                      selectedKey={selection?.kind === "smart_list" ? selection.key : null}
                      defaultInboxId={defaultInboxId}
                      inboxItemCount={inboxItemCount}
                      inboxSelected={inboxSelected}
                      onSelectSmartList={selectSmartList}
                      onSelectInbox={selectInbox}
                    />
                  }
                  customSmartListSection={
                    <CustomSmartListSection
                      smartLists={smartLists}
                      selectedKey={selection?.kind === "smart_list" ? selection.key : null}
                      inboxSelected={inboxSelected}
                      onSelectSmartList={selectSmartList}
                      onCreateSmartList={() => setSmartListEditor(null)}
                      onOpenSmartListContextMenu={openSmartListContextMenu}
                      onOpenSmartListMenu={openSmartListMenuSheet}
                      useActionSheet={useActionSheet}
                    />
                  }
                  activeLists={activeLists}
                  closedLists={closedLists}
                  showClosed={showClosed}
                  selectedListId={listSidebarSelectedId}
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
              </div>
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

                {!showMiddleContent && !loading ? (
                  <div className="text-muted-foreground flex flex-1 items-center justify-center p-8 text-sm">
                    创建第一个清单开始使用
                  </div>
                ) : null}

                {showMiddleContent ? (
                  <>
                    {selectedList?.closed ? (
                      <div className="border bg-muted/60 text-muted-foreground m-3 shrink-0 rounded-lg border px-3 py-2 text-sm">
                        此清单已归档，无法添加新任务。可在清单菜单中取消归档。
                      </div>
                    ) : null}
                    <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                      {displayPending.length === 0 && displayCompleted.length === 0 ? (
                        <EmptyState
                          message={
                            searchActive ? "全部清单中无匹配任务" : "暂无任务，在下方快速添加"
                          }
                          className="px-2"
                        />
                      ) : null}

                      {searchActive ? (
                        <p className="text-muted-foreground px-2 pb-2 text-xs">
                          搜索范围：全部清单
                        </p>
                      ) : null}

                      {smartListCompletedOnly ? (
                        <SortableTaskList
                          items={displayCompleted}
                          sortable={itemsSortable}
                          {...(showListNameColumn ? { listNameForItem: resolveListName } : {})}
                          {...(detailItem ? { activeItemId: detailItem.id } : {})}
                          useActionSheet={useActionSheet}
                          selectionMode={selectionMode}
                          selectedIds={selectedItemIds}
                          onToggleComplete={(item) => void toggleComplete(item)}
                          onEdit={openTaskDetail}
                          onOpenItemMenu={openItemMenuSheet}
                          onOpenItemContextMenu={openItemContextMenu}
                          onSelectItem={handleSelectItem}
                          onLongPressSelect={enterSelectionWithItem}
                        />
                      ) : (
                        <SortableTaskList
                          items={displayPending}
                          sortable={itemsSortable}
                          {...(showListNameColumn ? { listNameForItem: resolveListName } : {})}
                          {...(detailItem ? { activeItemId: detailItem.id } : {})}
                          useActionSheet={useActionSheet}
                          selectionMode={selectionMode}
                          selectedIds={selectedItemIds}
                          onToggleComplete={(item) => void toggleComplete(item)}
                          onEdit={openTaskDetail}
                          onOpenItemMenu={openItemMenuSheet}
                          onOpenItemContextMenu={openItemContextMenu}
                          onSelectItem={handleSelectItem}
                          onLongPressSelect={enterSelectionWithItem}
                        />
                      )}

                      {showCompletedSection && !smartListCompletedOnly ? (
                        <CompletedTaskList
                          items={displayCompleted}
                          sortable={itemsSortable}
                          {...(showListNameColumn ? { listNameForItem: resolveListName } : {})}
                          {...(detailItem ? { activeItemId: detailItem.id } : {})}
                          useActionSheet={useActionSheet}
                          selectionMode={selectionMode}
                          selectedIds={selectedItemIds}
                          onToggleComplete={(item) => void toggleComplete(item)}
                          onEdit={openTaskDetail}
                          onOpenItemMenu={openItemMenuSheet}
                          onOpenItemContextMenu={openItemContextMenu}
                          onSelectItem={handleSelectItem}
                          onLongPressSelect={enterSelectionWithItem}
                        />
                      ) : null}
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
                    ) : searchActive || !canQuickAdd ? null : (
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
                  onCancel={() => closeTaskDetail({ discard: true })}
                  saveStatus={detailSaveStatus}
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

        {smartListMenu ? (
          <ContextMenu
            x={smartListMenu.x}
            y={smartListMenu.y}
            items={smartListMenuItems}
            onClose={() => setSmartListMenu(null)}
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
              focusOnMount
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
      </TaskDndRoot>

      <SmartListEditorDialog
        open={smartListEditor !== undefined}
        initial={smartListEditor ?? null}
        lists={lists}
        onClose={() => setSmartListEditor(undefined)}
        onSave={handleSaveSmartList}
      />

      <MoveToListPicker
        open={movePickerItemIds != null}
        lists={moveTargetLists}
        currentListId={selection?.kind === "list" ? selection.id : null}
        title={
          movePickerItemIds != null && movePickerItemIds.length > 1
            ? `移动 ${movePickerItemIds.length} 项到…`
            : "移动到清单"
        }
        onSelect={(listId) => {
          if (movePickerItemIds == null) return;
          void handleMoveItemsToList(movePickerItemIds, listId);
        }}
        onClose={closeMovePicker}
      />
    </>
  );
}
