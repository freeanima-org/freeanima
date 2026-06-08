import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "@freeanima/service-config";
import { memorySearchDetailed, type MemorySearchResult } from "@freeanima/life-memory/search";
import { getServiceContext } from "../context.ts";

export type MemoryFileEntry = {
  name: string;
  path: string;
  size: number;
  mtime: number;
  content: string;
};

function readMemoryEntry(path: string, displayName: string): MemoryFileEntry | null {
  if (!existsSync(path)) return null;
  try {
    const st = statSync(path);
    return {
      name: displayName,
      path,
      size: st.size,
      mtime: st.mtimeMs / 1000,
      content: readFileSync(path, "utf-8"),
    };
  } catch {
    return null;
  }
}

function semanticRepos() {
  return getServiceContext().engine.repos.semanticMemory;
}

export async function memorySearch(args: {
  query: string;
  limit?: number;
  session_limit?: number;
  session?: string;
}): Promise<MemorySearchResult> {
  const query = args.query.trim();
  if (!query) throw new Error("query is required");
  return memorySearchDetailed(query, {
    l3Limit: args.limit,
    l2Limit: args.session_limit,
    sessionId: args.session?.trim() || undefined,
  });
}

/** @deprecated PG STORED content_fts 自动维护，保留 API 兼容 */
export async function reindexL3All(): Promise<{ index_rows: number }> {
  const count = await semanticRepos().count();
  return { index_rows: count };
}

export async function listMemoryFiles(): Promise<{ files: MemoryFileEntry[] }> {
  const files: MemoryFileEntry[] = [];
  const home = PATHS.home;

  for (const name of ["MEMORY.md", "USER.md"]) {
    const path = join(home, name);
    const entry = readMemoryEntry(path, name);
    if (entry) files.push(entry);
  }

  try {
    const rows = await semanticRepos().listAll();
    for (const row of rows) {
      const name = `${row.id}.md`;
      const content = `---\nid: ${row.id}\ntype: ${row.type}\npinned: ${row.pinned}\ncreated: ${row.created}\nupdated: ${row.updated}\n---\n${row.content}`;
      files.push({
        name,
        path: `pg:semantic_memory:${row.id}`,
        size: Buffer.byteLength(content, "utf-8"),
        mtime: Date.parse(row.updated) / 1000 || 0,
        content,
      });
    }
  } catch {
    /* PG 不可用时仅返回 Markdown 身份文件 */
  }

  return { files };
}
