import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  AutobiographicalListOpts,
  AutobiographicalMemoryRow,
  LimbicListOpts,
  LimbicMemoryRow,
  SemanticFtsHit,
  SemanticMemorySearchOpts,
} from "@freeanima/core/repos";
import {
  countAutobiographicalMemory,
  listAutobiographicalMemory,
} from "@freeanima/core/db/pg/autobiographical-memory";
import { countLimbicMemory, listLimbicMemory } from "@freeanima/core/db/pg/limbic-memory";
import {
  countSemanticMemory,
  countSemanticMemorySearch,
  getSemanticMemory,
  listAllSemanticMemory,
  searchSemanticMemory,
  updateSemanticMemory,
} from "@freeanima/core/db/pg/semantic-memory";
import { PATHS } from "@freeanima/platform/config";
import { omitUndefined } from "@freeanima/core/util";
import { memoryRecallSearch, type MemoryRecallResult } from "@freeanima/capabilities-memory/search";
import type { RuntimeDeps } from "./runtime-deps.ts";

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

export async function memorySearch(args: {
  query: string;
  limit?: number;
}): Promise<MemoryRecallResult> {
  const query = args.query.trim();
  if (!query) throw new Error("query is required");
  return memoryRecallSearch(query, omitUndefined({ limit: args.limit }));
}

/** PG STORED content_fts auto-maintained; returns semantic_memory row count */
export async function countSemanticMemoryRows(_deps: RuntimeDeps): Promise<{ index_rows: number }> {
  const count = await countSemanticMemory();
  return { index_rows: count };
}

export async function listMemoryFiles(_deps: RuntimeDeps): Promise<{ files: MemoryFileEntry[] }> {
  const files: MemoryFileEntry[] = [];
  const home = PATHS.home;

  for (const name of ["MEMORY.md", "USER.md"]) {
    const path = join(home, name);
    const entry = readMemoryEntry(path, name);
    if (entry) files.push(entry);
  }

  try {
    const rows = await listAllSemanticMemory();
    for (const row of rows) {
      const name = `${row.id}.md`;
      const content = `---\nid: ${row.id}\ntype: ${row.type}\npinned: ${row.pinned}\ncreated: ${row.created_at}\nupdated: ${row.updated_at}\n---\n${row.content}`;
      files.push({
        name,
        path: `pg:semantic_memory:${row.id}`,
        size: Buffer.byteLength(content, "utf-8"),
        mtime: row.updated_at.getTime() / 1000 || 0,
        content,
      });
    }
  } catch {
    /* When PG unavailable, return Markdown identity file only */
  }

  return { files };
}

export async function listSemanticMemories(
  _deps: RuntimeDeps,
  args: {
    query?: string;
    offset?: number;
    limit?: number;
    types?: string[];
    status?: SemanticMemorySearchOpts["status"];
    source_conversation?: string;
    sort_by?: SemanticMemorySearchOpts["sort_by"];
  } = {},
): Promise<MemoryListResult<SemanticFtsHit>> {
  const { offset, limit } = clampPagination(args.offset, args.limit);
  const sourceSession = args.source_conversation?.trim();
  const filterOpts: Omit<SemanticMemorySearchOpts, "limit" | "offset"> = omitUndefined({
    query: args.query,
    types: args.types,
    status: args.status,
    source_conversations: sourceSession ? [sourceSession] : undefined,
    sort_by: args.sort_by,
  });
  const [items, total] = await Promise.all([
    searchSemanticMemory({ ...filterOpts, offset, limit }),
    countSemanticMemorySearch(filterOpts),
  ]);
  return { items, total, offset, limit };
}

export async function updateSemanticMemoryPinned(
  _deps: RuntimeDeps,
  id: string,
  pinned: boolean,
): Promise<{ ok: true; id: string; pinned: boolean }> {
  const memoryId = id.trim();
  if (!memoryId) throw new Error("id is required");

  const existing = await getSemanticMemory(memoryId);
  if (!existing) throw new Error(`Memory not found: ${memoryId}`);
  if (existing.status !== "active") {
    throw new Error(`Only active memories can be pinned: ${memoryId}`);
  }

  await updateSemanticMemory({ id: memoryId, pinned });
  return { ok: true, id: memoryId, pinned };
}

export async function listLimbicMemories(
  _deps: RuntimeDeps,
  args: LimbicListOpts = {},
): Promise<MemoryListResult<LimbicMemoryRow>> {
  const { offset, limit } = clampPagination(args.offset, args.limit);
  const filterOpts: Omit<LimbicListOpts, "offset" | "limit"> = omitUndefined({
    query: args.query,
    conversation_id: args.conversation_id,
    kind: args.kind,
  });
  const [items, total] = await Promise.all([
    listLimbicMemory({ ...filterOpts, offset, limit }),
    countLimbicMemory(filterOpts),
  ]);
  return { items, total, offset, limit };
}

export async function listAutobiographicalMemories(
  _deps: RuntimeDeps,
  args: AutobiographicalListOpts = {},
): Promise<MemoryListResult<AutobiographicalMemoryRow>> {
  const { offset, limit } = clampPagination(args.offset, args.limit);
  const filterOpts: Omit<AutobiographicalListOpts, "offset" | "limit"> = omitUndefined({
    query: args.query,
    status: args.status,
    significance: args.significance,
    source_conversation: args.source_conversation,
  });
  const [items, total] = await Promise.all([
    listAutobiographicalMemory({ ...filterOpts, offset, limit }),
    countAutobiographicalMemory(filterOpts),
  ]);
  return { items, total, offset, limit };
}
