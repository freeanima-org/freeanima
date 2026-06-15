import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

export type StudioConfig = {
  workspace: string;
  gitignore: boolean;
  showHidden: boolean;
};

export type TreeNode = {
  name: string;
  type: "file" | "directory";
  size?: number;
  children?: TreeNode[];
};

let config: StudioConfig = {
  workspace: process.env.STUDIO_WORKSPACE ?? process.cwd(),
  gitignore: true,
  showHidden: false,
};

export function getStudioConfig(): StudioConfig {
  return { ...config };
}

export function patchStudioConfig(patch: Partial<StudioConfig>): StudioConfig {
  config = { ...config, ...patch };
  return getStudioConfig();
}

export function resolveWorkspace(): string {
  const ws = config.workspace.trim();
  if (!ws || !existsSync(ws)) {
    throw new Error("studio.workspace is not configured or does not exist");
  }
  return resolve(ws);
}

function resolveStudioPath(relPath: string): string {
  const root = resolveWorkspace();
  const abs = resolve(root, relPath);
  if (!abs.startsWith(root)) {
    throw new Error("path escapes workspace");
  }
  return abs;
}

export function buildFileTree(): { tree: TreeNode[]; workspace: string } {
  const root = resolveWorkspace();
  const walk = (dir: string): TreeNode[] => {
    const entries = readdirSync(dir, { withFileTypes: true })
      .filter((e) => config.showHidden || !e.name.startsWith("."))
      .sort((a, b) => a.name.localeCompare(b.name));
    const nodes: TreeNode[] = [];
    for (const ent of entries) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        nodes.push({
          name: ent.name,
          type: "directory",
          children: walk(full),
        });
      } else if (ent.isFile()) {
        nodes.push({ name: ent.name, type: "file", size: statSync(full).size });
      }
    }
    return nodes;
  };
  return { tree: walk(root), workspace: root };
}

export function readStudioFile(relPath: string): {
  path: string;
  content: string;
  language: string;
  size: number;
} {
  const abs = resolveStudioPath(relPath);
  const content = readFileSync(abs, "utf-8");
  const ext = extname(abs).toLowerCase();
  return {
    path: relative(resolveWorkspace(), abs),
    content,
    language: ext.slice(1) || "text",
    size: content.length,
  };
}

export function searchStudio(query: string): { results: Array<Record<string, unknown>> } {
  const root = resolveWorkspace();
  const results: Array<Record<string, unknown>> = [];
  const walk = (dir: string): void => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (!config.showHidden && ent.name.startsWith(".")) continue;
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
        continue;
      }
      if (!ent.isFile()) continue;
      const rel = relative(root, full);
      const text = readFileSync(full, "utf-8");
      for (const [i, line] of text.split("\n").entries()) {
        if (line.includes(query)) {
          results.push({
            file: rel,
            line: i + 1,
            column: line.indexOf(query) + 1,
            content: line,
            match: query,
          });
          if (results.length >= 200) return;
        }
      }
    }
  };
  walk(root);
  return { results };
}
