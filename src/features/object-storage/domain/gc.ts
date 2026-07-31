import { OBJECT_FILE_COMPONENT, objectCidSchema } from "@freeanima/host/core/db/schema/entity";
import { countObjectFileCidRefs, type PurgedEntityRow } from "@freeanima/host/core/db/pg/entity";

import { getObjectStore } from "./object-store.ts";

export type GcObjectBlobsResult = {
  candidates: number;
  deleted: number;
  skipped_referenced: number;
  skipped_errors: number;
};

export type GcObjectBlobsDeps = {
  countRefs?: (worldId: number, cid: string) => Promise<number>;
  deleteBlob?: (worldId: number, cid: string) => Promise<void>;
  onError?: (worldId: number, cid: string, err: unknown) => void;
};

function extractObjectFileCid(row: PurgedEntityRow): string | null {
  if (row.primary_component !== OBJECT_FILE_COMPONENT) return null;
  const body = row.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const raw = (body as { cid?: unknown }).cid;
  if (typeof raw !== "string") return null;
  const parsed = objectCidSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * 实体物理 purge 之后：对已无引用的 object_file cid 删除对象存储 blob（及本地缓存）。
 * 软删阶段不调用本函数，以便回收站 restore 仍可读字节。
 */
export async function gcObjectBlobsAfterEntityPurge(
  rows: PurgedEntityRow[],
  deps?: GcObjectBlobsDeps,
): Promise<GcObjectBlobsResult> {
  const countRefs = deps?.countRefs ?? countObjectFileCidRefs;
  const deleteBlob = deps?.deleteBlob ?? ((worldId, cid) => getObjectStore().delete(worldId, cid));
  const onError =
    deps?.onError ??
    ((worldId, cid, err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[object-storage] GC delete failed world=${worldId} cid=${cid}: ${msg}`);
    });

  const unique = new Map<string, { world_id: number; cid: string }>();
  for (const row of rows) {
    const cid = extractObjectFileCid(row);
    if (!cid) continue;
    unique.set(`${row.world_id}:${cid}`, { world_id: row.world_id, cid });
  }

  const result: GcObjectBlobsResult = {
    candidates: unique.size,
    deleted: 0,
    skipped_referenced: 0,
    skipped_errors: 0,
  };

  for (const { world_id, cid } of unique.values()) {
    try {
      const refs = await countRefs(world_id, cid);
      if (refs > 0) {
        result.skipped_referenced += 1;
        continue;
      }
      await deleteBlob(world_id, cid);
      result.deleted += 1;
    } catch (err) {
      result.skipped_errors += 1;
      onError(world_id, cid, err);
    }
  }

  return result;
}
