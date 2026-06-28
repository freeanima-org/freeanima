import { desc, eq, sql as drizzleSql, and, arrayOverlaps } from "drizzle-orm";
import {
  normalizeSemanticMemoryType,
  semanticMemory,
  semanticMemoryStatusSchema,
} from "@freeanima/core/db/schema";
import type {
  SemanticMemoryCreateInput,
  SemanticMemoryRow,
  SemanticMemoryUpdateInput,
} from "@freeanima/core/repos";
import { RESIDENT_PINNED_MAX } from "@freeanima/core/repos";
import { logComponent } from "@freeanima/platform/logging";

const log = logComponent("memory");

import { resolveFtsSegmentedForWrite } from "../../fts/write.ts";
import { scheduleSemanticMemoryEmbedding } from "../../embedding/schedule.ts";
import { clearSemanticMemoryEmbedding } from "../../embedding/store.ts";
import { getDb } from "../../client.ts";
import { nextSemanticMemoryId } from "./id-gen.ts";

function normalizeStatus(raw: string | undefined | null): string {
  const parsed = semanticMemoryStatusSchema.safeParse(String(raw ?? "active").trim());
  return parsed.success ? parsed.data : "active";
}

function normalizeSourceSessions(raw: string[] | undefined): string[] {
  if (!raw) return [];
  return raw.map((s) => s.trim()).filter(Boolean);
}

export async function createSemanticMemory(row: SemanticMemoryCreateInput): Promise<string> {
  const content = row.content.trim();
  if (!content) throw new Error("content is required");

  const id = row.id?.trim() || (await nextSemanticMemoryId());
  const type = normalizeSemanticMemoryType(row.type);
  const pinned = row.pinned ?? false;
  const now = new Date();
  const created = row.created_at ?? now;
  const updated = row.updated_at ?? created;
  const source_conversations = normalizeSourceSessions(row.source_conversations);
  const observed_at = row.observed_at ?? created;
  const occurred_at = row.occurred_at ?? null;
  const status = normalizeStatus(row.status);
  const fts_segmented = await resolveFtsSegmentedForWrite(content);

  const db = getDb();
  await db
    .insert(semanticMemory)
    .values({
      id,
      type,
      pinned,
      content,
      fts_segmented,
      source_conversations,
      observed_at:
        observed_at instanceof Date ? observed_at : observed_at ? new Date(observed_at) : null,
      occurred_at,
      status,
      created_at: created instanceof Date ? created : new Date(created),
      updated_at: updated instanceof Date ? updated : new Date(updated),
    })
    .onConflictDoUpdate({
      target: semanticMemory.id,
      set: {
        type,
        pinned,
        content,
        fts_segmented,
        source_conversations,
        observed_at:
          observed_at instanceof Date ? observed_at : observed_at ? new Date(observed_at) : null,
        occurred_at,
        status,
        updated_at: updated instanceof Date ? updated : new Date(updated),
      },
    });

  scheduleSemanticMemoryEmbedding(id, content);
  return id;
}

export async function getSemanticMemory(id: string): Promise<SemanticMemoryRow | null> {
  const db = getDb();
  const rows = await db.select().from(semanticMemory).where(eq(semanticMemory.id, id)).limit(1);
  const row = rows[0];
  return row ? row : null;
}

export async function updateSemanticMemory(row: SemanticMemoryUpdateInput): Promise<void> {
  const patch: Partial<typeof semanticMemory.$inferInsert> = {
    updated_at: new Date(),
  };
  if (row.content !== undefined) {
    patch.content = row.content.trim();
    patch.fts_segmented = await resolveFtsSegmentedForWrite(patch.content);
    await clearSemanticMemoryEmbedding(row.id);
  }
  if (row.type !== undefined) patch.type = normalizeSemanticMemoryType(row.type);
  if (row.pinned !== undefined) patch.pinned = row.pinned;
  if (row.source_conversations !== undefined) {
    patch.source_conversations = normalizeSourceSessions(row.source_conversations);
  }
  if (row.observed_at !== undefined) {
    patch.observed_at = row.observed_at ? new Date(row.observed_at) : null;
  }
  if (row.occurred_at !== undefined) patch.occurred_at = row.occurred_at;
  if (row.status !== undefined) patch.status = normalizeStatus(row.status);

  const db = getDb();
  await db.update(semanticMemory).set(patch).where(eq(semanticMemory.id, row.id));
  if (patch.content) {
    scheduleSemanticMemoryEmbedding(row.id, patch.content);
  }
}

