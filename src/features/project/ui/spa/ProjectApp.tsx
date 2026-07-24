import { launchPomodoroForTask } from "@freeanima/frontend/shell-sdk";
import {
  readModuleSelection,
  writeModuleSelection,
} from "@freeanima/frontend/shell-sdk/module-selection.ts";
import { subscribeIdMappings } from "@freeanima/frontend/shell-sdk/offline-id-map";
import { SubjectScopeToggle, useSubjectScope } from "@freeanima/frontend/shell-sdk/react.tsx";
import {
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
  ModuleScopeBar,
  PullToRefresh,
  QuickAddBar,
  useDetailPanelState,
} from "@freeanima/frontend/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/frontend/ui-kit/composite";
import {
  ThreeColumnLayout,
  useDrawerNav,
  useThreeColumnLayoutMode,
} from "@freeanima/frontend/ui-kit/layout";
import { m } from "@paraglide/messages";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { registerProjectOfflineModule } from "./lib/offline-store.ts";

import { MoveToListPicker } from "@freeanima/frontend/ui-kit/composite";
import { MoveToProjectPicker } from "./components/MoveToProjectPicker.tsx";
import {
  ProjectEditorDialog,
  projectEditorDatesToIso,
  type ProjectEditorTarget,
} from "./components/ProjectEditorDialog.tsx";
import { ProjectDetailHeader } from "./components/ProjectDetailHeader.tsx";
import { ProjectDndRoot } from "./components/ProjectDndRoot.tsx";
import { ProjectSidebar } from "./components/ProjectSidebar.tsx";
import { ProjectTaskDetailPanel } from "./components/ProjectTaskDetailPanel.tsx";
import { ProjectTaskList } from "./components/ProjectTaskList.tsx";
import type { ProjectDragEndAction } from "./lib/resolve-project-drag-end.ts";
import { applySortOrderUpdates, sortOrderUpdates } from "./lib/reorder.ts";
import {
  completeProjectTask,
  createProjectApi,
  createProjectFolderApi,
  createProjectTask,
  deleteProjectApi,
  deleteProjectFolderApi,
  deleteProjectTask,
  fetchProjectFolders,
  fetchProjectStats,
  fetchProjectTasks,
  fetchProjects,
  fetchProjectsForMove,
  fetchTaskListsForMove,
  moveTaskToProject,
  moveProjectTaskToList,
  patchProjectApi,
  patchProjectFolderApi,
  uncompleteProjectTask,
  updateProjectTask,
  type ProjectFolderRow,
  type ProjectRow,
  type ProjectPickerRow,
  type TaskItemRow,
  type TaskListRow,
} from "./lib/api.ts";
import {
  buildFolderMenuItems,
  buildProjectMenuItems,
  buildProjectTaskMenuItems,
  type ProjectMenuItem,
} from "./lib/project-menus.ts";
import {
  folderIdForNewProject,
  readHideCompleted,
  writeHideCompleted,
} from "./lib/project-tree.ts";
import {
  useActionSheetCapability,
  useContextMenuCapability,
} from "@freeanima/frontend/shell-sdk/react.tsx";
import { TaskTagFilterBar } from "@freeanima/features/task/ui/spa/components/TaskTagFilterBar.tsx";
import type { TaskTagKnown } from "@freeanima/features/task/ui/spa/components/TaskTagPicker.tsx";
import {
  collectTagsFromTaskItems,
  findUnresolvedTaskTagIds,
  matchTaskItemByTag,
} from "@freeanima/features/task/ui/spa/lib/task-tag-filter.ts";
import { cloneTaskItem, isTaskItemDirty, isTaskItemEqual } from "./lib/task-detail-dirty.ts";
import { fetchTags } from "@freeanima/features/tag/ui/spa/lib/api.ts";

function menuToSheet(items: ProjectMenuItem[]): ActionSheetItem[] {
  return items.map((item) => ({
    label: item.label,
    ...(item.danger ? { danger: true } : {}),
    onClick: item.onClick,
  }));
}

