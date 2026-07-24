import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Checkbox, Input } from "@freeanima/ui-kit";
import { ContextMenu, EntityIdLabel } from "@freeanima/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/ui-kit/composite";
import { useEffect, useMemo, useState, type ReactElement } from "react";

import type { ProjectFolderRow, ProjectRow } from "../lib/api.ts";
import {
  PROJECT_ROOT_DND_ID,
  projectFolderDndId,
  projectItemDndId,
} from "../lib/project-dnd-ids.ts";
import {
  buildProjectTree,
  flattenVisibleProjectTree,
  readExpandedProjectFolders,
  writeExpandedProjectFolders,
  type ProjectTreeNode,
} from "../lib/project-tree.ts";
import { useProjectDndUi } from "./ProjectDndRoot.tsx";

type ProjectSidebarProps = {
  subjectKind: string;
  folders: ProjectFolderRow[];
  projects: ProjectRow[];
  inactiveProjects: ProjectRow[];
  showInactive: boolean;
  onToggleShowInactive: (show: boolean) => void;
  selectedProjectId: number | null;
  selectedFolderId: number | null;
  newFolderName: string;
  newProjectTitle: string;
  writesDisabled: boolean;
  useActionSheet: boolean;
  contextMenuEnabled?: boolean;
  contextMenuItemsForFolder?: (folder: ProjectFolderRow) => ActionSheetItem[];
  contextMenuItemsForProject?: (project: ProjectRow) => ActionSheetItem[];
  onSelectProject: (id: number) => void;
  onSelectFolder: (id: number) => void;
  onCreateFolder: () => void;
  onCreateProject: () => void;
  onNewFolderNameChange: (value: string) => void;
  onNewProjectTitleChange: (value: string) => void;
  onOpenFolderMenu: (folder: ProjectFolderRow) => void;
  onOpenProjectMenu: (project: ProjectRow) => void;
  onEditFolder: (folder: ProjectFolderRow) => void;
  onEditProject: (project: ProjectRow) => void;
};

