import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Checkbox, Input } from "@freeanima/ui-kit";
import { EntityIdLabel, ListRow } from "@freeanima/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/ui-kit/composite";
import { useEffect, useMemo, useState, type PointerEvent, type Ref } from "react";

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

const SIDEBAR_SELECTED = "bg-primary/15 font-medium";

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

    return (
      <ListRow
        as="div"
        selected={selected}
        selectedClassName={SIDEBAR_SELECTED}
        dragging={isDragging}
        disabled={writesDisabled}
        useActionSheet={useActionSheet}
        contextMenuEnabled={contextMenuEnabled}
        contextMenuItems={contextMenuItems}
        onOpenMenu={() => onOpenFolderMenu(folder)}
        dragAttributes={attributes}
        dragListeners={listeners}
        rowRef={setNodeRef as Ref<HTMLElement | null>}
        rowStyle={style}
        className={[
          "touch-manipulation gap-0.5 pr-1 text-sm select-none",
          isFolderIntoTarget ? "ring-primary bg-primary/10 ring-2" : "",
        ].join(" ")}
        onDoubleClick={useActionSheet ? undefined : () => onEditFolder(folder)}
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
        }
      >
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
      </ListRow>
    );
  }

  const project = node.project;
  const selected = selectedProjectId === project.id;
  const showBeforeLine = dragging && overProjectId === project.id && projectDropIntent === "before";
  const showAfterLine = dragging && overProjectId === project.id && projectDropIntent === "after";

  return (
    <ListRow
      as="div"
      selected={selected}
      selectedClassName={SIDEBAR_SELECTED}
      dragging={isDragging}
      disabled={writesDisabled}
      useActionSheet={useActionSheet}
      contextMenuEnabled={contextMenuEnabled}
      contextMenuItems={contextMenuItems}
      onOpenMenu={() => onOpenProjectMenu(project)}
      dragAttributes={attributes}
      dragListeners={listeners}
      rowRef={setNodeRef as Ref<HTMLElement | null>}
      rowStyle={style}
      className="touch-manipulation gap-0.5 pr-1 text-sm select-none"
      onDoubleClick={useActionSheet ? undefined : () => onEditProject(project)}
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
      leading={<span className="min-w-6 shrink-0" aria-hidden />}
    >
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
    </ListRow>
  );
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
  return (
    <ListRow
      as="div"
      selected={selected}
      selectedClassName={`${SIDEBAR_SELECTED} opacity-100`}
      disabled={writesDisabled}
      useActionSheet={useActionSheet}
      contextMenuEnabled={contextMenuEnabled}
      contextMenuItems={contextMenuItems}
      onOpenMenu={onOpenMenu}
      className="gap-0.5 pr-1 text-sm opacity-70"
      onDoubleClick={useActionSheet ? undefined : onEdit}
      leading={<span className="min-w-6 shrink-0" aria-hidden />}
    >
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
    </ListRow>
  );
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
                  isSelected={props.showInactive}
                  onChange={(checked) => props.onToggleShowInactive(checked === true)}
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
          <Button
            size="sm"
            isDisabled={props.writesDisabled}
            onClick={() => props.onCreateFolder()}
          >
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
          <Button
            size="sm"
            isDisabled={props.writesDisabled}
            onClick={() => props.onCreateProject()}
          >
            +
          </Button>
        </div>
      </div>
    </div>
  );
}
