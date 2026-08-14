import { useCallback, useEffect, useState } from "react";
import { ChevronRightIcon, FileIcon, FolderIcon, FolderOpenIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger, cn } from "@freeanima/ui-kit";

import type { WorkspaceTreeEntry } from "../lib/workspace-fs.ts";

export type FileTreeListResult =
  | { ok: true; entries: WorkspaceTreeEntry[] }
  | { ok: false; error: string };

export type FileTreeListChildren = (relDir: string) => Promise<FileTreeListResult>;

type Props = {
  /** 工作区变更时重置展开/缓存（通常传 workspaceRoot） */
  treeKey: string;
  listChildren: FileTreeListChildren;
  selectedPath: string | null;
  onSelectFile: (relPath: string) => void;
};

export function entryBasename(path: string): string {
  const posix = path.replace(/\\/g, "/");
  if (posix === "." || posix === "") return posix || ".";
  const parts = posix.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? posix;
}

type DirState = {
  status: "idle" | "loading" | "ready" | "error";
  entries: WorkspaceTreeEntry[];
  error?: string;
};

export function WorkspaceFileTree({ treeKey, listChildren, selectedPath, onSelectFile }: Props) {
  const [root, setRoot] = useState<DirState>({ status: "idle", entries: [] });
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [childrenByDir, setChildrenByDir] = useState<Record<string, DirState>>({});

  const loadDir = useCallback(
    async (relDir: string): Promise<DirState> => {
      const listed = await listChildren(relDir);
      if (!listed.ok) {
        return { status: "error", entries: [], error: listed.error };
      }
      return { status: "ready", entries: listed.entries };
    },
    [listChildren],
  );

  useEffect(() => {
    let cancelled = false;
    setExpanded(new Set());
    setChildrenByDir({});
    setRoot({ status: "loading", entries: [] });
    void loadDir(".").then((next) => {
      if (!cancelled) setRoot(next);
    });
    return () => {
      cancelled = true;
    };
  }, [treeKey, loadDir]);

  const ensureChildren = useCallback(
    async (relDir: string) => {
      setChildrenByDir((prev) => {
        const cur = prev[relDir];
        if (cur?.status === "loading" || cur?.status === "ready") return prev;
        return { ...prev, [relDir]: { status: "loading", entries: [] } };
      });
      const next = await loadDir(relDir);
      setChildrenByDir((prev) => ({ ...prev, [relDir]: next }));
    },
    [loadDir],
  );

  const onExpandedChange = (relDir: string, open: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(relDir);
      else next.delete(relDir);
      return next;
    });
    if (open) void ensureChildren(relDir);
  };

  if (root.status === "loading" || root.status === "idle") {
    return <p className="muted">加载中…</p>;
  }
  if (root.status === "error") {
    return <p className="coding-error !border-0 !bg-transparent px-0">{root.error}</p>;
  }
  if (root.entries.length === 0) {
    return <p className="muted">空目录</p>;
  }

  return (
    <div className="coding-file-tree" role="tree" aria-label="工作区文件树">
      {root.entries.map((entry) => (
        <TreeEntry
          key={entry.path}
          entry={entry}
          depth={0}
          expanded={expanded}
          childrenByDir={childrenByDir}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
          onExpandedChange={onExpandedChange}
        />
      ))}
    </div>
  );
}

function TreeEntry({
  entry,
  depth,
  expanded,
  childrenByDir,
  selectedPath,
  onSelectFile,
  onExpandedChange,
}: {
  entry: WorkspaceTreeEntry;
  depth: number;
  expanded: Set<string>;
  childrenByDir: Record<string, DirState>;
  selectedPath: string | null;
  onSelectFile: (relPath: string) => void;
  onExpandedChange: (relDir: string, open: boolean) => void;
}) {
  const pad = { paddingLeft: `${0.35 + depth * 0.75}rem` };
  const name = entryBasename(entry.path);

  if (entry.kind === "file") {
    return (
      <div role="treeitem" aria-selected={selectedPath === entry.path}>
        <button
          type="button"
          className={cn("coding-tree-row", selectedPath === entry.path && "active")}
          style={pad}
          onClick={() => onSelectFile(entry.path)}
          title={entry.path}
        >
          <span className="coding-tree-chevron-slot" aria-hidden />
          <FileIcon className="coding-tree-icon" aria-hidden />
          <span className="coding-tree-name">{name}</span>
        </button>
      </div>
    );
  }

  const isOpen = expanded.has(entry.path);
  const childState = childrenByDir[entry.path];

  return (
    <Collapsible
      isExpanded={isOpen}
      onExpandedChange={(open) => onExpandedChange(entry.path, open)}
    >
      <div role="treeitem" aria-expanded={isOpen} style={pad} title={entry.path}>
        <CollapsibleTrigger className={cn("coding-tree-row w-full", isOpen && "is-open")}>
          <ChevronRightIcon
            className={cn("coding-tree-chevron", isOpen && "coding-tree-chevron-open")}
            aria-hidden
          />
          {isOpen ? (
            <FolderOpenIcon className="coding-tree-icon" aria-hidden />
          ) : (
            <FolderIcon className="coding-tree-icon" aria-hidden />
          )}
          <span className="coding-tree-name">{name}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div role="group" className="coding-tree-children">
            {childState?.status === "loading" ? (
              <div
                className="coding-tree-meta muted"
                style={{ paddingLeft: `${0.35 + (depth + 1) * 0.75}rem` }}
              >
                加载中…
              </div>
            ) : null}
            {childState?.status === "error" ? (
              <div
                className="coding-tree-meta coding-error !border-0 !bg-transparent"
                style={{ paddingLeft: `${0.35 + (depth + 1) * 0.75}rem` }}
              >
                {childState.error}
              </div>
            ) : null}
            {childState?.status === "ready" && childState.entries.length === 0 ? (
              <div
                className="coding-tree-meta muted"
                style={{ paddingLeft: `${0.35 + (depth + 1) * 0.75}rem` }}
              >
                空
              </div>
            ) : null}
            {childState?.status === "ready"
              ? childState.entries.map((child) => (
                  <TreeEntry
                    key={child.path}
                    entry={child}
                    depth={depth + 1}
                    expanded={expanded}
                    childrenByDir={childrenByDir}
                    selectedPath={selectedPath}
                    onSelectFile={onSelectFile}
                    onExpandedChange={onExpandedChange}
                  />
                ))
              : null}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
