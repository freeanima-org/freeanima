import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { searchDocuments } from "@freeanima/habitat/core/db/schema";
import { omitUndefined } from "@freeanima/habitat/core/util";

import { getDb } from "../../client.ts";
import { formatPgVector } from "../../embedding/format.ts";
import { resolveFtsSegmentedForWrite } from "../../fts/write.ts";
import { fuseSearchHits } from "../fusion.ts";
import { searchDocKey } from "../doc-key.ts";
import type { SearchBackend, SearchChannel, SearchDoc, SearchHit, SearchQuery } from "../types.ts";
import { UnsupportedSearchChannelError } from "../types.ts";
import { searchPgIndexFts } from "./channel-fts.ts";
import { searchPgIndexTrgm } from "./channel-trgm.ts";
import { searchPgIndexVector } from "./channel-vector.ts";

const SUPPORTED: SearchChannel[] = ["fts", "trgm", "vector"];

async function upsertOne(doc: SearchDoc): Promise<void> {
  if (doc.indexable === false) {
    await getDb().delete(searchDocuments).where(eq(searchDocuments.doc_key, doc.doc_key));
    return;
  }

  const title = doc.title ?? "";
  const summary = doc.summary ?? "";
  const content = doc.content ?? "";
  const textForSegment = [title, summary, content].filter(Boolean).join("\n").trim();
  const fts_segmented =
    doc.fts_segmented !== undefined
      ? doc.fts_segmented
      : await resolveFtsSegmentedForWrite(textForSegment);

  const now = new Date();
  const values = omitUndefined({
    doc_key: doc.doc_key,
    resource: doc.resource,
    source_id: doc.source_id,
    world_id: doc.world_id ?? null,
    subject_id: doc.subject_id ?? null,
    primary_component: doc.primary_component ?? null,
    conversation_id: doc.conversation_id ?? null,
    message_role: doc.message_role ?? null,
    deleted_at: doc.deleted_at ?? null,
    title,
    summary,
    content,
    fts_segmented,
    updated_at: now,
  });

  await getDb()
    .insert(searchDocuments)
    .values({ ...values, created_at: now })
    .onConflictDoUpdate({
      target: searchDocuments.doc_key,
      set: {
        world_id: values.world_id,
        subject_id: values.subject_id,
        primary_component: values.primary_component,
        conversation_id: values.conversation_id,
        message_role: values.message_role,
        deleted_at: values.deleted_at,
        title: values.title,
        summary: values.summary,
        content: values.content,
        fts_segmented: values.fts_segmented,
        updated_at: now,
      },
    });
}

export function createPgSearchIndexBackend(): SearchBackend {
  return {
    id: "pg_search_index",
    supportedChannels: () => [...SUPPORTED],

    async upsert(docs: SearchDoc[]): Promise<void> {
      for (const doc of docs) {
        await upsertOne(doc);
      }
    },

    async delete(docKeys: string[]): Promise<void> {
      if (docKeys.length === 0) return;
      await getDb().delete(searchDocuments).where(inArray(searchDocuments.doc_key, docKeys));
    },

    async rebuild(docs: SearchDoc[]): Promise<number> {
      let n = 0;
      for (const doc of docs) {
        await upsertOne(doc);
        n += 1;
      }
      return n;
    },

    async search(query: SearchQuery): Promise<SearchHit[]> {
      const unsupported = query.channels.filter((c) => !SUPPORTED.includes(c));
      if (unsupported.length > 0) {
        throw new UnsupportedSearchChannelError("pg_search_index", unsupported);
      }
      const q = query.text.trim();
      if (!q || query.channels.length === 0) return [];

      const limit = Math.max(1, Math.min(200, query.limit ?? 10));
      const byChannel: Partial<Record<SearchChannel, SearchHit[]>> = {};

      await Promise.all(
        query.channels.map(async (ch) => {
          if (ch === "fts") {
            byChannel.fts = await searchPgIndexFts(q, query.filters, limit);
          } else if (ch === "trgm") {
            byChannel.trgm = await searchPgIndexTrgm(q, query.filters, limit);
          } else if (ch === "vector") {
            byChannel.vector = await searchPgIndexVector(q, query.filters, limit);
          }
        }),
      );

      return fuseSearchHits(byChannel, {
        limit,
        fuse: query.fuse ?? (query.channels.length > 1 ? "rrf" : "none"),
      });
    },
  };
}

export async function setSearchDocumentEmbedding(
  resource: "entity" | "message",
  sourceId: string | number,
  embedding: number[],
): Promise<boolean> {
  const doc_key = searchDocKey(resource, sourceId);
  const rows = await getDb()
    .update(searchDocuments)
    .set({
      embedding: sql`${formatPgVector(embedding)}::vector`,
      updated_at: new Date(),
    })
    .where(eq(searchDocuments.doc_key, doc_key))
    .returning({ doc_key: searchDocuments.doc_key });
  return rows.length > 0;
}

export async function clearSearchDocumentEmbedding(
  resource: "entity" | "message",
  sourceId: string | number,
): Promise<void> {
  const doc_key = searchDocKey(resource, sourceId);
  await getDb()
    .update(searchDocuments)
    .set({ embedding: null, cluster_id: null, updated_at: new Date() })
    .where(eq(searchDocuments.doc_key, doc_key));
}

export async function setSearchDocumentClusterId(
  resource: "entity" | "message",
  sourceId: string | number,
  clusterId: number | null,
): Promise<boolean> {
  const doc_key = searchDocKey(resource, sourceId);
  const rows = await getDb()
    .update(searchDocuments)
    .set({ cluster_id: clusterId, updated_at: new Date() })
    .where(eq(searchDocuments.doc_key, doc_key))
    .returning({ doc_key: searchDocuments.doc_key });
  return rows.length > 0;
}

/** Batch-update cluster_id by entity source_id (resource=entity). */
export async function patchEntitySearchDocumentClusterIds(
  patches: ReadonlyArray<{ sourceId: number; clusterId: number | null }>,
): Promise<number> {
  if (patches.length === 0) return 0;
  let updated = 0;
  const now = new Date();
  for (const patch of patches) {
    const doc_key = searchDocKey("entity", patch.sourceId);
    const rows = await getDb()
      .update(searchDocuments)
      .set({ cluster_id: patch.clusterId, updated_at: now })
      .where(eq(searchDocuments.doc_key, doc_key))
      .returning({ doc_key: searchDocuments.doc_key });
    if (rows.length > 0) updated += 1;
  }
  return updated;
}

export async function listSearchDocumentKeys(
  resource: "entity" | "message",
  opts?: { onlyMissingSegmented?: boolean; afterSourceId?: string; limit?: number },
): Promise<Array<{ doc_key: string; source_id: string }>> {
  const limit = opts?.limit ?? 100;
  const conditions = [eq(searchDocuments.resource, resource)];
  if (opts?.onlyMissingSegmented) {
    conditions.push(sql`nullif(btrim(${searchDocuments.fts_segmented}), '') IS NULL`);
  }
  if (opts?.afterSourceId) {
    conditions.push(sql`${searchDocuments.source_id} > ${opts.afterSourceId}`);
  }
  return getDb()
    .select({
      doc_key: searchDocuments.doc_key,
      source_id: searchDocuments.source_id,
    })
    .from(searchDocuments)
    .where(and(...conditions))
    .orderBy(asc(searchDocuments.source_id))
    .limit(limit);
}
