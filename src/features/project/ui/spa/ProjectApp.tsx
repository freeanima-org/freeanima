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
  ContextMenu,
  ModuleScopeBar,
  QuickAddBar,
  useDetailPanelState,
} from "@freeanima/frontend/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/frontend/ui-kit/composite";
import { DatePickerInput } from "@freeanima/frontend/ui-kit/form/DatePickerInput.tsx";
import { FormFieldLabel } from "@freeanima/frontend/ui-kit/form/FormFieldset.tsx";
import {
  ThreeColumnLayout,
  useDrawerNav,
  useThreeColumnLayoutMode,
} from "@freeanima/frontend/ui-kit/layout";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";

import { registerProjectOfflineModule } from "./lib/offline-store.ts";

import { MilestoneDialog } from "./components/MilestoneDialog.tsx";
import { MoveToListPicker } from "@freeanima/frontend/ui-kit/composite";
import { MoveToProjectPicker } from "./components/MoveToProjectPicker.tsx";
import {
  ProjectEditorDialog,
  type ProjectEditorTarget,
} from "./components/ProjectEditorDialog.tsx";
import { ProjectDetailHeader } from "./components/ProjectDetailHeader.tsx";
import { ProjectDndRoot } from "./components/ProjectDndRoot.tsx";
import { ProjectSidebar } from "./components/ProjectSidebar.tsx";
import { ProjectTaskDetailPanel } from "./components/ProjectTaskDetailPanel.tsx";
import { ProjectTaskList } from "./components/ProjectTaskList.tsx";
import type { ProjectDragEndAction } from "./lib/resolve-project-drag-end.ts";
import { sortOrderUpdates } from "./lib/reorder.ts";
import {
  completeProjectTask,
  createMilestoneApi,
  createProjectApi,
  createProjectFolderApi,
  createProjectTask,
  deleteProjectApi,
  deleteProjectFolderApi,
  deleteProjectTask,
  fetchMilestones,
  fetchProjectFolders,
  fetchProjectTasks,
  fetchProjects,
  fetchProjectsForMove,
  fetchTaskListsForMove,
  moveTaskToProject,
  moveProjectTaskToList,
  patchMilestoneApi,
  patchProjectApi,
  patchProjectFolderApi,
  uncompleteProjectTask,
  updateProjectTask,
  type MilestoneRow,
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
import { folderIdForNewProject } from "./lib/project-tree.ts";
import { dateLocalToIso, todayDateLocalValue } from "./lib/format-task.ts";
import {
  useActionSheetCapability,
  useContextMenuCapability,
} from "@freeanima/frontend/shell-sdk/react.tsx";
import { cloneTaskItem, isTaskItemDirty, isTaskItemEqual } from "./lib/task-detail-dirty.ts";

type MenuState =
  | { kind: "folder"; x: number; y: number; folder: ProjectFolderRow }
  | { kind: "project"; x: number; y: number; project: ProjectRow }
  | { kind: "task"; x: number; y: number; item: TaskItemRow };

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
  const [error, setError] = useState("");

  const [folders, setFolders] = useState<ProjectFolderRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [tasks, setTasks] = useState<TaskItemRow[]>([]);
  const [selectionSubjectKind, setSelectionSubjectKind] = useState(subjectKind);

  // subject 切换时在 render 阶段清空选中，避免详情 effect 用旧 ID 打到新 world
  if (selectionSubjectKind !== subjectKind) {
    setSelectionSubjectKind(subjectKind);
    setSelectedFolderId(null);
    setSelectedProjectId(null);
    setMilestones([]);
    setTasks([]);
  }

  const [newFolderName, setNewFolderName] = useState("");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createProjectStart, setCreateProjectStart] = useState("");
  const [createProjectEnd, setCreateProjectEnd] = useState("");
  const [createProjectCriteria, setCreateProjectCriteria] = useState("");
  const [quickTaskTitle, setQuickTaskTitle] = useState("");

  const [editorTarget, setEditorTarget] = useState<ProjectEditorTarget | null>(null);
  const [childFolderParentId, setChildFolderParentId] = useState<number | null>(null);
  const [childFolderName, setChildFolderName] = useState("");

  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDue, setNewMilestoneDue] = useState("");

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
        tags: snapshot.tags,
        priority: snapshot.priority,
        due_at: snapshot.due_at,
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

      setMilestones((prev) => {
        let changed = false;
        const next = prev.map((row) => {
          if (row.id !== tempId && row.project_id !== tempId) return row;
          changed = true;
          return {
            ...row,
            id: remapId(row.id),
            project_id: row.project_id === tempId ? serverId : row.project_id,
          };
        });
        return changed ? next : prev;
      });

      setTasks((prev) => {
        let changed = false;
        const next = prev.map((row) => {
          if (row.id !== tempId && row.project_id !== tempId && row.milestone_id !== tempId) {
            return row;
          }
          changed = true;
          return {
            ...row,
            id: remapId(row.id),
            project_id: row.project_id === tempId ? serverId : row.project_id,
            milestone_id: row.milestone_id === tempId ? serverId : row.milestone_id,
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
        if (prev.id !== tempId && prev.project_id !== tempId && prev.milestone_id !== tempId) {
          return prev;
        }
        return {
          ...prev,
          id: remapId(prev.id),
          project_id: prev.project_id === tempId ? serverId : prev.project_id,
          milestone_id: prev.milestone_id === tempId ? serverId : prev.milestone_id,
        };
      });
    });
  }, [setDetailItem, subjectKind]);

  const [contextMenu, setContextMenu] = useState<MenuState | null>(null);
  const [sheetItems, setSheetItems] = useState<ActionSheetItem[] | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<ProjectFolderRow | null>(null);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<ProjectRow | null>(null);
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

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [folderRows, projectRows] = await Promise.all([
        fetchProjectFolders(subjectKind),
        fetchProjects(subjectKind),
      ]);
      setFolders(folderRows);
      setProjects(projectRows);

      const stored = readModuleSelection("project", { subjectKind });
      const active = projectRows.filter((p) => p.status === "active");
      const pickId =
        stored != null && projectRows.some((p) => p.id === stored)
          ? stored
          : (active[0]?.id ?? projectRows[0]?.id ?? null);
      setSelectedProjectId((prev) => {
        if (prev != null && projectRows.some((p) => p.id === prev)) return prev;
        return pickId;
      });
      if (pickId != null && projectRows.some((p) => p.id === pickId && p.status !== "active")) {
        setShowInactive(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [subjectKind]);

  const reloadProjectDetail = useCallback(async () => {
    if (selectedProjectId == null) {
      setMilestones([]);
      setTasks([]);
      return;
    }
    try {
      const [ms, ts] = await Promise.all([
        fetchMilestones(subjectKind, selectedProjectId),
        fetchProjectTasks(subjectKind, selectedProjectId),
      ]);
      setMilestones(ms);
      setTasks(ts);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [selectedProjectId, subjectKind]);

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
    const start_at = dateLocalToIso(createProjectStart);
    const end_at = dateLocalToIso(createProjectEnd);
    const completion_criteria = createProjectCriteria.trim();
    if (!title || !start_at || !end_at || !completion_criteria) return;
    const folder_id = folderIdForNewProject(selectedProjectId, selectedFolderId, projects);
    const item = await createProjectApi(subjectKind, {
      title,
      start_at,
      end_at,
      completion_criteria,
      folder_id,
    });
    setNewProjectTitle("");
    setCreateProjectStart("");
    setCreateProjectEnd("");
    setCreateProjectCriteria("");
    setCreateProjectOpen(false);
    setSelectedProjectId(item.id);
    writeModuleSelection("project", item.id, { subjectKind });
    await reload();
  };

  const promptCreateProject = () => {
    const title = newProjectTitle.trim();
    if (!title) return;
    setCreateProjectStart(todayDateLocalValue());
    setCreateProjectOpen(true);
  };

  const handleProjectDatesChange = async (startLocal: string, endLocal: string) => {
    if (selectedProjectId == null) return;
    const start_at = dateLocalToIso(startLocal);
    const end_at = dateLocalToIso(endLocal);
    if (!start_at || !end_at) return;
    await patchProjectApi(subjectKind, selectedProjectId, { start_at, end_at });
    await reload();
  };

  const handleQuickAddTask = async () => {
    if (selectedProjectId == null) return;
    const title = quickTaskTitle.trim();
    if (!title) return;
    const pending = tasks.filter((t) => t.status === "pending");
    await createProjectTask(subjectKind, {
      title,
      project_id: selectedProjectId,
      sort_order: pending.length,
    });
    setQuickTaskTitle("");
    await reloadProjectDetail();
    await reload();
  };

  const persistProjectTaskOrder = async (orderedPending: TaskItemRow[]) => {
    const completed = tasks.filter((t) => t.status === "completed");
    const merged = [...orderedPending, ...completed];
    setTasks(merged.map((item, index) => ({ ...item, sort_order: index })));
    const updates = sortOrderUpdates(orderedPending);
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

  const handleDeleteTask = async (item: TaskItemRow) => {
    await deleteProjectTask(subjectKind, item.id);
    setTasks((prev) => prev.filter((t) => t.id !== item.id));
    if (detailItem?.id === item.id) closeTaskDetail();
    await reload();
  };

  const openMoveToListPicker = useCallback(
    async (item: TaskItemRow) => {
      setContextMenu(null);
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
      setContextMenu(null);
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
        onDelete: () => void handleDeleteTask(item),
      };
      if (item.status === "pending") {
        handlers.onStartPomodoro = () => launchPomodoroForTask({ id: item.id, title: item.title });
      }
      return buildProjectTaskMenuItems(item, handlers);
    },
    [openMoveToListPicker, openMoveToProjectPicker, openTaskDetail],
  );

  const handleProjectStatus = async (status: ProjectRow["status"]) => {
    if (selectedProjectId == null) return;
    await patchProjectApi(subjectKind, selectedProjectId, { status });
    await reload();
    await reloadProjectDetail();
  };

  const openFolderEditor = (folder: ProjectFolderRow) => {
    setEditorTarget({ kind: "folder", folder });
  };

  const openProjectEditor = (project: ProjectRow) => {
    setEditorTarget({ kind: "project", project });
  };

  const saveEditor = async (input: { name: string; folderId: number | null }) => {
    if (editorTarget == null) return;
    if (editorTarget.kind === "folder") {
      await patchProjectFolderApi(subjectKind, editorTarget.folder.id, {
        name: input.name,
        parent_id: input.folderId,
      });
    } else {
      await patchProjectApi(subjectKind, editorTarget.project.id, {
        title: input.name,
        folder_id: input.folderId,
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
        const ordered = action.ordered.map((row, index) => ({
          ...row,
          parent_id: action.parentId,
          sort_order: index,
        }));
        setFolders((prev) => {
          const ids = new Set(ordered.map((f) => f.id));
          const others = prev.filter((f) => !ids.has(f.id));
          return [...others, ...ordered];
        });
        if (action.type === "placeFolder") {
          await patchProjectFolderApi(subjectKind, action.folderId, {
            parent_id: action.parentId,
            sort_order: ordered.findIndex((f) => f.id === action.folderId),
          });
        }
        const updates = sortOrderUpdates(ordered);
        await Promise.all(
          updates.map((u) =>
            patchProjectFolderApi(subjectKind, u.id, { sort_order: u.sort_order }),
          ),
        );
      } else if (action.type === "moveProject") {
        setProjects((prev) =>
          prev.map((p) => (p.id === action.projectId ? { ...p, folder_id: action.folderId } : p)),
        );
        await patchProjectApi(subjectKind, action.projectId, { folder_id: action.folderId });
      } else if (action.type === "reorderProjects" || action.type === "placeProject") {
        const ordered = action.ordered.map((row, index) => ({
          ...row,
          folder_id: action.folderId,
          sort_order: index,
        }));
        setProjects((prev) => {
          const ids = new Set(ordered.map((p) => p.id));
          const others = prev.filter((p) => !ids.has(p.id));
          return [...others, ...ordered];
        });
        if (action.type === "placeProject") {
          await patchProjectApi(subjectKind, action.projectId, {
            folder_id: action.folderId,
            sort_order: ordered.findIndex((p) => p.id === action.projectId),
          });
        }
        const updates = sortOrderUpdates(ordered);
        await Promise.all(
          updates.map((u) => patchProjectApi(subjectKind, u.id, { sort_order: u.sort_order })),
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
        }),
      ),
    );
  };

  const openTaskMenuSheet = (item: TaskItemRow) => {
    setContextMenu(null);
    setSheetItems(menuToSheet(buildTaskMenuForItem(item)));
  };

  const openContextMenuAt = (e: MouseEvent, state: MenuState) => {
    if (useActionSheet) return;
    if (!contextMenuEnabled) return;
    e.preventDefault();
    e.stopPropagation();
    setSheetItems(null);
    setContextMenu({ ...state, x: e.clientX, y: e.clientY });
  };

  const contextMenuItems: ActionSheetItem[] = useMemo(() => {
    if (!contextMenu) return [];
    if (contextMenu.kind === "folder") {
      return menuToSheet(
        buildFolderMenuItems(contextMenu.folder, {
          onEdit: openFolderEditor,
          onCreateChildFolder: (f) => setChildFolderParentId(f.id),
          onDelete: (f) => setDeleteFolderTarget(f),
        }),
      );
    }
    if (contextMenu.kind === "project") {
      return menuToSheet(
        buildProjectMenuItems(contextMenu.project, {
          onEdit: openProjectEditor,
          onDelete: (p) => setDeleteProjectTarget(p),
        }),
      );
    }
    return menuToSheet(buildTaskMenuForItem(contextMenu.item));
  }, [buildTaskMenuForItem, contextMenu]);

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
          detailTitle={detailItem?.title ?? "任务详情"}
          listOpen={listOpen}
          onListOpenChange={setListOpen}
          listToggleAriaLabel="打开项目树"
          detailOpen={detailOpen}
          onDetailOpenChange={handleDetailOpenChange}
          middleActions={
            selectedProject ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={writesDisabled}
                  onClick={() => setMilestoneOpen(true)}
                >
                  里程碑 ({selectedProject.milestone_count})
                </Button>
                {selectedProject.status === "active" ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={writesDisabled}
                      onClick={() => void handleProjectStatus("on_hold")}
                    >
                      搁置
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={writesDisabled}
                      onClick={() => void handleProjectStatus("completed")}
                    >
                      完成
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={writesDisabled}
                      onClick={() => void handleProjectStatus("cancelled")}
                    >
                      取消
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={writesDisabled}
                    onClick={() => void handleProjectStatus("active")}
                  >
                    重新激活
                  </Button>
                )}
              </>
            ) : null
          }
          middleHeaderExtra={
            selectedProject ? (
              <ProjectDetailHeader
                project={selectedProject}
                writesDisabled={writesDisabled}
                onDatesChange={(startLocal, endLocal) =>
                  void handleProjectDatesChange(startLocal, endLocal)
                }
              />
            ) : null
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
                  onFolderContextMenu={(e, folder) =>
                    openContextMenuAt(e, { kind: "folder", folder, x: 0, y: 0 })
                  }
                  onProjectContextMenu={(e, project) =>
                    openContextMenuAt(e, { kind: "project", project, x: 0, y: 0 })
                  }
                  onEditFolder={openFolderEditor}
                  onEditProject={openProjectEditor}
                />
              </ProjectDndRoot>
            </div>
          }
          middle={
            selectedProject ? (
              <div className="flex h-full min-h-0 flex-col">
                <ProjectTaskList
                  items={tasks}
                  activeItemId={detailItem?.id ?? null}
                  useActionSheet={useActionSheet}
                  disabled={writesDisabled}
                  writesDisabled={writesDisabled}
                  onToggleComplete={(item) => void handleToggleComplete(item)}
                  onEdit={openTaskDetail}
                  onOpenItemMenu={openTaskMenuSheet}
                  onOpenItemContextMenu={(e, item) =>
                    openContextMenuAt(e, { kind: "task", item, x: 0, y: 0 })
                  }
                  onReorderPending={(ordered) => void persistProjectTaskOrder(ordered)}
                />
                <QuickAddBar
                  value={quickTaskTitle}
                  onChange={setQuickTaskTitle}
                  disabled={writesDisabled}
                  onSubmit={() => void handleQuickAddTask()}
                />
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
                onCancel={() => closeTaskDetail({ discard: true })}
                saveStatus={detailSaveStatus}
              />
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center p-8 text-sm">
                选择任务查看详情
              </div>
            )
          }
        />
      )}

      {contextMenu ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      ) : null}

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

      <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
        <DialogContent className="max-w-sm safe-area-pt safe-area-pb">
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div>
              <FormFieldLabel>项目名称</FormFieldLabel>
              <Input
                value={newProjectTitle}
                onChange={(e) => setNewProjectTitle(e.target.value)}
                placeholder="项目名称"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <FormFieldLabel>开始日期</FormFieldLabel>
                <DatePickerInput
                  value={createProjectStart}
                  aria-label="开始日期"
                  onChange={setCreateProjectStart}
                />
              </div>
              <div>
                <FormFieldLabel>结束日期</FormFieldLabel>
                <DatePickerInput
                  value={createProjectEnd}
                  aria-label="结束日期"
                  onChange={setCreateProjectEnd}
                />
              </div>
            </div>
            <div>
              <FormFieldLabel>完成标准</FormFieldLabel>
              <Input
                value={createProjectCriteria}
                onChange={(e) => setCreateProjectCriteria(e.target.value)}
                placeholder="完成标准"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateProjectOpen(false)}>
              取消
            </Button>
            <Button
              disabled={
                writesDisabled ||
                !newProjectTitle.trim() ||
                !createProjectStart ||
                !createProjectEnd ||
                !createProjectCriteria.trim()
              }
              onClick={() => void handleCreateProject()}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <MilestoneDialog
        open={milestoneOpen}
        onOpenChange={setMilestoneOpen}
        milestones={milestones}
        newTitle={newMilestoneTitle}
        newDue={newMilestoneDue}
        writesDisabled={writesDisabled}
        onNewTitleChange={setNewMilestoneTitle}
        onNewDueChange={setNewMilestoneDue}
        onCreate={() => {
          if (selectedProjectId == null) return;
          const title = newMilestoneTitle.trim();
          const due_at = dateLocalToIso(newMilestoneDue);
          if (!title || !due_at) return;
          void createMilestoneApi(subjectKind, {
            project_id: selectedProjectId,
            title,
            due_at,
          }).then(() => {
            setNewMilestoneTitle("");
            setNewMilestoneDue("");
            void reloadProjectDetail();
            void reload();
          });
        }}
        onStatusChange={(id, status) => {
          void patchMilestoneApi(subjectKind, id, { status }).then(() => {
            void reloadProjectDetail();
            void reload();
          });
        }}
      />

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
    </div>
  );
}