export async function deprecateSemanticMemory(id: string): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(semanticMemory)
    .set({ status: "deprecated", pinned: false, updated_at: new Date() })
    .where(eq(semanticMemory.id, id))
    .returning({ id: semanticMemory.id });
  return updated.length > 0;
}

export async function deleteSemanticMemory(id: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db.delete(semanticMemory).where(eq(semanticMemory.id, id)).returning({
    id: semanticMemory.id,
  });
  return deleted.length > 0;
}

export async function countSemanticMemory(): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(semanticMemory)
    .where(eq(semanticMemory.status, "active"));
  return Number(rows[0]?.n ?? 0);
}

export async function listResidentSemanticMemory(topN = 20): Promise<SemanticMemoryRow[]> {
  const limit = Math.max(1, Math.min(100, topN));
  const db = getDb();

  const allPinnedRows = await db
    .select()
    .from(semanticMemory)
    .where(and(eq(semanticMemory.status, "active"), eq(semanticMemory.pinned, true)))
    .orderBy(desc(semanticMemory.updated_at));

  if (allPinnedRows.length > RESIDENT_PINNED_MAX) {
    const omitted = allPinnedRows.slice(RESIDENT_PINNED_MAX);
    log.warn("resident pinned count exceeds max; truncating", {
      pinned_count: allPinnedRows.length,
      pinned_max: RESIDENT_PINNED_MAX,
      omitted_ids: omitted.map((r) => r.id),
    });
  }

  const pinnedRows = allPinnedRows.slice(0, RESIDENT_PINNED_MAX);
  const pinnedIds = new Set(pinnedRows.map((r) => r.id));
  const remaining = Math.max(0, limit - pinnedRows.length);

  let topReferenced = pinnedRows;
  if (remaining > 0) {
    const candidates = await db
      .select()
      .from(semanticMemory)
      .where(
        and(
          eq(semanticMemory.status, "active"),
          eq(semanticMemory.pinned, false),
          drizzleSql`${semanticMemory.reference_count} > 0`,
        ),
      )
      .orderBy(desc(semanticMemory.reference_count), desc(semanticMemory.updated_at))
      .limit(remaining + pinnedIds.size);
    const filtered = candidates.filter((r) => !pinnedIds.has(r.id)).slice(0, remaining);
    topReferenced = [...pinnedRows, ...filtered];
  }

  return topReferenced;
}

export async function listAllSemanticMemory(): Promise<SemanticMemoryRow[]> {
  const db = getDb();
  const rows = await db.select().from(semanticMemory).orderBy(desc(semanticMemory.updated_at));
  return rows;
}

export async function listActiveSemanticMemory(): Promise<SemanticMemoryRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(semanticMemory)
    .where(eq(semanticMemory.status, "active"))
    .orderBy(desc(semanticMemory.updated_at));
  return rows;
}

export async function listSemanticMemoryBySourceSessions(
  conversationIds: string[],
  opts?: { status?: "active" | "deprecated" | "all" },
): Promise<SemanticMemoryRow[]> {
  const ids = conversationIds.map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return [];

  const status = opts?.status ?? "active";
  const conditions = [arrayOverlaps(semanticMemory.source_conversations, ids)];
  if (status !== "all") {
    conditions.push(eq(semanticMemory.status, status));
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(semanticMemory)
    .where(and(...conditions))
    .orderBy(desc(semanticMemory.updated_at));
  return rows;
}

export async function findSemanticMemoryByContent(
  content: string,
): Promise<SemanticMemoryRow | null> {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const db = getDb();
  const rows = await db
    .select()
    .from(semanticMemory)
    .where(
      and(
        eq(semanticMemory.status, "active"),
        drizzleSql`btrim(${semanticMemory.content}) = btrim(${trimmed})`,
      ),
    )
    .limit(1);
  const row = rows[0];
  return row ? row : null;
}
