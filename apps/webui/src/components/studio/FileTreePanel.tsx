import { useEffect, useMemo, useState } from "react";
import { usePairProgrammingStore } from "@/stores/pair-programming";
import { TreeNode, type TreeNodeData } from "./TreeNode";

function nodePath(node: TreeNodeData, parentPath: string) {
  return parentPath ? `${parentPath}/${node.name}` : node.name;
}

function filterTreePure(nodes: TreeNodeData[], parentPath: string, q: string) {
  const tree: TreeNodeData[] = [];
  const expand = new Set<string>();
  for (const node of nodes) {
    const path = nodePath(node, parentPath);
    if (node.type === "directory") {
      const sub = filterTreePure(node.children || [], path, q);
      if (sub.tree.length || node.name.toLowerCase().includes(q)) {
        tree.push({ ...node, children: sub.tree });
        expand.add(path);
        for (const p of sub.expand) expand.add(p);
      }
    } else if (node.name.toLowerCase().includes(q) || path.toLowerCase().includes(q)) {
      tree.push(node);
      let p = parentPath;
      while (p) {
        expand.add(p);
        p = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
      }
    }
  }
  return { tree, expand: [...expand] };
}

function expandTopLevel(tree: TreeNodeData[]) {
  return tree.filter((n) => n.type === "directory").map((n) => n.name);
}

export function FileTreePanel() {
  const fileTree = usePairProgrammingStore((s) => s.fileTree);
  const loading = usePairProgrammingStore((s) => s.loading);
  const searchResults = usePairProgrammingStore((s) => s.searchResults);
  const currentFile = usePairProgrammingStore((s) => s.currentFile);
  const globalSearch = usePairProgrammingStore((s) => s.globalSearch);
  const openFile = usePairProgrammingStore((s) => s.openFile);

  const [leftTab, setLeftTab] = useState<"tree" | "search">("tree");
  const [filterText, setFilterText] = useState("");
  const [globalQuery, setGlobalQuery] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState("");

  const treeNodes = useMemo(
    () => fileTree as unknown as TreeNodeData[],
    [fileTree],
  );

  const filteredTree = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return treeNodes;
    return filterTreePure(treeNodes, "", q).tree;
  }, [filterText, treeNodes]);

  useEffect(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) {
      if (treeNodes.length) setExpandedPaths(expandTopLevel(treeNodes));
      return;
    }
    setExpandedPaths(filterTreePure(treeNodes, "", q).expand);
  }, [filterText, treeNodes]);

  useEffect(() => {
    if (treeNodes.length && !filterText.trim()) {
      setExpandedPaths(expandTopLevel(treeNodes));
    }
  }, [treeNodes, filterText]);

  useEffect(() => {
    if (currentFile?.path) setSelectedPath(String(currentFile.path));
  }, [currentFile?.path]);

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  };

  const onSelectFile = (path: string) => {
    setSelectedPath(path);
    void openFile(path);
  };

  const jumpToHit = (hit: Record<string, unknown>) => {
    const file = String(hit.file ?? "");
    setSelectedPath(file);
    const parts = file.split("/");
    const paths: string[] = [];
    for (let i = 1; i < parts.length; i++) {
      paths.push(parts.slice(0, i).join("/"));
    }
    setExpandedPaths((prev) => [...new Set([...prev, ...paths])]);
    void openFile(file, Number(hit.line));
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex border-b border-base-300 shrink-0 text-xs">
        <button
          type="button"
          className={[
            "flex-1 px-2 py-1.5 font-medium text-center hover:bg-base-300/30 transition-colors",
            leftTab === "tree" ? "bg-base-200 border-b-2 border-primary" : "text-base-content/50",
          ].join(" ")}
          onClick={() => setLeftTab("tree")}
        >
          📁 目录树
        </button>
        <button
          type="button"
          className={[
            "flex-1 px-2 py-1.5 font-medium text-center hover:bg-base-300/30 transition-colors",
            leftTab === "search" ? "bg-base-200 border-b-2 border-primary" : "text-base-content/50",
          ].join(" ")}
          onClick={() => setLeftTab("search")}
        >
          🔍 搜索
        </button>
      </div>

      {leftTab === "tree" ? (
        <>
          <div className="p-2 border-b border-base-300 shrink-0">
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              type="search"
              className="input input-sm input-bordered w-full"
              placeholder="过滤文件名…"
              autoComplete="off"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-1 text-sm font-mono min-h-0">
            {loading ? (
              <div className="p-4 text-center text-base-content/50">
                <span className="loading loading-spinner loading-sm" />
              </div>
            ) : (
              filteredTree.map((node) => (
                <TreeNode
                  key={nodePath(node, "")}
                  node={node}
                  path={node.name}
                  expandedPaths={expandedPaths}
                  selected={selectedPath}
                  onToggle={toggleExpand}
                  onSelect={onSelectFile}
                />
              ))
            )}
            {!loading && filteredTree.length === 0 ? (
              <div className="p-4 text-xs text-base-content/50">无匹配文件</div>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="p-2 border-b border-base-300 shrink-0">
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                void globalSearch(globalQuery);
              }}
            >
              <input
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                type="search"
                className="input input-sm input-bordered flex-1"
                placeholder="搜索文件内容…"
              />
              <button
                type="submit"
                className="btn btn-sm btn-ghost"
                disabled={!globalQuery.trim()}
              >
                搜
              </button>
            </form>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {searchResults.length === 0 ? (
              <div className="p-4 text-xs text-base-content/50 text-center">
                输入关键词搜索项目文件
              </div>
            ) : (
              searchResults.map((hit, i) => (
                <button
                  key={i}
                  type="button"
                  className="w-full text-left px-2 py-1.5 hover:bg-base-300/50 text-xs border-b border-base-300/30"
                  onClick={() => jumpToHit(hit)}
                >
                  <div className="font-mono text-primary truncate">
                    {String(hit.file)}:{String(hit.line)}
                  </div>
                  <div className="truncate text-base-content/70">{String(hit.content)}</div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
