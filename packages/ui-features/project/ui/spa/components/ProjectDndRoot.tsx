import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  useDndMonitor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import type { ProjectFolderRow, ProjectRow } from "../lib/api.ts";
import { createProjectTreeCollisionDetection } from "../lib/project-dnd-collision.ts";
import {
  isProjectItemDndId,
  isProjectRootDndId,
  isProjectTreeDndId,
  parseProjectFolderDndId,
  parseProjectItemDndId,
} from "../lib/project-dnd-ids.ts";
import {
  resolveFolderDropIntent,
  resolveProjectDragEnd,
  resolveProjectRowDropIntent,
  type FolderDropIntent,
  type ProjectDragEndAction,
} from "../lib/resolve-project-drag-end.ts";

type ProjectDndRootProps = {
  folders: ProjectFolderRow[];
  projects: ProjectRow[];
  children: ReactNode;
  onAction: (action: Exclude<ProjectDragEndAction, { type: "noop" }>) => void;
};

type ProjectDndUiState = {
  dragging: boolean;
  overFolderId: number | null;
  overProjectId: number | null;
  activeFolderId: number | null;
  activeProjectId: number | null;
  overRoot: boolean;
  folderDropIntent: FolderDropIntent | null;
  projectDropIntent: "before" | "after" | null;
};

const ProjectDndUiContext = createContext<ProjectDndUiState>({
  dragging: false,
  overFolderId: null,
  overProjectId: null,
  activeFolderId: null,
  activeProjectId: null,
  overRoot: false,
  folderDropIntent: null,
  projectDropIntent: null,
});

export function useProjectDndUi(): ProjectDndUiState {
  return useContext(ProjectDndUiContext);
}

function DragMonitor({
  folders,
  onDraggingChange,
  onOverFolderChange,
  onOverProjectChange,
  onActiveFolderChange,
  onActiveProjectChange,
  onOverRootChange,
  onFolderDropIntentChange,
  onProjectDropIntentChange,
  pointerYRef,
}: {
  folders: ProjectFolderRow[];
  onDraggingChange: (dragging: boolean) => void;
  onOverFolderChange: (id: number | null) => void;
  onOverProjectChange: (id: number | null) => void;
  onActiveFolderChange: (id: number | null) => void;
  onActiveProjectChange: (id: number | null) => void;
  onOverRootChange: (over: boolean) => void;
  onFolderDropIntentChange: (intent: FolderDropIntent | null) => void;
  onProjectDropIntentChange: (intent: "before" | "after" | null) => void;
  pointerYRef: React.MutableRefObject<number | null>;
}) {
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);

  useDndMonitor({
    onDragStart(event) {
      const isTree = isProjectTreeDndId(event.active.id);
      onDraggingChange(isTree);
      onActiveFolderChange(parseProjectFolderDndId(event.active.id));
      onActiveProjectChange(parseProjectItemDndId(event.active.id));
      onFolderDropIntentChange(null);
      onProjectDropIntentChange(null);
    },
    onDragMove(event) {
      if (!event.over || !isProjectTreeDndId(event.active.id) || pointerYRef.current == null) {
        return;
      }
      const overFolderId = parseProjectFolderDndId(event.over.id);
      if (overFolderId != null && folderById.has(overFolderId)) {
        onFolderDropIntentChange(
          resolveFolderDropIntent(
            { top: event.over.rect.top, height: event.over.rect.height },
            pointerYRef.current,
          ),
        );
        onProjectDropIntentChange(null);
        return;
      }
      if (parseProjectItemDndId(event.over.id) != null && isProjectItemDndId(event.active.id)) {
        onProjectDropIntentChange(
          resolveProjectRowDropIntent(
            { top: event.over.rect.top, height: event.over.rect.height },
            pointerYRef.current,
          ),
        );
        onFolderDropIntentChange(null);
        return;
      }
      onFolderDropIntentChange(null);
      onProjectDropIntentChange(null);
    },
    onDragOver(event) {
      if (!event.over) {
        onOverFolderChange(null);
        onOverProjectChange(null);
        onOverRootChange(false);
        onFolderDropIntentChange(null);
        onProjectDropIntentChange(null);
        return;
      }
      onOverRootChange(isProjectRootDndId(event.over.id));
      onOverFolderChange(parseProjectFolderDndId(event.over.id));
      onOverProjectChange(parseProjectItemDndId(event.over.id));
      if (isProjectTreeDndId(event.active.id) && pointerYRef.current != null) {
        const overFolderId = parseProjectFolderDndId(event.over.id);
        if (overFolderId != null && folderById.has(overFolderId)) {
          onFolderDropIntentChange(
            resolveFolderDropIntent(
              { top: event.over.rect.top, height: event.over.rect.height },
              pointerYRef.current,
            ),
          );
          onProjectDropIntentChange(null);
          return;
        }
        if (parseProjectItemDndId(event.over.id) != null && isProjectItemDndId(event.active.id)) {
          onProjectDropIntentChange(
            resolveProjectRowDropIntent(
              { top: event.over.rect.top, height: event.over.rect.height },
              pointerYRef.current,
            ),
          );
          onFolderDropIntentChange(null);
          return;
        }
      }
      onFolderDropIntentChange(null);
      onProjectDropIntentChange(null);
    },
    onDragEnd() {
      onDraggingChange(false);
      onOverFolderChange(null);
      onOverProjectChange(null);
      onActiveFolderChange(null);
      onActiveProjectChange(null);
      onOverRootChange(false);
      onFolderDropIntentChange(null);
      onProjectDropIntentChange(null);
    },
    onDragCancel() {
      onDraggingChange(false);
      onOverFolderChange(null);
      onOverProjectChange(null);
      onActiveFolderChange(null);
      onActiveProjectChange(null);
      onOverRootChange(false);
      onFolderDropIntentChange(null);
      onProjectDropIntentChange(null);
      pointerYRef.current = null;
    },
  });
  return null;
}

