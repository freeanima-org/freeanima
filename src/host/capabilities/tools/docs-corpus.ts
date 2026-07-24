import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { Glob } from "bun";

import { getRepoRoot } from "@freeanima/host/core/config/repo-root";

import { getRegisteredEmbeddedDocs, type EmbeddedDocsFile } from "./docs-embedded.ts";

export type DocsDoc = {
  path: string;
  title: string;
  body: string;
};

export type DocsListEntry = {
  path: string;
  title: string;
};

export type DocsSearchHit = {
  path: string;
  title: string;
  snippet: string;
  matches: number;
};

export type DocsCorpus = {
  byPath: Map<string, DocsDoc>;
};

const DEFAULT_SEARCH_LIMIT = 20;
const SNIPPET_RADIUS = 80;

let injectedCorpus: DocsCorpus | null = null;
let cachedCorpus: DocsCorpus | null = null;

/** 测试注入内存 corpus；传 null 清除 */
export function setDocsCorpusForTest(corpus: DocsCorpus | null): void {
  injectedCorpus = corpus;
  cachedCorpus = null;
}

export function resetDocsCorpusCacheForTest(): void {
  cachedCorpus = null;
}

/** 从 Markdown 解析展示标题：frontmatter title → 首个 # 标题 → 文件名 */
export function extractDocTitle(body: string, path: string): string {
  const fm = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fm?.[1]) {
    const titleLine = fm[1].match(/^title:\s*(.+)$/m);
    if (titleLine?.[1]) {
      let raw = titleLine[1].trim();
      if (
        (raw.startsWith('"') && raw.endsWith('"')) ||
        (raw.startsWith("'") && raw.endsWith("'"))
      ) {
        raw = raw.slice(1, -1);
      }
      if (raw.length > 0) return raw;
    }
  }
  const heading = body.match(/^#\s+(.+)$/m);
  if (heading?.[1]) {
    const t = heading[1].trim();
    if (t.length > 0) return t;
  }
  return basename(path, ".md");
}

/** 规范化并校验相对 docs/ 的路径；非法返回 null */
export function normalizeDocsPath(raw: string): string | null {
  const trimmed = raw.trim().replaceAll("\\", "/");
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith("/") || trimmed.includes("\0")) return null;
  const parts = trimmed.split("/");
  if (parts.some((p) => p === ".." || p === "." || p.length === 0)) return null;
  if (parts[0] === ".generated") return null;
  return parts.join("/");
}

export function buildCorpusFromEntries(
  entries: ReadonlyArray<{ path: string; body: string }>,
): DocsCorpus {
  const byPath = new Map<string, DocsDoc>();
  for (const entry of entries) {
    const path = normalizeDocsPath(entry.path);
    if (path == null) continue;
    byPath.set(path, {
      path,
      title: extractDocTitle(entry.body, path),
      body: entry.body,
    });
  }
  return { byPath };
}

function loadFromEmbedded(files: EmbeddedDocsFile[]): DocsCorpus {
  const entries: { path: string; body: string }[] = [];
  for (const file of files) {
    const path = normalizeDocsPath(file.rel);
    if (path == null) continue;
    try {
      entries.push({ path, body: readFileSync(file.path, "utf8") });
    } catch {
      // skip unreadable embed
    }
  }
  return buildCorpusFromEntries(entries);
}

function loadFromFilesystem(docsRoot: string): DocsCorpus {
  const entries: { path: string; body: string }[] = [];
  for (const rel of new Glob("**/*.md").scanSync({ cwd: docsRoot, onlyFiles: true })) {
    const normalized = rel.split("\\").join("/");
    if (normalized.startsWith(".generated/") || normalized.includes("/.generated/")) continue;
    const path = normalizeDocsPath(normalized);
    if (path == null) continue;
    try {
      entries.push({ path, body: readFileSync(join(docsRoot, normalized), "utf8") });
    } catch {
      // skip unreadable
    }
  }
  return buildCorpusFromEntries(entries);
}

