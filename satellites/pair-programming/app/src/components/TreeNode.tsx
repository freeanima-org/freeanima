import { useMemo } from "react";

export type TreeNodeData = {
  name: string;
  type: "file" | "directory";
  children?: TreeNodeData[];
};

type TreeNodeProps = {
  node: TreeNodeData;
  path: string;
  expandedPaths: string[];
  selected: string;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
};

export function TreeNode({
  node,
  path,
  expandedPaths,
  selected,
  onToggle,
  onSelect,
}: TreeNodeProps) {
  const isExpanded = useMemo(() => expandedPaths.includes(path), [expandedPaths, path]);

  if (node.type === "directory") {
    return (
      <div className="select-none">
        <button
          type="button"
          className="flex items-center gap-1 w-full px-1 py-0.5 rounded hover:bg-base-300/40 text-left"
          onClick={() => onToggle(path)}
        >
          <span className="w-3 text-xs opacity-60 shrink-0">{isExpanded ? "▼" : "▶"}</span>
          <span className="truncate text-base-content/80">{node.name}/</span>
        </button>
        {isExpanded ? (
          <div className="pl-3 border-l border-base-300/40 ml-2">
            {(node.children || []).map((child) => {
              const childPath = `${path}/${child.name}`;
              return (
                <TreeNode
                  key={childPath}
                  node={child}
                  path={childPath}
                  expandedPaths={expandedPaths}
                  selected={selected}
                  onToggle={onToggle}
                  onSelect={onSelect}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={[
        "flex items-center w-full px-1 py-0.5 pl-4 rounded hover:bg-base-300/40 text-left truncate",
        selected === path ? "bg-primary/15 font-medium" : "",
      ].join(" ")}
      onClick={() => onSelect(path)}
    >
      {node.name}
    </button>
  );
}
