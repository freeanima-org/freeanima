import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { extname, join, relative, resolve } from "node:path";
import { loadConfig, patchConfigSection } from "@freeanima/service-config";
import { DEFAULT_SKIP_DIRS, isIgnored, loadGitignoreStack } from "./studio-gitignore.ts";

export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_SEARCH_RESULTS = 200;

const BINARY_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".bmp",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".pdf",
  ".db",
  ".sqlite",
  ".wasm",
  ".mp3",
  ".mp4",
  ".avi",
  ".mov",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".bin",
  ".o",
  ".a",
]);

const EXT_TO_LANG: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".vue": "xml",
  ".html": "xml",
  ".htm": "xml",
  ".css": "css",
  ".scss": "scss",
  ".sass": "scss",
  ".less": "css",
  ".json": "json",
  ".jsonc": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".md": "markdown",
  ".markdown": "markdown",
  ".py": "python",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".swift": "swift",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".php": "php",
  ".sql": "sql",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".toml": "ini",
  ".ini": "ini",
  ".xml": "xml",
  ".svg": "xml",
  ".dockerfile": "dockerfile",
};

export interface StudioConfig {
  workspace: string;
  gitignore: boolean;
  showHidden: boolean;
}

export interface TreeNode {
  name: string;
  type: "file" | "directory";
  size?: number;
  children?: TreeNode[];
}

export interface SearchHit {
  file: string;
  line: number;
  column: number;
  content: string;
  match: string;
}

function studioSection(): Record<string, unknown> {
  const cfg = loadConfig() as Record<string, unknown>;
  const studio = cfg.studio;
  if (typeof studio === "object" && studio !== null && !Array.isArray(studio)) {
    return studio as Record<string, unknown>;
  }
  return {};
}

export function getStudioConfig(): StudioConfig {
  const s = studioSection();
  return {
    workspace: typeof s.workspace === "string" ? s.workspace : "",
    gitignore: s.gitignore !== false,
    showHidden: s.showHidden === true,
  };
}

export function patchStudioConfig(patch: Partial<StudioConfig>): StudioConfig {
  patchConfigSection("studio", patch as Record<string, unknown>);
  return getStudioConfig();
}

export function resolveWorkspace(): string {
  const ws = getStudioConfig().workspace.trim();
  if (!ws) return "";
  return resolve(ws);
}

function assertWorkspaceConfigured(): string {
  const root = resolveWorkspace();
  if (!root) throw new Error("studio.workspace not configured");
  if (!existsSync(root)) throw new Error(`workspace does not exist: ${root}`);
  return root;
}

/** Resolve relative path to absolute and verify within workspace */
export function resolveStudioPath(relPath: string): string {
  const root = assertWorkspaceConfigured();
  const rootReal = realpathSync(root);
  const abs = resolve(root, relPath.replace(/^\/+/, ""));
  const absReal = existsSync(abs) ? realpathSync(abs) : abs;
  if (!absReal.startsWith(rootReal + "/") && absReal !== rootReal) {
    throw new Error("Path outside workspace scope");
  }
  return abs;
}

function shouldSkipName(name: string, showHidden: boolean): boolean {
  if (!showHidden && name.startsWith(".")) return true;
  return false;
}

function detectLanguage(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  if (base.toLowerCase() === "dockerfile") return "dockerfile";
  const ext = extname(base).toLowerCase();
  return EXT_TO_LANG[ext] ?? "plaintext";
}

function isTextFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  if (BINARY_EXT.has(ext)) return false;
  if (!extname(filePath) && statSync(filePath).size > 512 * 1024) return false;
  return true;
}

function buildTreeDir(absDir: string, relDir: string, cfg: StudioConfig): TreeNode[] {
  const root = resolveWorkspace();
  const giStack = cfg.gitignore ? loadGitignoreStack(root, absDir) : [];
  let entries;
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: TreeNode[] = [];
  for (const ent of entries.toSorted((a, b) => a.name.localeCompare(b.name))) {
    if (shouldSkipName(ent.name, cfg.showHidden)) continue;
    const relPath = relDir ? `${relDir}/${ent.name}` : ent.name;
    if (cfg.gitignore && isIgnored(relPath, ent.isDirectory(), giStack)) continue;
    if (ent.isDirectory()) {
      if (DEFAULT_SKIP_DIRS.has(ent.name)) continue;
      const children = buildTreeDir(join(absDir, ent.name), relPath, cfg);
      nodes.push({ name: ent.name, type: "directory", children });
    } else if (ent.isFile()) {
      let size = 0;
      try {
        size = statSync(join(absDir, ent.name)).size;
      } catch {
        /* ignore */
      }
      nodes.push({ name: ent.name, type: "file", size });
    }
  }
  return nodes;
}