/** 解析当前可用 corpus：测试注入 > 嵌入 > 仓库 docs/ */
export function resolveDocsCorpus(): DocsCorpus | { error: string } {
  if (injectedCorpus) return injectedCorpus;
  if (cachedCorpus) return cachedCorpus;

  const embedded = getRegisteredEmbeddedDocs();
  if (embedded) {
    cachedCorpus = loadFromEmbedded(embedded);
    return cachedCorpus;
  }

  let root: string;
  try {
    root = getRepoRoot();
  } catch (err) {
    return { error: `Cannot resolve repo root: ${String(err)}` };
  }
  const docsRoot = join(root, "docs");
  if (!existsSync(docsRoot)) {
    return { error: `docs/ not found at ${docsRoot}` };
  }
  cachedCorpus = loadFromFilesystem(docsRoot);
  if (cachedCorpus.byPath.size === 0) {
    return { error: `No Markdown files under ${docsRoot}` };
  }
  return cachedCorpus;
}

export function listDocs(corpus: DocsCorpus, prefix?: string): DocsListEntry[] {
  const normalizedPrefix = prefix?.trim().replaceAll("\\", "/") ?? "";
  const entries = [...corpus.byPath.values()]
    .filter((d) => (normalizedPrefix.length === 0 ? true : d.path.startsWith(normalizedPrefix)))
    .map((d) => ({ path: d.path, title: d.title }))
    .toSorted((a, b) => a.path.localeCompare(b.path));
  const readmeIdx = entries.findIndex((d) => d.path === "README.md");
  if (readmeIdx > 0) {
    const [readme] = entries.splice(readmeIdx, 1);
    if (readme) entries.unshift(readme);
  }
  return entries;
}

export function getDoc(
  corpus: DocsCorpus,
  rawPath: string,
): { ok: true; path: string; title: string; content: string } | { ok: false; error: string } {
  const path = normalizeDocsPath(rawPath);
  if (path == null) return { ok: false, error: `Invalid docs path: ${rawPath}` };
  const doc = corpus.byPath.get(path);
  if (!doc) return { ok: false, error: `Document not found: ${path}` };
  return { ok: true, path: doc.path, title: doc.title, content: doc.body };
}

function countOccurrences(haystackLower: string, needleLower: string): number {
  if (needleLower.length === 0) return 0;
  let count = 0;
  let from = 0;
  while (from < haystackLower.length) {
    const idx = haystackLower.indexOf(needleLower, from);
    if (idx < 0) break;
    count += 1;
    from = idx + needleLower.length;
  }
  return count;
}

function makeSnippet(body: string, terms: string[]): string {
  const lower = body.toLowerCase();
  let bestIdx = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx >= 0 && (bestIdx < 0 || idx < bestIdx)) bestIdx = idx;
  }
  if (bestIdx < 0) {
    const flat = body.replaceAll(/\s+/g, " ").trim();
    return flat.length <= SNIPPET_RADIUS * 2 ? flat : `${flat.slice(0, SNIPPET_RADIUS * 2)}…`;
  }
  const start = Math.max(0, bestIdx - SNIPPET_RADIUS);
  const end = Math.min(body.length, bestIdx + SNIPPET_RADIUS);
  let snippet = body.slice(start, end).replaceAll(/\s+/g, " ").trim();
  if (start > 0) snippet = `…${snippet}`;
  if (end < body.length) snippet = `${snippet}…`;
  return snippet;
}

export function searchDocs(
  corpus: DocsCorpus,
  query: string,
  limit = DEFAULT_SEARCH_LIMIT,
): { query: string; hits: DocsSearchHit[]; total: number } | { error: string } {
  const trimmed = query.trim();
  if (trimmed.length === 0) return { error: "query is required" };
  const terms = trimmed
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (terms.length === 0) return { error: "query is required" };

  const hits: DocsSearchHit[] = [];
  for (const doc of corpus.byPath.values()) {
    const haystack = `${doc.path}\n${doc.title}\n${doc.body}`.toLowerCase();
    if (!terms.every((t) => haystack.includes(t))) continue;
    let matches = 0;
    for (const t of terms) {
      matches += countOccurrences(haystack, t);
    }
    hits.push({
      path: doc.path,
      title: doc.title,
      snippet: makeSnippet(doc.body, terms),
      matches,
    });
  }
  hits.sort((a, b) => b.matches - a.matches || a.path.localeCompare(b.path));
  const limited = hits.slice(0, Math.max(1, limit));
  return { query: trimmed, hits: limited, total: hits.length };
}
