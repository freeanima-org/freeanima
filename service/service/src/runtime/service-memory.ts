import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "@freeanima/service-config";
import { getServiceContext } from "../context.ts";
import { distillAll } from "@freeanima/life-memory/clean";
import { reindexL2All as reindexL2FtsAll } from "@freeanima/life-memory/l2-indexer";
import { indexL3All as reindexL3FtsAll } from "@freeanima/life-memory/l3-indexer";
import { memorySearchDetailed, type MemorySearchResult } from "@freeanima/life-memory/search";

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

export function memorySearch(args: {
  query: string;
  limit?: number;
  session_limit?: number;
  session?: string;
}): MemorySearchResult {
  const query = args.query.trim();
  if (!query) throw new Error("query is required");
  return memorySearchDetailed(query, {
    l3Limit: args.limit,
    l2Limit: args.session_limit,
    sessionId: args.session?.trim() || undefined,
  });
}

export async function distillL2All(): Promise<{ sessions: number }> {
  const store = getServiceContext().conversation.repos.session;
  return { sessions: await distillAll(store, { overwrite: true }) };
}

export function reindexL2All(): { index_rows: number } {
  return { index_rows: reindexL2FtsAll({ dropFirst: true }) };
}

export function reindexL3All(): { index_rows: number } {
  return { index_rows: reindexL3FtsAll({ dropFirst: true }) };
}

export async function rebuildL2All(): Promise<{ sessions: number; index_rows: number }> {
  const store = getServiceContext().conversation.repos.session;
  const sessions = await distillAll(store, { overwrite: true });
  const index_rows = reindexL2FtsAll({ dropFirst: true });
  return { sessions, index_rows };
}

export function listMemoryFiles(): { files: MemoryFileEntry[] } {
  const files: MemoryFileEntry[] = [];
  const home = PATHS.home;

  for (const name of ["SOUL.md", "MEMORY.md", "USER.md"]) {
    const path = name === "SOUL.md" ? PATHS.soul : join(home, name);
    const entry = readMemoryEntry(path, name);
    if (entry) files.push(entry);
  }

  try {
    if (existsSync(PATHS.memory)) {
      for (const name of readdirSync(PATHS.memory).toSorted()) {
        if (!name.startsWith("f-") || !name.endsWith(".md")) continue;
        const path = join(PATHS.memory, name);
        const entry = readMemoryEntry(path, name);
        if (entry) files.push(entry);
      }
    }
  } catch {
    /* empty */
  }

  return { files };
}