export function buildFileTree(): { tree: TreeNode[]; workspace: string } {
  const root = assertWorkspaceConfigured();
  const cfg = getStudioConfig();
  const tree = buildTreeDir(root, "", cfg);
  return { tree, workspace: root };
}

export function readStudioFile(relPath: string): {
  path: string;
  content: string;
  language: string;
  size: number;
} {
  const cfg = getStudioConfig();
  const parts = relPath.split("/");
  const name = parts[parts.length - 1] ?? relPath;
  if (!cfg.showHidden && name.startsWith(".")) {
    throw new Error("Hidden files are not readable");
  }
  const abs = resolveStudioPath(relPath);
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    throw new Error("File does not exist");
  }
  if (!isTextFile(abs)) {
    throw new Error("Binary or unreadable file");
  }
  const size = statSync(abs).size;
  if (size > MAX_FILE_BYTES) {
    throw new Error(`File too large (${size} bytes); limit ${MAX_FILE_BYTES} bytes`);
  }
  let content: string;
  try {
    content = readFileSync(abs, "utf-8");
  } catch (e) {
    throw new Error(`Read failed: ${e}`, { cause: e });
  }
  return {
    path: relPath.replace(/^\/+/, ""),
    content,
    language: detectLanguage(relPath),
    size,
  };
}

function searchWithRipgrep(query: string, root: string): SearchHit[] | null {
  const proc = spawnSync(
    "rg",
    [
      "--no-heading",
      "--line-number",
      "--fixed-strings",
      "--max-count",
      String(MAX_SEARCH_RESULTS),
      query,
      root,
    ],
    { encoding: "utf-8", timeout: 60_000, maxBuffer: 8 * 1024 * 1024 },
  );
  if (proc.error) return null;
  const code = proc.status ?? 1;
  if (code !== 0 && code !== 1) {
    throw new Error(String(proc.stderr ?? proc.stdout ?? "rg search failed"));
  }
  const out = String(proc.stdout ?? "").trim();
  if (!out) return [];
  const hits: SearchHit[] = [];
  for (const line of out.split("\n")) {
    const m = line.match(/^(.+?):(\d+):(.+)$/);
    if (!m) continue;
    const [, fileAbs, lineNo, text] = m;
    const rel = relative(root, fileAbs!).replace(/\\/g, "/");
    const idx = text!.indexOf(query);
    hits.push({
      file: rel,
      line: Number(lineNo),
      column: idx >= 0 ? idx + 1 : 1,
      content: text!.trimEnd(),
      match: query,
    });
    if (hits.length >= MAX_SEARCH_RESULTS) break;
  }
  return hits;
}

function searchWalk(
  query: string,
  absDir: string,
  relDir: string,
  cfg: StudioConfig,
  hits: SearchHit[],
): void {
  if (hits.length >= MAX_SEARCH_RESULTS) return;
  const root = resolveWorkspace();
  const giStack = cfg.gitignore ? loadGitignoreStack(root, absDir) : [];
  let entries;
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (hits.length >= MAX_SEARCH_RESULTS) return;
    if (shouldSkipName(ent.name, cfg.showHidden)) continue;
    const relPath = relDir ? `${relDir}/${ent.name}` : ent.name;
    if (cfg.gitignore && isIgnored(relPath, ent.isDirectory(), giStack)) continue;
    const full = join(absDir, ent.name);
    if (ent.isDirectory()) {
      if (DEFAULT_SKIP_DIRS.has(ent.name)) continue;
      searchWalk(query, full, relPath, cfg, hits);
    } else if (ent.isFile() && isTextFile(full)) {
      let content: string;
      try {
        const size = statSync(full).size;
        if (size > MAX_FILE_BYTES) continue;
        content = readFileSync(full, "utf-8");
      } catch {
        continue;
      }
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i]!;
        const idx = lineText.indexOf(query);
        if (idx >= 0) {
          hits.push({
            file: relPath,
            line: i + 1,
            column: idx + 1,
            content: lineText.trimEnd(),
            match: query,
          });
          if (hits.length >= MAX_SEARCH_RESULTS) return;
        }
      }
    }
  }
}

export function searchStudio(query: string): { results: SearchHit[] } {
  const q = query.trim();
  if (!q) throw new Error("query must not be empty");
  const root = assertWorkspaceConfigured();
  const cfg = getStudioConfig();
  const rgHits = searchWithRipgrep(q, root);
  if (rgHits !== null) return { results: rgHits };
  const hits: SearchHit[] = [];
  searchWalk(q, root, "", cfg, hits);
  return { results: hits };
}
