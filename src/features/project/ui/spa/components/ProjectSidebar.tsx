import { Button, Input } from "@freeanima/frontend/ui-kit";
import { useEffect, useMemo, useState, type MouseEvent, type RefObject } from "react";

import type { ProjectFolderRow, ProjectRow } from "../lib/api.ts";
import {
  buildProjectTree,
  flattenVisibleProjectTree,
  readExpandedProjectFolders,
  writeExpandedProjectFolders,
  type ProjectTreeNode,
} from "../lib/project-tree.ts";

type ProjectSidebarProps = {
  subjectKind: string;
  folders: ProjectFolderRow[];
  projects: ProjectRow[];
  selectedProjectId: number | null;
  selectedFolderId: number | null;
  editingFolderId: number | null;
  editingFolderName: string;
  newFolderName: string;
  newProjectTitle: string;
  writesDisabled: boolean;
  useActionSheet: boolean;
  renameInputRef: RefObject<HTMLInputElement | null>;
  onSelectProject: (id: number) => void;
  onSelectFolder: (id: number) => void;
  onCreateFolder: () => void;
  onCreateProject: () => void;
  onNewFolderNameChange: (value: string) => void;
  onNewProjectTitleChange: (value: string) => void;
  onEditingFolderNameChange: (value: string) => void;
  onCommitFolderRename: () => void;
  onCancelFolderRename: () => void;
  onOpenFolderMenu: (folder: ProjectFolderRow) => void;
  onOpenProjectMenu: (project: ProjectRow) => void;
  onFolderContextMenu: (e: MouseEvent, folder: ProjectFolderRow) => void;
  onProjectContextMenu: (e: MouseEvent, project: ProjectRow) => void;
};

function TreeRow({
  node,
  expanded,
  selectedProjectId,
  selectedFolderId,
  editingFolderId,
  editingFolderName,
  renameInputRef,
  useActionSheet,
  writesDisabled,
  onToggleExpand,
  onSelectProject,
  onSelectFolder,
  onEditingFolderNameChange,
  onCommitFolderRename,
  onCancelFolderRename,
  onOpenFolderMenu,
  onOpenProjectMenu,
  onFolderContextMenu,
  onProjectContextMenu,
}: {
  node: ProjectTreeNode;
  expanded: boolean;
  selectedProjectId: number | null;
  selectedFolderId: number | null;
  editingFolderId: number | null;
  editingFolderName: string;
  renameInputRef: RefObject<HTMLInputElement | null>;
  useActionSheet: boolean;
  writesDisabled: boolean;
  onToggleExpand: () => void;
  onSelectProject: (id: number) => void;
  onSelectFolder: (id: number) => void;
  onEditingFolderNameChange: (value: string) => void;
  onCommitFolderRename: () => void;
  onCancelFolderRename: () => void;
  onOpenFolderMenu: (folder: ProjectFolderRow) => void;
  onOpenProjectMenu: (project: ProjectRow) => void;
  onFolderContextMenu: (e: MouseEvent, folder: ProjectFolderRow) => void;
  onProjectContextMenu: (e: MouseEvent, project: ProjectRow) => void;
}) {
  const depth = node.depth;
  const pad = `${8 + depth * 16}px`;

  if (node.kind === "folder") {
    const folder = node.folder;
    const selected = selectedFolderId === folder.id;
    const editing = editingFolderId === folder.id;
    return (
      <div
        style={{ paddingLeft: pad }}
        className={[
          "group flex min-h-11 items-center gap-0.5 rounded-lg py-1 pr-1 text-sm",
          selected ? "bg-primary/15 font-medium" : "hover:bg-muted",
        ].join(" ")}
        onContextMenu={(e) => onFolderContextMenu(e, folder)}
      >
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
        {editing ? (
          <Input
            ref={renameInputRef}
            className="h-7 min-w-0 flex-1 px-2 text-xs"
            value={editingFolderName}
            disabled={writesDisabled}
            onChange={(e) => onEditingFolderNameChange(e.target.value)}
            onBlur={() => onCommitFolderRename()}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitFolderRename();
              if (e.key === "Escape") onCancelFolderRename();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
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
        )}
        {useActionSheet && !editing ? (
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
          >
            ⋯
          </Button>
        ) : null}
      </div>
    );
  }

  const project = node.project;
  const selected = selectedProjectId === project.id;
  return (
    <div
      style={{ paddingLeft: pad }}
      className={[
        "group flex min-h-11 items-center gap-0.5 rounded-lg py-1 pr-1 text-sm",
        selected ? "bg-primary/15 font-medium" : "hover:bg-muted",
      ].join(" ")}
      onContextMenu={(e) => onProjectContextMenu(e, project)}
    >
      <span className="min-w-6 shrink-0" aria-hidden />
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-1 truncate py-2 text-left"
        onClick={() => onSelectProject(project.id)}
      >
        <span className="truncate">{project.title}</span>
        <span className="text-muted-foreground shrink-0 text-xs">{project.task_count}</span>
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
        >
          ⋯
        </Button>
      ) : null}
    </div>
  );
}

export function ProjectSidebar(props: ProjectSidebarProps) {
  const [expandedFolderIds, setExpandedFolderIds] = useState(() =>
    readExpandedProjectFolders(props.subjectKind),
  );

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

  const toggleExpand = (folderId: number) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      writeExpandedProjectFolders(props.subjectKind, next);
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {visibleNodes.map((node) => (
          <TreeRow
            key={node.kind === "folder" ? `f-${node.folder.id}` : `p-${node.project.id}`}
            node={node}
            expanded={node.kind === "folder" ? expandedFolderIds.has(node.folder.id) : false}
            selectedProjectId={props.selectedProjectId}
            selectedFolderId={props.selectedFolderId}
            editingFolderId={props.editingFolderId}
            editingFolderName={props.editingFolderName}
            renameInputRef={props.renameInputRef}
            useActionSheet={props.useActionSheet}
            writesDisabled={props.writesDisabled}
            onToggleExpand={() => {
              if (node.kind === "folder") toggleExpand(node.folder.id);
            }}
            onSelectProject={props.onSelectProject}
            onSelectFolder={props.onSelectFolder}
            onEditingFolderNameChange={props.onEditingFolderNameChange}
            onCommitFolderRename={props.onCommitFolderRename}
            onCancelFolderRename={props.onCancelFolderRename}
            onOpenFolderMenu={props.onOpenFolderMenu}
            onOpenProjectMenu={props.onOpenProjectMenu}
            onFolderContextMenu={props.onFolderContextMenu}
            onProjectContextMenu={props.onProjectContextMenu}
          />
        ))}
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
