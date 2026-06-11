import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  AutobiographicalListOpts,
  AutobiographicalMemoryRow,
  LimbicListOpts,
  LimbicMemoryRow,
  SemanticFtsHit,
  SemanticMemorySearchOpts,
} from "@freeanima/engine-repos";
import { PATHS } from "@freeanima/service-config";
import { memoryRecallSearch, type MemoryRecallResult } from "@freeanima/life-memory/search";
import { getServiceContext } from "../context.ts";

export type MemoryListResult<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number;
};

function clampPagination(offset?: number, limit?: number) {
  const safeLimit = Math.max(1, Math.min(100, limit ?? 20));
  const safeOffset = Math.max(0, offset ?? 0);
  return { offset: safeOffset, limit: safeLimit };
}

function repos() {
  return getServiceContext().engine.repos;
}

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
  return repos().semanticMemory;
}

export async function memorySearch(args: {
  query: string;
  limit?: number;
}): Promise<MemoryRecallResult> {
  const query = args.query.trim();
  if (!query) throw new Error("query is required");
  return memoryRecallSearch(query, { limit: args.limit });
}

/** PG STORED content_fts auto-maintained; returns semantic_memory row count */
export async function countSemanticMemory(): Promise<{ index_rows: number }> {
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
    /* When PG unavailable, return Markdown identity file only */
  }

  return { files };
}

export async function listSemanticMemories(
  args: {
    query?: string;
    offset?: number;
    limit?: number;
    types?: string[];
    status?: SemanticMemorySearchOpts["status"];
    source_session?: string;
  } = {},
): Promise<MemoryListResult<SemanticFtsHit>> {
  const { offset, limit } = clampPagination(args.offset, args.limit);
  const sourceSession = args.source_session?.trim();
  const filterOpts: Omit<SemanticMemorySearchOpts, "limit" | "offset"> = {
    query: args.query,
    types: args.types,
    status: args.status,
    source_sessions: sourceSession ? [sourceSession] : undefined,
  };
  const [items, total] = await Promise.all([
    semanticRepos().search({ ...filterOpts, offset, limit }),
    semanticRepos().countSearch(filterOpts),
  ]);
  return { items, total, offset, limit };
}

export async function listLimbicMemories(
  args: LimbicListOpts = {},
): Promise<MemoryListResult<LimbicMemoryRow>> {
  const { offset, limit } = clampPagination(args.offset, args.limit);
  const filterOpts: Omit<LimbicListOpts, "offset" | "limit"> = {
    query: args.query,
    session_id: args.session_id,
    kind: args.kind,
  };
  const [items, total] = await Promise.all([
    repos().limbicMemory.list({ ...filterOpts, offset, limit }),
    repos().limbicMemory.count(filterOpts),
  ]);
  return { items, total, offset, limit };
}

export async function listAutobiographicalMemories(
  args: AutobiographicalListOpts = {},
): Promise<MemoryListResult<AutobiographicalMemoryRow>> {
  const { offset, limit } = clampPagination(args.offset, args.limit);
  const filterOpts: Omit<AutobiographicalListOpts, "offset" | "limit"> = {
    query: args.query,
    status: args.status,
    significance: args.significance,
    source_session: args.source_session,
  };
  const [items, total] = await Promise.all([
    repos().autobiographicalMemory.list({ ...filterOpts, offset, limit }),
    repos().autobiographicalMemory.count(filterOpts),
  ]);
  return { items, total, offset, limit };
}