export function ProjectDndRoot({ folders, projects, children, onAction }: ProjectDndRootProps) {
  const [activeFolder, setActiveFolder] = useState<ProjectFolderRow | null>(null);
  const [activeProject, setActiveProject] = useState<ProjectRow | null>(null);
  const [dragging, setDragging] = useState(false);
  const [overFolderId, setOverFolderId] = useState<number | null>(null);
  const [overProjectId, setOverProjectId] = useState<number | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [overRoot, setOverRoot] = useState(false);
  const [folderDropIntent, setFolderDropIntent] = useState<FolderDropIntent | null>(null);
  const [projectDropIntent, setProjectDropIntent] = useState<"before" | "after" | null>(null);
  const pointerYRef = useRef<number | null>(null);

  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const collisionDetection = useMemo(
    () =>
      createProjectTreeCollisionDetection((y) => {
        pointerYRef.current = y;
      }),
    [],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const folderId = parseProjectFolderDndId(event.active.id);
    if (folderId != null) {
      setActiveFolder(folderById.get(folderId) ?? null);
      setActiveProject(null);
      return;
    }
    const projectId = parseProjectItemDndId(event.active.id);
    if (projectId != null) {
      setActiveProject(projectById.get(projectId) ?? null);
      setActiveFolder(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveFolder(null);
    setActiveProject(null);
    const { active, over } = event;
    if (!over) {
      pointerYRef.current = null;
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    if (!isProjectTreeDndId(activeId)) {
      pointerYRef.current = null;
      return;
    }

    let folderIntent: FolderDropIntent | undefined;
    let projectIntent: "before" | "after" | undefined;
    const overFolder = folderById.get(parseProjectFolderDndId(overId) ?? -1);
    const overProject = projectById.get(parseProjectItemDndId(overId) ?? -1);
    const pointerY = pointerYRef.current;

    if (overFolder != null) {
      folderIntent =
        pointerY != null
          ? resolveFolderDropIntent({ top: over.rect.top, height: over.rect.height }, pointerY)
          : "into";
    } else if (overProject != null && isProjectItemDndId(activeId)) {
      projectIntent =
        pointerY != null
          ? resolveProjectRowDropIntent({ top: over.rect.top, height: over.rect.height }, pointerY)
          : "after";
    }

    const action = resolveProjectDragEnd(
      folders,
      projects,
      activeId,
      overId,
      folderIntent != null
        ? { folderIntent }
        : projectIntent != null
          ? { projectIntent }
          : undefined,
    );
    pointerYRef.current = null;
    if (action.type !== "noop") onAction(action);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveFolder(null);
        setActiveProject(null);
        pointerYRef.current = null;
      }}
    >
      <DragMonitor
        folders={folders}
        onDraggingChange={setDragging}
        onOverFolderChange={setOverFolderId}
        onOverProjectChange={setOverProjectId}
        onActiveFolderChange={setActiveFolderId}
        onActiveProjectChange={setActiveProjectId}
        onOverRootChange={setOverRoot}
        onFolderDropIntentChange={setFolderDropIntent}
        onProjectDropIntentChange={setProjectDropIntent}
        pointerYRef={pointerYRef}
      />
      <ProjectDndUiContext.Provider
        value={{
          dragging,
          overFolderId,
          overProjectId,
          activeFolderId,
          activeProjectId,
          overRoot,
          folderDropIntent,
          projectDropIntent,
        }}
      >
        {children}
      </ProjectDndUiContext.Provider>
      <DragOverlay>
        {activeFolder ? (
          <div className="bg-background border flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 shadow-lg">
            <span aria-hidden>📁</span>
            <span className="truncate text-sm">{activeFolder.name}</span>
          </div>
        ) : null}
        {activeProject ? (
          <div className="bg-background border flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 shadow-lg">
            <span className="truncate text-sm">{activeProject.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
