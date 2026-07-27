import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  readModuleSelection,
  writeModuleSelection,
  launchPomodoroForTask,
} from "@freeanima/client/portal-sdk";
import type { TaskModuleSelection } from "@freeanima/client/portal-sdk";
import { isHabitatFetchAvailable } from "@freeanima/client/portal-sdk/habitat-fetch-gate";
import { subscribeIdMappings } from "@freeanima/client/portal-sdk/offline-id-map";
import { isTempId } from "@freeanima/client/portal-sdk/offline-temp-id";
import {
  useSubjectScope,
  SubjectScopeToggle,
  setCompactImmersive,
} from "@freeanima/client/portal-sdk/react.tsx";
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

import {
  ActionSheet,
  ConfirmDialog,
  DetailEditPageShell,
  EmptyState,
  ModuleScopeBar,
  PullToRefresh,
  QuickAddBar,
  useDetailPanelState,
} from "@freeanima/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/ui-kit/composite";
import { m } from "@paraglide/messages";
import { CompletedTaskList } from "./components/CompletedTaskList.tsx";
import { ListSidebar } from "./components/ListSidebar.tsx";
import { ListEditorDialog } from "./components/ListEditorDialog.tsx";
import { SmartListEditorDialog } from "./components/SmartListEditorDialog.tsx";
import {
  BuiltinSmartListSection,
  CustomSmartListSection,
} from "./components/SmartListSidebarSection.tsx";
import { MoveToListPicker } from "@freeanima/ui-kit/composite";
import { MoveToProjectPicker } from "./components/MoveToProjectPicker.tsx";
import { SortableTaskList } from "./components/SortableTaskList.tsx";
import { TaskDetailPanel } from "./components/TaskDetailPanel.tsx";
import { TaskDndRoot } from "./components/TaskDndRoot.tsx";
import { ThreeColumnLayout } from "@freeanima/ui-kit/layout";
import type { TagKnown as TaskTagKnown } from "@freeanima/features/tag/ui/spa/components/TagPicker.tsx";
import { findUnresolvedTaskTagIds } from "./lib/task-tag-filter.ts";
import { fetchTags } from "@freeanima/features/tag/ui/spa/lib/api.ts";
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
  fetchSmartListStats,
  fetchTaskItems,
  fetchTaskItemsByFilters,
  fetchTaskItemById,
  fetchTaskLists,
  fetchTaskListStats,
  reopenTaskList,
  searchTaskItems,
  fetchProjectsForMove,
  uncompleteTaskItem,
  updateSmartList,
  updateTaskItem,
  updateTaskList,
  seedLocalTaskItems,
  type SmartListRow,
  type TaskItemRow,
  type TaskListRow,
} from "./lib/api.ts";
import {
  readCachedTaskItems,
  readCachedTaskLists,
  resolveHabitatCacheScope,
  writeCachedTaskItems,
  writeCachedTaskLists,
} from "./lib/offline-cache.ts";
import { reconcileServerTaskLists, registerTaskOfflineModule } from "./lib/offline-store.ts";
import { useTaskLayoutMode } from "./lib/layout-mode.ts";
import {
  isWebShell,
  useContextMenuCapability,
  useDrawerNav,
  useTaskActionSheet,
} from "./lib/platform.ts";
import { readTaskSelectionFromUrl, writeTaskSelectionToUrl } from "./lib/task-selection-url.ts";
import { readTaskItemFromUrl, writeTaskItemToUrl } from "./lib/task-item-url.ts";
import { moveTaskItemsToList, moveTaskItemsToProject } from "./lib/move-items.ts";
import { taskAttributionLabel } from "./lib/task-attribution.ts";
import { applyShiftRangeSelect } from "./lib/range-select.ts";
import { resolveTaskSelection } from "./lib/resolve-task-selection.ts";
import { resolveSmartListDueAt } from "./lib/resolve-smart-list-due.ts";
import { resolveDefaultListId } from "./lib/resolve-list.ts";
import {
  allowsSmartListQuickAdd,
  findSmartListRowByKey,
  isCompletedOnlyFilters,
  smartListRowKey,
} from "./lib/task-smart-list-utils.ts";
import { getParentId, getSiblings } from "@freeanima/ui-kit/lib/task-list-tree.ts";
import { sortOrderUpdates, applySortOrderUpdates } from "./lib/reorder.ts";
import {
  buildItemMenuItems,
  buildListMenuItems,
  buildSmartListMenuItems,
} from "./lib/task-menus.ts";
import { cloneTaskItem, isTaskItemDirty, isTaskItemEqual } from "./lib/task-detail-dirty.ts";
import { normalizeTaskItemRows } from "./lib/normalize-task-item.ts";

type SheetMenuState = { title?: string; items: ActionSheetItem[] };
type ChildNamePromptState = { kind: "list" | "folder"; parentId: number };