function SortableTreeRow({
  node,
  expanded,
  selectedProjectId,
  selectedFolderId,
  useActionSheet,
  contextMenuEnabled,
  contextMenuItems,
  writesDisabled,
  onToggleExpand,
  onSelectProject,
  onSelectFolder,
  onOpenFolderMenu,
  onOpenProjectMenu,
  onEditFolder,
  onEditProject,
}: {
  node: ProjectTreeNode;
  expanded: boolean;
  selectedProjectId: number | null;
  selectedFolderId: number | null;
  useActionSheet: boolean;
  contextMenuEnabled: boolean;
  contextMenuItems?: ActionSheetItem[] | undefined;
  writesDisabled: boolean;
  onToggleExpand: () => void;
  onSelectProject: (id: number) => void;
  onSelectFolder: (id: number) => void;
  onOpenFolderMenu: (folder: ProjectFolderRow) => void;
  onOpenProjectMenu: (project: ProjectRow) => void;
  onEditFolder: (folder: ProjectFolderRow) => void;
  onEditProject: (project: ProjectRow) => void;
}) {
  const {
    dragging,
    overFolderId,
    overProjectId,
    activeFolderId,
    folderDropIntent,
    projectDropIntent,
  } = useProjectDndUi();

  const dndId =
    node.kind === "folder" ? projectFolderDndId(node.folder.id) : projectItemDndId(node.project.id);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dndId,
    disabled: writesDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${8 + node.depth * 16}px`,
  };

  if (node.kind === "folder") {
    const folder = node.folder;
    const selected = selectedFolderId === folder.id;
    const isFolderIntoTarget =
      dragging &&
      overFolderId === folder.id &&
      activeFolderId !== folder.id &&
      folderDropIntent === "into";
    const showBeforeLine = dragging && overFolderId === folder.id && folderDropIntent === "before";
    const showAfterLine = dragging && overFolderId === folder.id && folderDropIntent === "after";

    const row: ReactElement = (
      <div
        ref={setNodeRef}
        style={style}
        className={[
          "group relative flex min-h-11 touch-manipulation items-center gap-0.5 rounded-lg py-1 pr-1 text-sm select-none",
          selected ? "bg-primary/15 font-medium" : "hover:bg-muted",
          isDragging ? "opacity-50" : "",
          isFolderIntoTarget ? "ring-primary bg-primary/10 ring-2" : "",
        ].join(" ")}
        onDoubleClick={useActionSheet ? undefined : () => onEditFolder(folder)}
        {...attributes}
        {...listeners}
      >
        {showBeforeLine ? (
          <div className="bg-primary absolute top-0 right-1 left-1 z-20 h-0.5 rounded-full" />
        ) : null}
        {showAfterLine ? (
          <div className="bg-primary absolute right-1 bottom-0 left-1 z-20 h-0.5 rounded-full" />
        ) : null}
        <button
          type="button"
          className="text-muted-foreground flex min-h-11 min-w-6 shrink-0 items-center justify-center"
          aria-label={expanded ? "折叠" : "展开"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {expanded ? "▼" : "▶"}
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 truncate py-2 text-left"
          onClick={() => onSelectFolder(folder.id)}
        >
          <span className="mr-1 shrink-0" aria-hidden>
            📁
          </span>
          <span className="truncate">{folder.name}</span>
        </button>
        {useActionSheet ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label="操作"
            disabled={writesDisabled}
            onClick={(e) => {
              e.stopPropagation();
              onOpenFolderMenu(folder);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            ⋯
          </Button>
        ) : null}
      </div>
    );

    if (contextMenuEnabled && !useActionSheet && contextMenuItems && contextMenuItems.length > 0) {
      return <ContextMenu items={contextMenuItems}>{row}</ContextMenu>;
    }
    return row;
  }

  const project = node.project;
  const selected = selectedProjectId === project.id;
  const showBeforeLine = dragging && overProjectId === project.id && projectDropIntent === "before";
  const showAfterLine = dragging && overProjectId === project.id && projectDropIntent === "after";

  const row: ReactElement = (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "group relative flex min-h-11 touch-manipulation items-center gap-0.5 rounded-lg py-1 pr-1 text-sm select-none",
        selected ? "bg-primary/15 font-medium" : "hover:bg-muted",
        isDragging ? "opacity-50" : "",
      ].join(" ")}
      onDoubleClick={useActionSheet ? undefined : () => onEditProject(project)}
      {...attributes}
      {...listeners}
    >
      {showBeforeLine ? (
        <div className="bg-primary absolute top-0 right-1 left-1 z-20 h-0.5 rounded-full" />
      ) : null}
      {showAfterLine ? (
        <div className="bg-primary absolute right-1 bottom-0 left-1 z-20 h-0.5 rounded-full" />
      ) : null}
      <span className="min-w-6 shrink-0" aria-hidden />
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-1 truncate py-2 text-left"
        onClick={() => onSelectProject(project.id)}
      >
        <span className="min-w-0 flex-1 truncate">{project.title}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 tabular-nums">
          <EntityIdLabel id={project.id} />
          <span className="text-muted-foreground text-xs">{project.task_count ?? 0}</span>
        </span>
      </button>
      {useActionSheet ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="操作"
          disabled={writesDisabled}
          onClick={(e) => {
            e.stopPropagation();
            onOpenProjectMenu(project);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          ⋯
        </Button>
      ) : null}
    </div>
  );

  if (contextMenuEnabled && !useActionSheet && contextMenuItems && contextMenuItems.length > 0) {
    return <ContextMenu items={contextMenuItems}>{row}</ContextMenu>;
  }
  return row;
}

function InactiveProjectRow({
  project,
  selected,
  useActionSheet,
  contextMenuEnabled,
  contextMenuItems,
  writesDisabled,
  onSelect,
  onOpenMenu,
  onEdit,
}: {
  project: ProjectRow;
  selected: boolean;
  useActionSheet: boolean;
  contextMenuEnabled: boolean;
  contextMenuItems?: ActionSheetItem[] | undefined;
  writesDisabled: boolean;
  onSelect: () => void;
  onOpenMenu: () => void;
  onEdit: () => void;
}) {
  const row: ReactElement = (
    <div
      className={[
        "group flex min-h-11 items-center gap-0.5 rounded-lg py-1 pr-1 text-sm opacity-70",
        selected ? "bg-primary/15 font-medium opacity-100" : "hover:bg-muted",
      ].join(" ")}
      onDoubleClick={useActionSheet ? undefined : onEdit}
    >
      <span className="min-w-6 shrink-0" aria-hidden />
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-1 truncate py-2 text-left"
        onClick={onSelect}
      >
        <span className="min-w-0 flex-1 truncate">{project.title}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 tabular-nums">
          <EntityIdLabel id={project.id} />
          <span className="text-muted-foreground text-xs">{project.status}</span>
          <span className="text-muted-foreground text-xs">{project.task_count ?? 0}</span>
        </span>
      </button>
      {useActionSheet ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="操作"
          disabled={writesDisabled}
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

  if (contextMenuEnabled && !useActionSheet && contextMenuItems && contextMenuItems.length > 0) {
    return <ContextMenu items={contextMenuItems}>{row}</ContextMenu>;
  }
  return row;
}

export function ProjectSidebar(props: ProjectSidebarProps) {
  const { dragging, overRoot } = useProjectDndUi();
  const { setNodeRef: setProjectRootRef } = useDroppable({ id: PROJECT_ROOT_DND_ID });
  const [expandedFolderIds, setExpandedFolderIds] = useState(() =>
    readExpandedProjectFolders(props.subjectKind),
  );
  const contextMenuEnabled = props.contextMenuEnabled === true;

  useEffect(() => {
    setExpandedFolderIds(readExpandedProjectFolders(props.subjectKind));
  }, [props.subjectKind]);

  const tree = useMemo(
    () => buildProjectTree(props.folders, props.projects),
    [props.folders, props.projects],
  );
  const visibleNodes = useMemo(
    () => flattenVisibleProjectTree(tree, expandedFolderIds),
    [tree, expandedFolderIds],
  );

  const sortableIds = useMemo(
    () =>
      visibleNodes.map((node) =>
        node.kind === "folder"
          ? projectFolderDndId(node.folder.id)
          : projectItemDndId(node.project.id),
      ),
    [visibleNodes],
  );

  const toggleExpand = (folderId: number) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      writeExpandedProjectFolders(props.subjectKind, next);
      return next;
    });
  };

  const isRootDropTarget = dragging && overRoot;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div
            ref={setProjectRootRef}
            className={[
              "sticky top-0 z-10 mb-1 flex h-8 items-center rounded-md border border-transparent px-2 text-xs font-medium",
              dragging && !isRootDropTarget
                ? "text-muted-foreground/80 border-muted-foreground/30 border-dashed"
                : "text-muted-foreground",
              isRootDropTarget
                ? "ring-primary bg-primary/15 border-primary text-foreground border-dashed ring-2"
                : "",
            ].join(" ")}
          >
            {isRootDropTarget ? "移到顶级" : dragging ? "项目（拖到此处移到顶级）" : "项目"}
          </div>
          {visibleNodes.map((node) => {
            const contextMenuItems =
              node.kind === "folder"
                ? props.contextMenuItemsForFolder?.(node.folder)
                : props.contextMenuItemsForProject?.(node.project);
            return (
              <SortableTreeRow
                key={node.kind === "folder" ? `f-${node.folder.id}` : `p-${node.project.id}`}
                node={node}
                expanded={node.kind === "folder" ? expandedFolderIds.has(node.folder.id) : false}
                selectedProjectId={props.selectedProjectId}
                selectedFolderId={props.selectedFolderId}
                useActionSheet={props.useActionSheet}
                contextMenuEnabled={contextMenuEnabled}
                {...(contextMenuItems ? { contextMenuItems } : {})}
                writesDisabled={props.writesDisabled}
                onToggleExpand={() => {
                  if (node.kind === "folder") toggleExpand(node.folder.id);
                }}
                onSelectProject={props.onSelectProject}
                onSelectFolder={props.onSelectFolder}
                onOpenFolderMenu={props.onOpenFolderMenu}
                onOpenProjectMenu={props.onOpenProjectMenu}
                onEditFolder={props.onEditFolder}
                onEditProject={props.onEditProject}
              />
            );
          })}
          {props.inactiveProjects.length > 0 ? (
            <div className="border/60 mt-2 space-y-1 border-t pt-2">
              <label className="text-muted-foreground flex cursor-pointer select-none items-center gap-2 px-1 py-1 text-xs">
                <Checkbox
                  className="size-3.5"
                  checked={props.showInactive}
                  onCheckedChange={(checked) => props.onToggleShowInactive(checked === true)}
                />
                显示非活跃
              </label>
              {props.showInactive
                ? props.inactiveProjects.map((project) => {
                    const contextMenuItems = props.contextMenuItemsForProject?.(project);
                    return (
                      <InactiveProjectRow
                        key={project.id}
                        project={project}
                        selected={props.selectedProjectId === project.id}
                        useActionSheet={props.useActionSheet}
                        contextMenuEnabled={contextMenuEnabled}
                        {...(contextMenuItems ? { contextMenuItems } : {})}
                        writesDisabled={props.writesDisabled}
                        onSelect={() => props.onSelectProject(project.id)}
                        onOpenMenu={() => props.onOpenProjectMenu(project)}
                        onEdit={() => props.onEditProject(project)}
                      />
                    );
                  })
                : null}
            </div>
          ) : null}
        </SortableContext>
      </div>
      <div className="shrink-0 space-y-2 border-t border-base-300 pt-2">
        <div className="flex gap-1">
          <Input
            value={props.newFolderName}
            onChange={(e) => props.onNewFolderNameChange(e.target.value)}
            placeholder="新建文件夹"
            disabled={props.writesDisabled}
            onKeyDown={(e) => {
              if (e.key === "Enter") props.onCreateFolder();
            }}
          />
          <Button size="sm" disabled={props.writesDisabled} onClick={() => props.onCreateFolder()}>
            +
          </Button>
        </div>
        <div className="flex gap-1">
          <Input
            value={props.newProjectTitle}
            onChange={(e) => props.onNewProjectTitleChange(e.target.value)}
            placeholder="新建项目"
            disabled={props.writesDisabled}
            onKeyDown={(e) => {
              if (e.key === "Enter") props.onCreateProject();
            }}
          />
          <Button size="sm" disabled={props.writesDisabled} onClick={() => props.onCreateProject()}>
            +
          </Button>
        </div>
      </div>
    </div>
  );
}