export function ProjectApp() {
  const { kind: subjectKind } = useSubjectScope();
  const writesDisabled = false;
  const contextMenuEnabled = useContextMenuCapability();
  const useActionSheet = useActionSheetCapability();
  const useDrawer = useDrawerNav();
  const layoutMode = useThreeColumnLayoutMode();

  useEffect(() => {
    registerProjectOfflineModule();
  }, []);

  const [listOpen, setListOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [folders, setFolders] = useState<ProjectFolderRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(() => readHideCompleted(subjectKind));
  const [tasks, setTasks] = useState<TaskItemRow[]>([]);
  const [tagPool, setTagPool] = useState<Array<{ id: number; title: string }>>([]);
  const [tagFilterId, setTagFilterId] = useState<number | null>(null);
  const [selectionSubjectKind, setSelectionSubjectKind] = useState(subjectKind);

  // subject 切换时在 render 阶段清空选中，避免详情 effect 用旧 ID 打到新 world
  if (selectionSubjectKind !== subjectKind) {
    setSelectionSubjectKind(subjectKind);
    setSelectedFolderId(null);
    setSelectedProjectId(null);
    setTasks([]);
    setTagFilterId(null);
  }

  const [newFolderName, setNewFolderName] = useState("");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [quickTaskTitle, setQuickTaskTitle] = useState("");

  const [editorTarget, setEditorTarget] = useState<ProjectEditorTarget | null>(null);
  const [childFolderParentId, setChildFolderParentId] = useState<number | null>(null);
  const [childFolderName, setChildFolderName] = useState("");

  const {
    item: detailItem,
    setItem: setDetailItem,
    detailOpen,
    saveStatus: detailSaveStatus,
    openDetail: openTaskDetail,
    closeDetail: closeTaskDetail,
    handleDetailOpenChange,
    resetDetail,
    applySavedItem,
  } = useDetailPanelState<TaskItemRow>({
    layoutMode,
    cloneItem: cloneTaskItem,
    isDirty: isTaskItemDirty,
    isEqual: isTaskItemEqual,
    persistItem: (snapshot) =>
      updateProjectTask(subjectKind, snapshot.id, {
        title: snapshot.title,
        content: snapshot.content,
        tag_ids: snapshot.tag_ids,
        priority: snapshot.priority,
        due_at: snapshot.due_at,
        status: snapshot.status,
      }),
    onSaved: (saved) => {
      setTasks((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
    },
  });

  useEffect(() => {
    return subscribeIdMappings((event) => {
      if (event.moduleId !== "project") return;
      const { tempId, serverId } = event;
      const remapId = (id: number) => (id === tempId ? serverId : id);

      setFolders((prev) => {
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

      setProjects((prev) => {
        let changed = false;
        const next = prev.map((row) => {
          if (row.id !== tempId && row.folder_id !== tempId) return row;
          changed = true;
          return {
            ...row,
            id: remapId(row.id),
            folder_id: row.folder_id === tempId ? serverId : row.folder_id,
          };
        });
        return changed ? next : prev;
      });

      setTasks((prev) => {
        let changed = false;
        const next = prev.map((row) => {
          if (row.id !== tempId && row.project_id !== tempId) {
            return row;
          }
          changed = true;
          return {
            ...row,
            id: remapId(row.id),
            project_id: row.project_id === tempId ? serverId : row.project_id,
          };
        });
        return changed ? next : prev;
      });

      setSelectedFolderId((prev) => (prev === tempId ? serverId : prev));
      setSelectedProjectId((prev) => {
        if (prev === tempId) {
          writeModuleSelection("project", serverId, { subjectKind });
          return serverId;
        }
        return prev;
      });
      setDetailItem((prev) => {
        if (!prev) return prev;
        if (prev.id !== tempId && prev.project_id !== tempId) {
          return prev;
        }
        return {
          ...prev,
          id: remapId(prev.id),
          project_id: prev.project_id === tempId ? serverId : prev.project_id,
        };
      });
    });
  }, [setDetailItem, subjectKind]);

  const [sheetItems, setSheetItems] = useState<ActionSheetItem[] | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<ProjectFolderRow | null>(null);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<ProjectRow | null>(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<TaskItemRow | null>(null);
  const [moveToListItem, setMoveToListItem] = useState<TaskItemRow | null>(null);
  const [moveToProjectItem, setMoveToProjectItem] = useState<TaskItemRow | null>(null);
  const [taskListsForMove, setTaskListsForMove] = useState<TaskListRow[]>([]);
  const [projectsForMove, setProjectsForMove] = useState<ProjectPickerRow[]>([]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const activeProjects = useMemo(() => projects.filter((p) => p.status === "active"), [projects]);
  const inactiveProjects = useMemo(() => projects.filter((p) => p.status !== "active"), [projects]);

  const reload = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) setLoading(true);
      setError("");
      try {
        const [folderRows, projectRows] = await Promise.all([
          fetchProjectFolders(subjectKind),
          fetchProjects(subjectKind),
        ]);
        let projectsWithCounts = projectRows;
        try {
          const stats = await fetchProjectStats(subjectKind);
          if (stats.size > 0) {
            projectsWithCounts = projectRows.map((p) => ({
              ...p,
              task_count: stats.get(p.id) ?? p.task_count ?? 0,
            }));
          }
        } catch {
          // stats 为次要数据，失败时保留 list 默认 0
        }
        setFolders(folderRows);
        setProjects(projectsWithCounts);

        const stored = readModuleSelection("project", { subjectKind });
        const active = projectsWithCounts.filter((p) => p.status === "active");
        const pickId =
          stored != null && projectsWithCounts.some((p) => p.id === stored)
            ? stored
            : (active[0]?.id ?? projectsWithCounts[0]?.id ?? null);
        setSelectedProjectId((prev) => {
          if (prev != null && projectsWithCounts.some((p) => p.id === prev)) return prev;
          return pickId;
        });
        if (
          pickId != null &&
          projectsWithCounts.some((p) => p.id === pickId && p.status !== "active")
        ) {
          setShowInactive(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!opts?.quiet) setLoading(false);
      }
    },
    [subjectKind],
  );

  const reloadProjectDetail = useCallback(async () => {
    if (selectedProjectId == null) {
      setTasks([]);
      return;
    }
    try {
      const ts = await fetchProjectTasks(subjectKind, selectedProjectId);
      setTasks(ts);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [selectedProjectId, subjectKind]);

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

  const handleManualRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([reload({ quiet: true }), reloadProjectDetail(), reloadTags()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, reload, reloadProjectDetail, reloadTags]);

  useEffect(() => {
    setHideCompleted(readHideCompleted(subjectKind));
  }, [subjectKind]);

  useEffect(() => {
    void reloadTags();
  }, [subjectKind, reloadTags]);

  const tagTitleById = useMemo(
    () => new Map(tagPool.map((t) => [t.id, t.title] as const)),
    [tagPool],
  );

  const unresolvedTagKey = useMemo(
    () => findUnresolvedTaskTagIds(tasks, tagTitleById).join(","),
    [tasks, tagTitleById],
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

  const projectTags = useMemo(
    () => collectTagsFromTaskItems(tasks, tagTitleById),
    [tasks, tagTitleById],
  );

  const filteredTasks = useMemo(
    () => tasks.filter((row) => matchTaskItemByTag(row, tagFilterId)),
    [tasks, tagFilterId],
  );

  useEffect(() => {
    if (tagFilterId == null) return;
    if (!projectTags.some((tag) => tag.id === tagFilterId)) {
      setTagFilterId(null);
    }
  }, [projectTags, tagFilterId]);

  useEffect(() => {
    resetDetail();
    void reload();
  }, [reload, resetDetail, subjectKind]);

  useEffect(() => {
    void reloadProjectDetail();
  }, [reloadProjectDetail]);

  useEffect(() => {
    if (selectedProjectId != null && selectedProject?.status !== "active") {
      setShowInactive(true);
    }
  }, [selectedProjectId, selectedProject?.status]);

  const handleSelectProject = (id: number) => {
    setSelectedProjectId(id);
    setTagFilterId(null);
    writeModuleSelection("project", id, { subjectKind });
    setSelectedFolderId(null);
    closeTaskDetail({ discard: true });
    if (useDrawer) setListOpen(false);
  };

  const handleCreateFolder = async (parentId: number | null, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await createProjectFolderApi(subjectKind, trimmed, parentId);
    await reload();
  };

  const handleCreateProject = async () => {
    const title = newProjectTitle.trim();
    if (!title) return;
    const folder_id = folderIdForNewProject(selectedProjectId, selectedFolderId, projects);
    const item = await createProjectApi(subjectKind, {
      title,
      folder_id,
    });
    setNewProjectTitle("");
    setSelectedProjectId(item.id);
    writeModuleSelection("project", item.id, { subjectKind });
    await reload();
  };

  const promptCreateProject = () => {
    if (!newProjectTitle.trim()) return;
    void handleCreateProject();
  };

  const toggleHideCompleted = () => {
    setHideCompleted((prev) => {
      const next = !prev;
      writeHideCompleted(subjectKind, next);
      return next;
    });
  };

  const handleQuickAddTask = async () => {
    if (selectedProjectId == null) return;
    const title = quickTaskTitle.trim();
    if (!title) return;
    // 省略 sort_order：与清单一致，domain / offline 统一 prepend 到 pending 最前
    const created = await createProjectTask(subjectKind, {
      title,
      project_id: selectedProjectId,
    });
    setQuickTaskTitle("");
    await reloadProjectDetail();
    await reload();
    openTaskDetail(created);
  };

  const persistProjectTaskOrder = async (orderedPending: TaskItemRow[]) => {
    const completed = tasks.filter((t) => t.status === "completed");
    const updates = sortOrderUpdates(orderedPending);
    const nextPending = applySortOrderUpdates(orderedPending, updates);
    setTasks([...nextPending, ...completed]);
    try {
      await Promise.all(
        updates.map((u) => updateProjectTask(subjectKind, u.id, { sort_order: u.sort_order })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await reloadProjectDetail();
    }
  };

  const handleToggleComplete = async (item: TaskItemRow) => {
    const saved =
      item.status === "completed"
        ? await uncompleteProjectTask(subjectKind, item.id)
        : await completeProjectTask(subjectKind, item.id);
    setTasks((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
    applySavedItem(saved);
  };

  const handleDeleteTask = (item: TaskItemRow) => {
    setDeleteTaskTarget(item);
  };

  const confirmDeleteTask = async () => {
    const item = deleteTaskTarget;
    if (!item) return;
    setDeleteTaskTarget(null);
    await deleteProjectTask(subjectKind, item.id);
    setTasks((prev) => prev.filter((t) => t.id !== item.id));
    if (detailItem?.id === item.id) closeTaskDetail();
    await reload();
  };

  const openMoveToListPicker = useCallback(
    async (item: TaskItemRow) => {
      setSheetItems(null);
      try {
        setTaskListsForMove(await fetchTaskListsForMove(subjectKind));
        setMoveToListItem(item);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [subjectKind],
  );

  const closeMoveToListPicker = useCallback(() => {
    setMoveToListItem(null);
  }, []);

  const openMoveToProjectPicker = useCallback(
    async (item: TaskItemRow) => {
      setSheetItems(null);
      try {
        setProjectsForMove(await fetchProjectsForMove(subjectKind));
        setMoveToProjectItem(item);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [subjectKind],
  );

  const closeMoveToProjectPicker = useCallback(() => {
    setMoveToProjectItem(null);
  }, []);

  const handleMoveTaskToList = async (itemId: number, listId: number) => {
    try {
      await moveProjectTaskToList(subjectKind, itemId, listId);
      closeMoveToListPicker();
      setTasks((prev) => prev.filter((t) => t.id !== itemId));
      if (detailItem?.id === itemId) closeTaskDetail();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleMoveTaskToProject = async (itemId: number, projectId: number) => {
    if (projectId === selectedProjectId) {
      closeMoveToProjectPicker();
      return;
    }
    try {
      await moveTaskToProject(subjectKind, itemId, projectId);
      closeMoveToProjectPicker();
      if (detailItem?.id === itemId) closeTaskDetail();
      if (projectId === selectedProjectId) {
        await reloadProjectDetail();
      } else {
        setTasks((prev) => prev.filter((t) => t.id !== itemId));
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const buildTaskMenuForItem = useCallback(
    (item: TaskItemRow): ProjectMenuItem[] => {
      const handlers: Parameters<typeof buildProjectTaskMenuItems>[1] = {
        onEdit: () => openTaskDetail(item),
        onToggleComplete: () => void handleToggleComplete(item),
        onMoveToList: () => void openMoveToListPicker(item),
        onMoveToProject: () => void openMoveToProjectPicker(item),
        onDelete: () => handleDeleteTask(item),
      };
      if (item.status === "pending") {
        handlers.onStartPomodoro = () => launchPomodoroForTask({ id: item.id, title: item.title });
      }
      return buildProjectTaskMenuItems(item, handlers);
    },
    [openMoveToListPicker, openMoveToProjectPicker, openTaskDetail],
  );

  const handleProjectStatus = async (projectId: number, status: ProjectRow["status"]) => {
    if (writesDisabled) return;
    await patchProjectApi(subjectKind, projectId, { status });
    await reload();
    if (selectedProjectId === projectId) await reloadProjectDetail();
  };

  const openFolderEditor = (folder: ProjectFolderRow) => {
    setEditorTarget({ kind: "folder", folder });
  };

  const openProjectEditor = (project: ProjectRow) => {
    setEditorTarget({ kind: "project", project });
  };

  const saveEditor = async (input: {
    name: string;
    folderId: number | null;
    content?: string;
    startLocal?: string;
    endLocal?: string;
  }) => {
    if (editorTarget == null) return;
    if (editorTarget.kind === "folder") {
      await patchProjectFolderApi(subjectKind, editorTarget.folder.id, {
        name: input.name,
        parent_id: input.folderId,
      });
    } else {
      const dates = projectEditorDatesToIso(input.startLocal ?? "", input.endLocal ?? "");
      await patchProjectApi(subjectKind, editorTarget.project.id, {
        title: input.name,
        folder_id: input.folderId,
        ...(input.content !== undefined ? { content: input.content } : {}),
        start_at: dates.start_at,
        end_at: dates.end_at,
      });
    }
    await reload();
  };

  const applyDragAction = async (action: Exclude<ProjectDragEndAction, { type: "noop" }>) => {
    try {
      if (action.type === "moveFolder") {
        setFolders((prev) =>
          prev.map((f) => (f.id === action.folderId ? { ...f, parent_id: action.parentId } : f)),
        );
        await patchProjectFolderApi(subjectKind, action.folderId, {
          parent_id: action.parentId,
        });
      } else if (action.type === "reorderFolders" || action.type === "placeFolder") {
        // sortOrderUpdates 要求仍带旧 sort_order；先算 patch 再乐观改写
        const updates = sortOrderUpdates(action.ordered);
        const ordered = applySortOrderUpdates(
          action.ordered.map((row) => ({ ...row, parent_id: action.parentId })),
          updates,
        );
        setFolders((prev) => {
          const ids = new Set(ordered.map((f) => f.id));
          const others = prev.filter((f) => !ids.has(f.id));
          return [...others, ...ordered];
        });
        const placedFolderId = action.type === "placeFolder" ? action.folderId : null;
        if (placedFolderId != null) {
          const placed = ordered.find((f) => f.id === placedFolderId);
          await patchProjectFolderApi(subjectKind, placedFolderId, {
            parent_id: action.parentId,
            sort_order: placed?.sort_order ?? ordered.length,
          });
        }
        await Promise.all(
          updates
            .filter((u) => u.id !== placedFolderId)
            .map((u) => patchProjectFolderApi(subjectKind, u.id, { sort_order: u.sort_order })),
        );
      } else if (action.type === "moveProject") {
        setProjects((prev) =>
          prev.map((p) => (p.id === action.projectId ? { ...p, folder_id: action.folderId } : p)),
        );
        await patchProjectApi(subjectKind, action.projectId, { folder_id: action.folderId });
      } else if (action.type === "reorderProjects" || action.type === "placeProject") {
        const updates = sortOrderUpdates(action.ordered);
        const ordered = applySortOrderUpdates(
          action.ordered.map((row) => ({ ...row, folder_id: action.folderId })),
          updates,
        );
        setProjects((prev) => {
          const ids = new Set(ordered.map((p) => p.id));
          const others = prev.filter((p) => !ids.has(p.id));
          return [...others, ...ordered];
        });
        const placedProjectId = action.type === "placeProject" ? action.projectId : null;
        if (placedProjectId != null) {
          const placed = ordered.find((p) => p.id === placedProjectId);
          await patchProjectApi(subjectKind, placedProjectId, {
            folder_id: action.folderId,
            sort_order: placed?.sort_order ?? ordered.length,
          });
        }
        await Promise.all(
          updates
            .filter((u) => u.id !== placedProjectId)
            .map((u) => patchProjectApi(subjectKind, u.id, { sort_order: u.sort_order })),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await reload();
    }
  };

  const openFolderMenuSheet = (folder: ProjectFolderRow) => {
    setSheetItems(
      menuToSheet(
        buildFolderMenuItems(folder, {
          onEdit: openFolderEditor,
          onCreateChildFolder: (f) => setChildFolderParentId(f.id),
          onDelete: (f) => setDeleteFolderTarget(f),
        }),
      ),
    );
  };

  const openProjectMenuSheet = (project: ProjectRow) => {
    setSheetItems(
      menuToSheet(
        buildProjectMenuItems(project, {
          onEdit: openProjectEditor,
          onDelete: (p) => setDeleteProjectTarget(p),
          onStatusChange: (p, status) => void handleProjectStatus(p.id, status),
          hideCompleted,
          onToggleHideCompleted: toggleHideCompleted,
        }),
      ),
    );
  };

  const openTaskMenuSheet = (item: TaskItemRow) => {
    setSheetItems(menuToSheet(buildTaskMenuForItem(item)));
  };

  const contextMenuItemsForFolder = (folder: ProjectFolderRow): ActionSheetItem[] =>
    menuToSheet(
      buildFolderMenuItems(folder, {
        onEdit: openFolderEditor,
        onCreateChildFolder: (f) => setChildFolderParentId(f.id),
        onDelete: (f) => setDeleteFolderTarget(f),
      }),
    );

  const contextMenuItemsForProject = (project: ProjectRow): ActionSheetItem[] =>
    menuToSheet(
      buildProjectMenuItems(project, {
        onEdit: openProjectEditor,
        onDelete: (p) => setDeleteProjectTarget(p),
        onStatusChange: (p, status) => void handleProjectStatus(p.id, status),
        hideCompleted,
        onToggleHideCompleted: toggleHideCompleted,
      }),
    );

  const contextMenuItemsForItem = (item: TaskItemRow): ActionSheetItem[] =>
    menuToSheet(buildTaskMenuForItem(item));

  return (
    <div className="flex h-full min-h-0 flex-col">
      {error ? <div className="px-3 py-2 text-sm text-error">{error}</div> : null}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <ThreeColumnLayout
          layoutMode={layoutMode}
          columnSplitKey="project"
          listTitle="项目"
          middleTitle={selectedProject?.title ?? "选择项目"}
          listOpen={listOpen}
          onListOpenChange={setListOpen}
          listToggleAriaLabel="打开项目树"
          detailOpen={detailOpen}
          onDetailOpenChange={handleDetailOpenChange}
          middleActions={
            <div className="flex min-w-0 items-center gap-2">
              {selectedProject ? <ProjectDetailHeader project={selectedProject} /> : null}
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
            </div>
          }
          list={
            <div className="flex h-full min-h-0 flex-col">
              <ModuleScopeBar>
                <SubjectScopeToggle />
              </ModuleScopeBar>
              <ProjectDndRoot
                folders={folders}
                projects={projects}
                onAction={(action) => void applyDragAction(action)}
              >
                <ProjectSidebar
                  subjectKind={subjectKind}
                  folders={folders}
                  projects={activeProjects}
                  inactiveProjects={inactiveProjects}
                  showInactive={showInactive}
                  onToggleShowInactive={setShowInactive}
                  selectedProjectId={selectedProjectId}
                  selectedFolderId={selectedFolderId}
                  newFolderName={newFolderName}
                  newProjectTitle={newProjectTitle}
                  writesDisabled={writesDisabled}
                  useActionSheet={useActionSheet}
                  onSelectProject={handleSelectProject}
                  onSelectFolder={setSelectedFolderId}
                  onCreateFolder={() =>
                    void handleCreateFolder(selectedFolderId, newFolderName).then(() =>
                      setNewFolderName(""),
                    )
                  }
                  onCreateProject={promptCreateProject}
                  onNewFolderNameChange={setNewFolderName}
                  onNewProjectTitleChange={setNewProjectTitle}
                  onOpenFolderMenu={openFolderMenuSheet}
                  onOpenProjectMenu={openProjectMenuSheet}
                  contextMenuEnabled={contextMenuEnabled}
                  contextMenuItemsForFolder={contextMenuItemsForFolder}
                  contextMenuItemsForProject={contextMenuItemsForProject}
                  onEditFolder={openFolderEditor}
                  onEditProject={openProjectEditor}
                />
              </ProjectDndRoot>
            </div>
          }
          middle={
            selectedProject ? (
              <div className="flex h-full min-h-0 flex-col">
                <QuickAddBar
                  value={quickTaskTitle}
                  onChange={setQuickTaskTitle}
                  disabled={writesDisabled}
                  onSubmit={() => void handleQuickAddTask()}
                  className="border flex shrink-0 gap-2 border-b p-3"
                />
                <TaskTagFilterBar
                  tags={projectTags}
                  value={tagFilterId}
                  onChange={setTagFilterId}
                />
                <PullToRefresh
                  className="min-h-0 flex-1"
                  contentClassName="touch-pan-y px-2 py-2"
                  disabled={refreshing || loading}
                  onRefresh={handleManualRefresh}
                >
                  <ProjectTaskList
                    items={filteredTasks}
                    activeItemId={detailItem?.id ?? null}
                    hideCompleted={hideCompleted}
                    useActionSheet={useActionSheet}
                    disabled={writesDisabled}
                    writesDisabled={writesDisabled}
                    tagTitleById={tagTitleById}
                    onToggleComplete={(item) => void handleToggleComplete(item)}
                    onEdit={openTaskDetail}
                    onOpenItemMenu={openTaskMenuSheet}
                    contextMenuEnabled={contextMenuEnabled}
                    contextMenuItemsForItem={contextMenuItemsForItem}
                    onReorderPending={(ordered) => void persistProjectTaskOrder(ordered)}
                  />
                </PullToRefresh>
              </div>
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center p-8 text-sm">
                从左侧选择项目
              </div>
            )
          }
          detail={
            detailItem ? (
              <ProjectTaskDetailPanel
                item={detailItem}
                onChange={setDetailItem}
                saveStatus={detailSaveStatus}
                onTagKnown={rememberTag}
              />
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center p-8 text-sm">
                选择任务查看详情
              </div>
            )
          }
        />
      )}

      {sheetItems ? <ActionSheet items={sheetItems} onClose={() => setSheetItems(null)} /> : null}

      <MoveToListPicker
        open={moveToListItem != null}
        lists={taskListsForMove}
        currentListId={moveToListItem?.list_id ?? null}
        onSelect={(listId) => {
          if (moveToListItem == null) return;
          void handleMoveTaskToList(moveToListItem.id, listId);
        }}
        onClose={closeMoveToListPicker}
      />

      <MoveToProjectPicker
        open={moveToProjectItem != null}
        projects={projectsForMove}
        currentProjectId={selectedProjectId}
        onSelect={(projectId) => {
          if (moveToProjectItem == null) return;
          void handleMoveTaskToProject(moveToProjectItem.id, projectId);
        }}
        onClose={closeMoveToProjectPicker}
      />

      <ProjectEditorDialog
        open={editorTarget != null}
        target={editorTarget}
        folders={folders}
        onClose={() => setEditorTarget(null)}
        onSave={(input) => saveEditor(input)}
      />

      <Dialog
        open={childFolderParentId != null}
        onOpenChange={(open) => {
          if (!open) {
            setChildFolderParentId(null);
            setChildFolderName("");
          }
        }}
      >
        <DialogContent className="max-w-sm safe-area-pt safe-area-pb">
          <DialogHeader>
            <DialogTitle>新建子文件夹</DialogTitle>
          </DialogHeader>
          <Input
            focusOnMount
            value={childFolderName}
            onChange={(e) => setChildFolderName(e.target.value)}
            placeholder="文件夹名称"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChildFolderParentId(null)}>
              取消
            </Button>
            <Button
              disabled={writesDisabled}
              onClick={() =>
                void handleCreateFolder(childFolderParentId, childFolderName).then(() => {
                  setChildFolderParentId(null);
                  setChildFolderName("");
                })
              }
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteFolderTarget != null}
        title="删除文件夹"
        description={deleteFolderTarget ? `删除文件夹「${deleteFolderTarget.name}」？` : undefined}
        confirmLabel="删除"
        variant="error"
        onConfirm={() => {
          if (!deleteFolderTarget) return;
          void deleteProjectFolderApi(subjectKind, deleteFolderTarget.id).then(() => {
            setDeleteFolderTarget(null);
            void reload();
          });
        }}
        onCancel={() => setDeleteFolderTarget(null)}
      />

      <ConfirmDialog
        open={deleteProjectTarget != null}
        title="删除项目"
        description={
          deleteProjectTarget
            ? `删除项目「${deleteProjectTarget.title}」？任务将移到收件箱（默认清单）。`
            : undefined
        }
        confirmLabel="删除"
        variant="error"
        onConfirm={() => {
          if (!deleteProjectTarget) return;
          void deleteProjectApi(subjectKind, deleteProjectTarget.id).then(() => {
            if (selectedProjectId === deleteProjectTarget.id) {
              setSelectedProjectId(null);
              closeTaskDetail();
            }
            setDeleteProjectTarget(null);
            void reload();
          });
        }}
        onCancel={() => setDeleteProjectTarget(null)}
      />

      <ConfirmDialog
        open={deleteTaskTarget != null}
        title="删除确认"
        description={
          deleteTaskTarget
            ? `确定删除任务「${deleteTaskTarget.title}」？此操作不可恢复。`
            : undefined
        }
        confirmLabel="删除"
        variant="error"
        onConfirm={() => void confirmDeleteTask()}
        onCancel={() => setDeleteTaskTarget(null)}
      />
    </div>
  );
}