export function TaskApp() {
  const { kind: subjectKind } = useSubjectScope();
  const writesDisabled = false;
  const contextMenuEnabled = useContextMenuCapability();
  const useActionSheet = useTaskActionSheet();
  const useDrawer = useDrawerNav();
  const layoutMode = useTaskLayoutMode();
  const webShell = isWebShell();
  const selectionAnchorRef = useRef<number | null>(null);
  const listsLoadGenRef = useRef(0);
  const itemsLoadGenRef = useRef(0);

  const [lists, setLists] = useState<TaskListRow[]>([]);
  const [smartLists, setSmartLists] = useState<SmartListRow[]>([]);
  const [smartListCounts, setSmartListCounts] = useState<Map<string, number>>(() => new Map());
  const [items, setItems] = useState<TaskItemRow[]>([]);
  const [selection, setSelection] = useState<TaskModuleSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [newListName, setNewListName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<TaskItemRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [tagFilterId, setTagFilterId] = useState<number | null>(null);
  const [tagPool, setTagPool] = useState<Array<{ id: number; title: string }>>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [listEditor, setListEditor] = useState<TaskListRow | null>(null);

  const [sheetMenu, setSheetMenu] = useState<SheetMenuState | null>(null);
  const [listToDelete, setListToDelete] = useState<TaskListRow | null>(null);
  const [itemToDelete, setItemToDelete] = useState<TaskItemRow | null>(null);
  const [smartListToDelete, setSmartListToDelete] = useState<SmartListRow | null>(null);
  const [childNamePrompt, setChildNamePrompt] = useState<ChildNamePromptState | null>(null);
  const [childNamePromptValue, setChildNamePromptValue] = useState("");

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(() => new Set());
  const [movePickerItemIds, setMovePickerItemIds] = useState<number[] | null>(null);
  const [moveProjectItemIds, setMoveProjectItemIds] = useState<number[] | null>(null);
  const [projectsForMove, setProjectsForMove] = useState<
    Array<{ id: number; title: string; status: string }>
  >([]);
  const [showClosed, setShowClosed] = useState(false);
  const [smartListEditor, setSmartListEditor] = useState<SmartListRow | null | undefined>(
    undefined,
  );

  const {
    item: detailItem,
    setItem: setDetailItem,
    detailOpen,
    detailEditMode,
    saveStatus: detailSaveStatus,
    openDetail: openTaskDetail,
    closeDetailSheet,
    enterDetailEdit,
    exitDetailEdit,
    handleDetailOpenChange,
    resetDetail,
  } = useDetailPanelState<TaskItemRow>({
    layoutMode,
    cloneItem: cloneTaskItem,
    isDirty: isTaskItemDirty,
    isEqual: isTaskItemEqual,
    autoSaveDebounceMs: 700,
    compactSheetEnabled: movePickerItemIds == null && moveProjectItemIds == null,
    setCompactImmersive,
    persistItem: (snapshot) =>
      updateTaskItem(
        snapshot.id,
        {
          title: snapshot.title,
          content: snapshot.content,
          tag_ids: snapshot.tag_ids,
          priority: snapshot.priority,
          due_at: snapshot.due_at,
          status: snapshot.status,
        },
        { seed: snapshot },
      ),
    onSaved: (saved) => {
      setItems((prev) => {
        const hasSavedId = prev.some((row) => row.id === saved.id);
        if (hasSavedId) return prev.map((row) => (row.id === saved.id ? saved : row));
        // flush 后列表可能仍短暂握着 temp id：用当前详情 id 对齐替换
        return prev.map((row) =>
          detailItem != null && row.id === detailItem.id
            ? saved
            : row.id === saved.id
              ? saved
              : row,
        );
      });
      setSearchHits((prev) => {
        const hasSavedId = prev.some((row) => row.id === saved.id);
        if (hasSavedId) return prev.map((row) => (row.id === saved.id ? saved : row));
        return prev.map((row) =>
          detailItem != null && row.id === detailItem.id
            ? saved
            : row.id === saved.id
              ? saved
              : row,
        );
      });
    },
    onPersistError: (err) => {
      setError(err instanceof Error ? err.message : String(err));
    },
  });

  const appliedItemUrlRef = useRef<number | null>(null);

  useEffect(() => {
    if (!webShell) return;
    if (detailItem) {
      writeTaskItemToUrl({ itemId: detailItem.id, present: "overlay" });
      appliedItemUrlRef.current = detailItem.id;
    } else if (appliedItemUrlRef.current != null) {
      writeTaskItemToUrl(null);
      appliedItemUrlRef.current = null;
    }
  }, [detailItem, webShell]);

  const reloadTags = useCallback(async () => {
    try {
      const tags = await fetchTags();
      setTagPool(tags.map((t) => ({ id: t.id, title: t.title })));
    } catch {
      setTagPool([]);
    }
  }, []);

  const rememberTag = useCallback((tag: TaskTagKnown) => {
    setTagPool((prev) => {
      if (prev.some((row) => row.id === tag.id && row.title === tag.title)) return prev;
      const without = prev.filter((row) => row.id !== tag.id);
      return [...without, { id: tag.id, title: tag.title }];
    });
  }, []);

  useEffect(() => {
    setTagFilterId(null);
    void reloadTags();
  }, [subjectKind, reloadTags]);

  useEffect(() => {
    if (!webShell) return;
    const fromUrl = readTaskItemFromUrl();
    if (!fromUrl) return;
    if (detailItem?.id === fromUrl.itemId) {
      appliedItemUrlRef.current = fromUrl.itemId;
      return;
    }
    if (appliedItemUrlRef.current === fromUrl.itemId && detailItem == null) return;

    const local =
      items.find((row) => row.id === fromUrl.itemId) ??
      searchHits.find((row) => row.id === fromUrl.itemId);
    if (local) {
      openTaskDetail(local);
      appliedItemUrlRef.current = fromUrl.itemId;
      return;
    }

    let cancelled = false;
    void fetchTaskItemById(fromUrl.itemId).then((row) => {
      if (cancelled) return;
      if (row) {
        openTaskDetail(row);
        appliedItemUrlRef.current = fromUrl.itemId;
      } else {
        writeTaskItemToUrl(null);
        appliedItemUrlRef.current = null;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [webShell, items, searchHits, detailItem, openTaskDetail]);

  const persistSelection = useCallback(
    (next: TaskModuleSelection) => {
      // search 为临时态：写 URL，但不覆盖 localStorage 中的清单/智能清单
      if (next.kind !== "search") {
        writeModuleSelection("tasks", next);
      }
      if (webShell) writeTaskSelectionToUrl(next);
    },
    [webShell],
  );

  const loadItemsByFilters = useCallback(async (filters: SmartListRow["filters"]) => {
    const generation = ++itemsLoadGenRef.current;
    if (!isHabitatFetchAvailable()) {
      if (generation !== itemsLoadGenRef.current) return;
      setItems([]);
      return;
    }
    try {
      const rows = await fetchTaskItemsByFilters(filters);
      if (generation !== itemsLoadGenRef.current) return;
      setItems(rows);
      void seedLocalTaskItems(rows);
    } catch {
      if (generation !== itemsLoadGenRef.current) return;
      setItems([]);
    }
  }, []);

  const loadItems = useCallback(async (listId: number) => {
    const generation = ++itemsLoadGenRef.current;
    const scope = resolveHabitatCacheScope();
    const cached = await readCachedTaskItems(scope, listId);
    if (generation !== itemsLoadGenRef.current) return;
    if (cached) setItems(normalizeTaskItemRows(cached));
    else setItems([]);
    if (isTempId(listId) || !isHabitatFetchAvailable()) {
      return;
    }
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
    const scope = resolveHabitatCacheScope();
    const cached = await readCachedTaskLists(scope);
    if (generation !== listsLoadGenRef.current) return cached ?? [];
    if (cached?.length) setLists(cached);
    if (!isHabitatFetchAvailable()) {
      return cached ?? [];
    }
    try {
      const [rows, smartRows] = await Promise.all([
        fetchTaskLists({ includeClosed: true }),
        fetchSmartLists(),
      ]);
      if (generation !== listsLoadGenRef.current) return rows;
      let merged = await reconcileServerTaskLists(rows);
      try {
        const [listStats, smartStats] = await Promise.all([
          fetchTaskListStats({ includeClosed: true }),
          fetchSmartListStats(),
        ]);
        if (generation !== listsLoadGenRef.current) return rows;
        if (listStats.size > 0) {
          merged = merged.map((list) => ({
            ...list,
            item_count: list.is_folder ? 0 : (listStats.get(list.id) ?? list.item_count),
          }));
        }
        setSmartListCounts(smartStats);
      } catch {
        // stats 为次要数据
      }
      setLists(merged);
      setSmartLists(smartRows);
      void writeCachedTaskLists(scope, merged);
      const next = resolveTaskSelection(merged, smartRows, {
        stored: readModuleSelection("tasks"),
        urlSelection: webShell ? readTaskSelectionFromUrl() : null,
        preferUrl: webShell,
      });
      setSelection(next);
      persistSelection(next);
      if (merged.length === 0) setItems([]);
      return merged;
    } catch {
      if (generation !== listsLoadGenRef.current) return cached ?? [];
      if (!cached?.length) setError("无法加载任务清单");
      return cached ?? [];
    }
  }, [persistSelection, webShell]);

  const reloadCurrentItems = useCallback(async () => {
    if (selection == null || selection.kind === "search") return;
    if (selection.kind === "list") {
      await loadItems(selection.id);
    } else {
      const row = findSmartListRowByKey(smartLists, selection.key);
      if (row) await loadItemsByFilters(row.filters);
    }
  }, [loadItems, loadItemsByFilters, selection, smartLists]);

  const refresh = useCallback(async () => {
    setError("");
    const scope = resolveHabitatCacheScope();
    const cached = await readCachedTaskLists(scope);
    if (cached?.length) {
      setLists(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      await loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [loadLists]);

  const handleManualRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError("");
    try {
      if (selection?.kind === "search") {
        await Promise.all([loadLists(), reloadTags()]);
        const q = searchQuery.trim();
        if (q) {
          const rows = await searchTaskItems({ query: q, limit: 30 });
          setSearchHits(rows);
          void seedLocalTaskItems(rows);
        }
      } else {
        await Promise.all([loadLists(), reloadCurrentItems(), reloadTags()]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }, [loadLists, refreshing, reloadCurrentItems, reloadTags, searchQuery, selection?.kind]);

  useEffect(() => {
    registerTaskOfflineModule();
  }, []);

  useEffect(() => {
    return subscribeIdMappings((event) => {
      if (event.moduleId !== "task") return;
      const { tempId, serverId } = event;

      const remapId = (id: number) => (id === tempId ? serverId : id);

      setLists((prev) => {
        let changed = false;
        const next = prev.map((row) => {
          if (row.id !== tempId && row.parent_id !== tempId) return row;
          changed = true;
          return {
            ...row,
            id: remapId(row.id),
            parent_id: row.parent_id === tempId ? serverId : row.parent_id,
          };
        });
        return changed ? next : prev;
      });

      setItems((prev) => {
        let changed = false;
        const next = prev.map((row) => {
          if (row.id !== tempId && row.list_id !== tempId) return row;
          changed = true;
          return {
            ...row,
            id: remapId(row.id),
            list_id: row.list_id === tempId ? serverId : row.list_id,
          };
        });
        return changed ? next : prev;
      });

      setSearchHits((prev) => {
        let changed = false;
        const next = prev.map((row) => {
          if (row.id !== tempId && row.list_id !== tempId) return row;
          changed = true;
          return {
            ...row,
            id: remapId(row.id),
            list_id: row.list_id === tempId ? serverId : row.list_id,
          };
        });
        return changed ? next : prev;
      });

      setDetailItem((prev) => {
        if (!prev) return prev;
        if (prev.id !== tempId && prev.list_id !== tempId) return prev;
        return {
          ...prev,
          id: remapId(prev.id),
          list_id: prev.list_id === tempId ? serverId : prev.list_id,
        };
      });

      setSelectedItemIds((prev) => {
        if (!prev.has(tempId)) return prev;
        const next = new Set(prev);
        next.delete(tempId);
        next.add(serverId);
        return next;
      });

      setSelectedFolderId((prev) => (prev === tempId ? serverId : prev));

      setSelection((prev) => {
        if (prev == null || prev.kind !== "list" || prev.id !== tempId) return prev;
        return { ...prev, id: serverId };
      });

      setMovePickerItemIds((prev) => (prev?.includes(tempId) ? prev.map(remapId) : prev));
      setMoveProjectItemIds((prev) => (prev?.includes(tempId) ? prev.map(remapId) : prev));
    });
  }, [setDetailItem]);

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
    if (selection.kind === "search") {
      setSelectionMode(false);
      setSelectedItemIds(new Set());
      selectionAnchorRef.current = null;
      resetDetail();
      return;
    }
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
    resetDetail();
  }, [selection, smartLists, loadItems, loadItemsByFilters, resetDetail]);

  useEffect(() => {
    if (selection?.kind !== "search") return;
    const q = searchQuery.trim();
    if (!q) {
      setSearchHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      void searchTaskItems({ query: q, limit: 30 })
        .then((rows) => {
          setSearchHits(rows);
          void seedLocalTaskItems(rows);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setSearchHits([]);
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selection?.kind]);

  const refreshSearchHits = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    try {
      const rows = await searchTaskItems({ query: q, limit: 30 });
      setSearchHits(rows);
      void seedLocalTaskItems(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [searchQuery]);

  const searchMode = selection?.kind === "search";
  const searchActive = searchMode;

  const applySelection = (next: TaskModuleSelection) => {
    setSelection(next);
    persistSelection(next);
    if (useDrawer) setSidebarOpen(false);
  };

  const selectSearch = () => {
    setSelectedFolderId(null);
    setSearchQuery("");
    setSearchHits([]);
    applySelection({ kind: "search" });
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

  const openListEditor = (list: TaskListRow) => {
    if (list.closed) return;
    setListEditor(list);
  };

  const saveListEditor = async (input: { name: string; parent_id: number | null }) => {
    const current = listEditor;
    if (current == null) return;
    const nameChanged = current.name !== input.name;
    const parentChanged = getParentId(current) !== input.parent_id;
    if (!nameChanged && !parentChanged) return;

    const siblings = getSiblings(
      lists.filter((l) => !l.closed),
      input.parent_id,
    ).filter((l) => l.id !== current.id);
    const patch: Partial<Pick<TaskListRow, "name" | "parent_id" | "sort_order">> = {};
    if (nameChanged) patch.name = input.name;
    if (parentChanged) {
      patch.parent_id = input.parent_id;
      patch.sort_order = siblings.length;
    }
    const optimistic: TaskListRow = {
      ...current,
      ...patch,
    };
    setLists((prev) => prev.map((l) => (l.id === current.id ? optimistic : l)));
    try {
      await updateTaskList(current.id, patch);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await loadLists();
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
    // sortOrderUpdates 要求元素仍带旧 sort_order；先算 patch 再乐观改写
    const updates = sortOrderUpdates(ordered);
    const nextSiblings = applySortOrderUpdates(ordered, updates);
    const mergedActive = [...others, ...nextSiblings].toSorted(
      (a, b) => a.sort_order - b.sort_order || a.id - b.id,
    );
    setLists([...mergedActive, ...closed]);
    try {
      await Promise.all(updates.map((u) => updateTaskList(u.id, { sort_order: u.sort_order })));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await loadLists();
    }
  };

  const persistMoveListToParent = async (listId: number, parentId: number | null) => {
    const list = lists.find((l) => l.id === listId);
    if (!list || getParentId(list) === parentId) return;
    const siblings = getSiblings(
      lists.filter((l) => !l.closed),
      parentId,
    ).filter((l) => l.id !== listId);
    const nextSort = siblings.length;
    const optimistic: TaskListRow = {
      ...list,
      parent_id: parentId,
      sort_order: nextSort,
    };
    setLists((prev) => prev.map((l) => (l.id === listId ? optimistic : l)));
    try {
      await updateTaskList(listId, {
        parent_id: parentId,
        sort_order: nextSort,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await loadLists();
    }
  };

  const persistPlaceList = async (
    listId: number,
    parentId: number | null,
    ordered: TaskListRow[],
  ) => {
    const closed = lists.filter((l) => l.closed);
    const active = lists.filter((l) => !l.closed);
    const orderedIds = new Set(ordered.map((l) => l.id));
    const others = active.filter(
      (l) => l.id !== listId && (getParentId(l) !== parentId || !orderedIds.has(l.id)),
    );
    // 与 persistSiblingOrder 相同：先对旧 sort_order 算 diff，再乐观改写
    const updates = sortOrderUpdates(ordered);
    const nextSiblings = applySortOrderUpdates(
      ordered.map((row) => ({ ...row, parent_id: parentId })),
      updates,
    );
    const mergedActive = [...others, ...nextSiblings].toSorted(
      (a, b) => a.sort_order - b.sort_order || a.id - b.id,
    );
    setLists([...mergedActive, ...closed]);
    const placed = nextSiblings.find((l) => l.id === listId);
    try {
      await updateTaskList(listId, {
        parent_id: parentId,
        sort_order: placed?.sort_order ?? nextSiblings.length,
      });
      await Promise.all(
        updates
          .filter((u) => u.id !== listId)
          .map((u) => updateTaskList(u.id, { sort_order: u.sort_order })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await loadLists();
    }
  };

  const persistItemOrder = async (orderedPending: TaskItemRow[]) => {
    const completed = items.filter((i) => i.status === "completed");
    const updates = sortOrderUpdates(orderedPending);
    const nextPending = applySortOrderUpdates(orderedPending, updates);
    setItems([...nextPending, ...completed]);
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
      let due_at: string | null = null;
      if (selection?.kind === "smart_list") {
        const row = findSmartListRowByKey(smartLists, selection.key);
        if (row) due_at = resolveSmartListDueAt(row.filters);
      }
      // 省略 sort_order：domain / offline 统一 prepend 到 pending 最前
      const created = await createTaskItem({
        title,
        list_id: targetListId,
        ...(due_at ? { due_at } : {}),
      });
      setQuickTitle("");
      await Promise.all([reloadCurrentItems(), loadLists()]);
      openTaskDetail(created);
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

  const handleDeleteItem = (item: TaskItemRow) => {
    setItemToDelete(item);
  };

  const confirmDeleteItem = async () => {
    const item = itemToDelete;
    if (!item) return;
    setItemToDelete(null);
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

  const openMovePickerForItems = useCallback(
    (itemIds: number[]) => {
      if (itemIds.length === 0) return;
      setSheetMenu(null);
      closeDetailSheet();
      window.setTimeout(() => setMovePickerItemIds(itemIds), 0);
    },
    [closeDetailSheet],
  );

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

  const openMoveProjectPicker = useCallback(
    async (itemIds: number | number[]) => {
      const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
      if (ids.length === 0) return;
      setSheetMenu(null);
      closeDetailSheet();
      try {
        setProjectsForMove(await fetchProjectsForMove());
        setMoveProjectItemIds(ids);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [closeDetailSheet],
  );

  const closeMoveProjectPicker = useCallback(() => {
    setMoveProjectItemIds(null);
  }, []);

  const handleMoveItemsToProject = async (itemIds: number[], projectId: number) => {
    if (itemIds.length === 0) return;
    try {
      await moveTaskItemsToProject(itemIds, projectId);
      closeMoveProjectPicker();
      exitSelectionMode();
      await Promise.all([reloadCurrentItems(), loadLists()]);
      if (searchActive) await refreshSearchHits();
      if (detailItem != null && itemIds.includes(detailItem.id)) closeDetailSheet();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

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
  // 保留文件夹供树形展示；MoveToListPicker 不会把文件夹当作可选目标
  const moveTargetLists = useMemo(() => lists.filter((l) => !l.closed), [lists]);
  const listNameById = useMemo(() => new Map(lists.map((l) => [l.id, l.name])), [lists]);
  const tagTitleById = useMemo(
    () => new Map(tagPool.map((t) => [t.id, t.title] as const)),
    [tagPool],
  );
  const unresolvedTagKey = useMemo(
    () => findUnresolvedTaskTagIds([...items, ...searchHits], tagTitleById).join(","),
    [items, searchHits, tagTitleById],
  );
  const attemptedUnresolvedTagKeyRef = useRef("");
  useEffect(() => {
    if (!unresolvedTagKey) {
      attemptedUnresolvedTagKeyRef.current = "";
      return;
    }
    if (attemptedUnresolvedTagKeyRef.current === unresolvedTagKey) return;
    attemptedUnresolvedTagKeyRef.current = unresolvedTagKey;
    void reloadTags();
  }, [unresolvedTagKey, reloadTags]);
  const matchTag = useCallback(
    (row: TaskItemRow) => tagFilterId == null || row.tag_ids?.includes(tagFilterId) === true,
    [tagFilterId],
  );
  const pendingItems = items.filter((i) => i.status === "pending" && matchTag(i));
  const completedItems = items.filter((i) => i.status === "completed" && matchTag(i));
  const searchPending = searchHits.filter((i) => i.status === "pending" && matchTag(i));
  const searchCompleted = searchHits.filter((i) => i.status === "completed" && matchTag(i));
  const taggedItems = items.filter(matchTag);
  const displayPending = searchActive ? searchPending : smartListCompletedOnly ? [] : pendingItems;
  const displayCompleted = searchActive
    ? searchCompleted
    : smartListCompletedOnly
      ? taggedItems
      : completedItems;
  const showCompletedSection =
    !smartListCompletedOnly && (searchActive || selection?.kind === "list");
  const itemsSortable = !searchActive && !smartListMode;
  const showListNameColumn = searchActive || smartListMode;
  const middleTitle =
    selection?.kind === "search"
      ? "搜索"
      : selection?.kind === "smart_list"
        ? (activeSmartListRow?.title ?? "智能清单")
        : inboxSelected
          ? "收件箱"
          : (selectedList?.name ?? "任务");
  const canQuickAdd =
    selection != null &&
    selection.kind !== "search" &&
    (selection.kind === "list"
      ? selectedList != null && !selectedList.closed
      : activeSmartListRow != null && allowsSmartListQuickAdd(activeSmartListRow.filters));
  const resolveListName = useCallback(
    (item: TaskItemRow) =>
      searchActive
        ? taskAttributionLabel(item)
        : item.list_id != null
          ? (listNameById.get(item.list_id) ?? `#${item.list_id}`)
          : "—",
    [searchActive, listNameById],
  );
  const allVisibleItems = (searchActive ? searchHits : items).filter(matchTag);
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

  const handleDeleteSmartList = (row: SmartListRow) => {
    setSmartListToDelete(row);
  };

  const confirmDeleteSmartList = async () => {
    const row = smartListToDelete;
    if (!row || row.id == null) return;
    setSmartListToDelete(null);
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
    onRename: openListEditor,
    onClose: handleCloseList,
    onReopen: handleReopenList,
    onDelete: handleDeleteList,
    onCreateChildFolder: (folder: TaskListRow) => openChildNamePrompt("folder", folder.id),
    onCreateChildList: (folder: TaskListRow) => openChildNamePrompt("list", folder.id),
  };

  const itemHandlers = {
    onEdit: openTaskDetail,
    onStartPomodoro: (item: TaskItemRow) =>
      launchPomodoroForTask({ id: item.id, title: item.title }),
    onToggleComplete: toggleComplete,
    onMoveTo: (item: TaskItemRow) => openMovePickerForItems([item.id]),
    onMoveToProject: (item: TaskItemRow) => void openMoveProjectPicker(item.id),
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
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => openMovePickerForItems(Array.from(selectedItemIds))}
          >
            移动到清单
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void openMoveProjectPicker(Array.from(selectedItemIds))}
          >
            移入项目
          </Button>
        </>
      ) : null}
    </>
  );

  const openListMenuSheet = (list: TaskListRow) => {
    setSheetMenu({
      title: list.name,
      items: buildListMenuItems(list, menuHandlers),
    });
  };

  const openSmartListMenuSheet = (row: SmartListRow) => {
    setSheetMenu({
      title: row.title,
      items: buildSmartListMenuItems(row, smartListMenuHandlers),
    });
  };

  const openItemMenuSheet = (item: TaskItemRow) => {
    setSheetMenu({
      title: item.title,
      items: buildItemMenuItems(item, itemHandlers, {
        listArchived: selectedList?.closed === true,
      }),
    });
  };

  const contextMenuItemsForList = (list: TaskListRow): ActionSheetItem[] =>
    buildListMenuItems(list, menuHandlers);

  const contextMenuItemsForSmartList = (row: SmartListRow): ActionSheetItem[] =>
    buildSmartListMenuItems(row, smartListMenuHandlers);

  const contextMenuItemsForItem = (item: TaskItemRow): ActionSheetItem[] =>
    buildItemMenuItems(item, itemHandlers, { listArchived: selectedList?.closed === true });

  const showMiddleContent = selection != null && !(loading && lists.length === 0);

  return (
    <>
      <TaskDndRoot
        lists={activeLists}
        pendingItems={pendingItems}
        taskItems={items}
        onReorderSiblings={(ordered, parentId) => void persistSiblingOrder(ordered, parentId)}
        onMoveListToParent={(listId, parentId) => void persistMoveListToParent(listId, parentId)}
        onPlaceList={(listId, parentId, ordered) =>
          void persistPlaceList(listId, parentId, ordered)
        }
        onReorderPending={(ordered) => void persistItemOrder(ordered)}
        onMoveTaskToList={(taskId, listId) => void handleMoveItemsToList([taskId], listId)}
        onTaskDragTowardSidebar={() => {
          if (useDrawer) setSidebarOpen(true);
        }}
      >
        <div className="h-full min-h-0">
          <ThreeColumnLayout
            layoutMode={layoutMode}
            columnSplitKey="task"
            listTitle="任务"
            middleTitle={middleTitle}
            listOpen={sidebarOpen}
            onListOpenChange={setSidebarOpen}
            listToggleAriaLabel="打开清单"
            detailOpen={detailOpen}
            onDetailOpenChange={handleDetailOpenChange}
            middleActions={
              <>
                {showMiddleContent ? selectionToolbar : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2"
                  disabled={refreshing || loading}
                  aria-label={m.habitat_common_refresh()}
                  onClick={() => void handleManualRefresh()}
                >
                  {refreshing ? <Spinner className="size-3.5" /> : m.habitat_common_refresh()}
                </Button>
                {loading || searching ? <Spinner className="size-4" /> : null}
              </>
            }
            middleHeaderExtra={
              showMiddleContent ? (
                <div className="flex w-full max-w-md items-center gap-2">
                  {searchMode ? (
                    <Input
                      className="h-8 flex-1"
                      placeholder="搜索全部清单…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  ) : null}
                  <select
                    className="border-input bg-background h-8 max-w-36 rounded-md border px-2 text-xs"
                    value={tagFilterId ?? ""}
                    aria-label="按标签筛选"
                    onChange={(e) => {
                      const v = e.target.value;
                      setTagFilterId(v ? Number(v) : null);
                    }}
                  >
                    <option value="">全部标签</option>
                    {tagPool.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null
            }
            list={
              <div className="flex min-h-0 flex-1 flex-col">
                <ModuleScopeBar>
                  <SubjectScopeToggle />
                </ModuleScopeBar>
                <ListSidebar
                  key={subjectKind}
                  builtinSmartListSection={
                    <BuiltinSmartListSection
                      smartLists={smartLists}
                      selectedKey={selection?.kind === "smart_list" ? selection.key : null}
                      defaultInboxId={defaultInboxId}
                      inboxItemCount={inboxItemCount}
                      itemCounts={smartListCounts}
                      inboxSelected={inboxSelected}
                      onSelectSmartList={selectSmartList}
                      onSelectInbox={selectInbox}
                    />
                  }
                  customSmartListSection={
                    <CustomSmartListSection
                      smartLists={smartLists}
                      selectedKey={selection?.kind === "smart_list" ? selection.key : null}
                      itemCounts={smartListCounts}
                      inboxSelected={inboxSelected}
                      onSelectSmartList={selectSmartList}
                      onCreateSmartList={() => setSmartListEditor(null)}
                      onOpenSmartListMenu={openSmartListMenuSheet}
                      contextMenuEnabled={contextMenuEnabled}
                      contextMenuItemsForSmartList={contextMenuItemsForSmartList}
                      useActionSheet={useActionSheet}
                    />
                  }
                  activeLists={activeLists}
                  closedLists={closedLists}
                  showClosed={showClosed}
                  selectedListId={listSidebarSelectedId}
                  selectedFolderId={selectedFolderId}
                  searchSelected={searchMode}
                  newListName={newListName}
                  newFolderName={newFolderName}
                  useActionSheet={useActionSheet}
                  onToggleShowClosed={() => setShowClosed((v) => !v)}
                  onSelectList={selectList}
                  onSelectFolder={selectFolder}
                  onSelectSearch={selectSearch}
                  onCreateList={() => void handleCreateList()}
                  onCreateFolder={() => void handleCreateFolder()}
                  onNewListNameChange={setNewListName}
                  onNewFolderNameChange={setNewFolderName}
                  onOpenListMenu={openListMenuSheet}
                  contextMenuEnabled={contextMenuEnabled}
                  contextMenuItemsForList={contextMenuItemsForList}
                  onEditList={openListEditor}
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
                    {selectionMode && selectedItemIds.size > 0 ? (
                      <div className="border bg-muted/95 flex shrink-0 items-center gap-2 border-b p-3">
                        <span className="text-muted-foreground min-w-0 flex-1 text-sm">
                          已选 {selectedItemIds.size} 项
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openMovePickerForItems(Array.from(selectedItemIds))}
                        >
                          移动到清单
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void openMoveProjectPicker(Array.from(selectedItemIds))}
                        >
                          移入项目
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={exitSelectionMode}>
                          取消
                        </Button>
                      </div>
                    ) : searchActive || !canQuickAdd ? null : (
                      <QuickAddBar
                        value={quickTitle}
                        onChange={setQuickTitle}
                        disabled={writesDisabled}
                        onSubmit={() => void handleQuickAdd()}
                        className="border flex shrink-0 gap-2 border-b p-3"
                      />
                    )}
                    <PullToRefresh
                      className="min-h-0 flex-1"
                      contentClassName="touch-pan-y px-2 py-2"
                      disabled={refreshing || loading}
                      onRefresh={handleManualRefresh}
                    >
                      {displayPending.length === 0 && displayCompleted.length === 0 ? (
                        <EmptyState
                          message={
                            searchActive
                              ? searchQuery.trim()
                                ? "全部清单中无匹配任务"
                                : "输入关键词搜索全部清单"
                              : "暂无任务，在上方快速添加"
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
                          tagTitleById={tagTitleById}
                          onToggleComplete={(item) => void toggleComplete(item)}
                          onEdit={openTaskDetail}
                          onOpenItemMenu={openItemMenuSheet}
                          contextMenuEnabled={contextMenuEnabled}
                          contextMenuItemsForItem={contextMenuItemsForItem}
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
                          tagTitleById={tagTitleById}
                          onToggleComplete={(item) => void toggleComplete(item)}
                          onEdit={openTaskDetail}
                          onOpenItemMenu={openItemMenuSheet}
                          contextMenuEnabled={contextMenuEnabled}
                          contextMenuItemsForItem={contextMenuItemsForItem}
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
                          tagTitleById={tagTitleById}
                          onToggleComplete={(item) => void toggleComplete(item)}
                          onEdit={openTaskDetail}
                          onOpenItemMenu={openItemMenuSheet}
                          contextMenuEnabled={contextMenuEnabled}
                          contextMenuItemsForItem={contextMenuItemsForItem}
                          onSelectItem={handleSelectItem}
                          onLongPressSelect={enterSelectionWithItem}
                        />
                      ) : null}
                    </PullToRefresh>
                  </>
                ) : null}
              </div>
            }
            detail={
              detailItem ? (
                <TaskDetailPanel
                  item={detailItem}
                  onChange={setDetailItem}
                  saveStatus={detailSaveStatus}
                  onTagKnown={rememberTag}
                  {...(layoutMode === "compact" && !detailEditMode
                    ? { onTextFieldActivate: enterDetailEdit }
                    : {})}
                />
              ) : (
                <div className="text-muted-foreground flex h-full min-h-0 items-center justify-center p-8 text-sm">
                  选择任务查看详情
                </div>
              )
            }
          />
        </div>

        {detailEditMode && detailItem ? (
          <DetailEditPageShell onBack={exitDetailEdit}>
            <TaskDetailPanel
              item={detailItem}
              onChange={setDetailItem}
              saveStatus={detailSaveStatus}
              onTagKnown={rememberTag}
            />
          </DetailEditPageShell>
        ) : null}

        {sheetMenu ? (
          <ActionSheet
            title={sheetMenu.title}
            items={sheetMenu.items}
            onClose={() => setSheetMenu(null)}
          />
        ) : null}

        <ListEditorDialog
          open={listEditor != null}
          list={listEditor}
          lists={lists}
          onClose={() => setListEditor(null)}
          onSave={saveListEditor}
        />

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

        <ConfirmDialog
          open={itemToDelete != null}
          title="删除确认"
          description={
            itemToDelete ? `确定删除任务「${itemToDelete.title}」？此操作不可恢复。` : undefined
          }
          confirmLabel="删除"
          variant="error"
          onConfirm={() => void confirmDeleteItem()}
          onCancel={() => setItemToDelete(null)}
        />

        <ConfirmDialog
          open={smartListToDelete != null}
          title="删除确认"
          description={
            smartListToDelete
              ? `确定删除智能清单「${smartListToDelete.title}」？此操作不可恢复。`
              : undefined
          }
          confirmLabel="删除"
          variant="error"
          onConfirm={() => void confirmDeleteSmartList()}
          onCancel={() => setSmartListToDelete(null)}
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

      <MoveToProjectPicker
        open={moveProjectItemIds != null}
        projects={projectsForMove}
        title={
          moveProjectItemIds != null && moveProjectItemIds.length > 1
            ? `移入项目（${moveProjectItemIds.length} 项）`
            : "移动到项目"
        }
        currentProjectId={
          moveProjectItemIds != null && moveProjectItemIds.length === 1
            ? (items.find((i) => i.id === moveProjectItemIds[0])?.project_id ??
              searchHits.find((i) => i.id === moveProjectItemIds[0])?.project_id ??
              null)
            : null
        }
        onSelect={(projectId) => {
          if (moveProjectItemIds == null) return;
          void handleMoveItemsToProject(moveProjectItemIds, projectId);
        }}
        onClose={closeMoveProjectPicker}
      />
    </>
  );
}
