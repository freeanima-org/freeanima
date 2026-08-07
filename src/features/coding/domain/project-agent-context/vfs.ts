/** 虚拟 FS：发现核不绑 Node / Tauri，便于单测注入 */

export type ProjectVfsDirEntry = {
  name: string;
  kind: "file" | "dir";
};

export type ProjectVfs = {
  exists(path: string): Promise<boolean>;
  isDir(path: string): Promise<boolean>;
  readText(path: string): Promise<string>;
  listDir(path: string): Promise<ProjectVfsDirEntry[]>;
  writeText?(path: string, content: string): Promise<void>;
};

/** 内存 VFS（单测）；路径用 posix `/` 相对 workspace 根（无前导 / 或 `.` 表示根） */
function normMemoryPath(path: string): string {
  const raw = path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (!raw || raw === ".") return "";
  const parts = raw.split("/").filter((p) => p.length > 0 && p !== ".");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}

export function createMemoryProjectVfs(
  files: Record<string, string>,
): ProjectVfs & { files: Record<string, string> } {
  const store: Record<string, string> = { ...files };

  function dirChildren(dir: string): ProjectVfsDirEntry[] {
    const prefix = dir ? `${dir}/` : "";
    const names = new Map<string, "file" | "dir">();
    for (const key of Object.keys(store)) {
      if (dir && key !== dir && !key.startsWith(prefix)) continue;
      if (!dir && key.includes("/") === false) {
        names.set(key, "file");
        continue;
      }
      const rest = dir ? key.slice(prefix.length) : key;
      if (!rest) continue;
      const slash = rest.indexOf("/");
      if (slash < 0) names.set(rest, "file");
      else names.set(rest.slice(0, slash), "dir");
    }
    return [...names.entries()].map(([name, kind]) => ({ name, kind }));
  }

  return {
    files: store,
    async exists(path) {
      const p = normMemoryPath(path);
      if (!p) return true;
      if (p in store) return true;
      return Object.keys(store).some((k) => k.startsWith(`${p}/`));
    },
    async isDir(path) {
      const p = normMemoryPath(path);
      if (!p) return true;
      if (p in store) return false;
      return Object.keys(store).some((k) => k.startsWith(`${p}/`));
    },
    async readText(path) {
      const p = normMemoryPath(path);
      if (!(p in store)) throw new Error(`ENOENT: ${path}`);
      return store[p] ?? "";
    },
    async listDir(path) {
      const p = normMemoryPath(path);
      if (p && p in store) throw new Error(`ENOTDIR: ${path}`);
      return dirChildren(p);
    },
    async writeText(path, content) {
      store[normMemoryPath(path)] = content;
    },
  };
}
