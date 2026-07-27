import {
  OBJECT_FILE_COMPONENT,
  asObjectFile,
  objectFileBodySchema,
  type ObjectFileBody,
} from "@freeanima/host/core/db/schema/entity";
import {
  createEntity,
  deleteEntity,
  getEntity,
  listEntities,
  updateEntity,
} from "@freeanima/host/core/db/pg/entity";
import { omitUndefined } from "@freeanima/host/core/util";

import { getObjectStore } from "./object-store.ts";

export type ObjectFileRow = ObjectFileBody & {
  id: number;
  title: string;
  world_id: number;
  created_at: string;
  updated_at: string;
};

function toRow(
  parsed: NonNullable<ReturnType<typeof asObjectFile>>,
  meta: { created_at: Date; updated_at: Date },
): ObjectFileRow {
  return {
    id: parsed.id,
    title: parsed.title,
    world_id: parsed.world_id,
    cid: parsed.cid,
    size: parsed.size,
    mime_type: parsed.mime_type,
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

export async function createObjectFile(input: {
  world_id: number;
  title: string;
  bytes: Uint8Array;
  mime_type?: string;
}): Promise<ObjectFileRow> {
  const title = input.title.trim();
  if (!title) throw new Error("title is required");
  const put = await getObjectStore().put(input.world_id, input.bytes);
  const body = objectFileBodySchema.parse({
    cid: put.cid,
    size: put.size,
    mime_type: input.mime_type?.trim() || "application/octet-stream",
  });
  const row = await createEntity({
    type: "content",
    world_id: input.world_id,
    components: [OBJECT_FILE_COMPONENT],
    primary_component: OBJECT_FILE_COMPONENT,
    title,
    body,
  });
  const parsed = asObjectFile(row);
  if (!parsed) throw new Error("object_file create failed");
  return toRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function getObjectFile(id: number): Promise<ObjectFileRow | null> {
  const row = await getEntity(id);
  if (!row) return null;
  const parsed = asObjectFile(row);
  if (!parsed) return null;
  return toRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function listObjectFiles(opts: {
  world_id: number;
  limit?: number;
  offset?: number;
}): Promise<ObjectFileRow[]> {
  const rows = await listEntities({
    world_id: opts.world_id,
    primary_component: OBJECT_FILE_COMPONENT,
    limit: opts.limit ?? 50,
    offset: opts.offset ?? 0,
  });
  const out: ObjectFileRow[] = [];
  for (const row of rows) {
    const parsed = asObjectFile(row);
    if (parsed) out.push(toRow(parsed, { created_at: row.created_at, updated_at: row.updated_at }));
  }
  return out;
}

export async function updateObjectFile(input: {
  id: number;
  title?: string;
  bytes?: Uint8Array;
  mime_type?: string;
}): Promise<ObjectFileRow> {
  const existing = await getObjectFile(input.id);
  if (!existing) throw new Error("object_file not found");

  let body: ObjectFileBody = {
    cid: existing.cid,
    size: existing.size,
    mime_type: existing.mime_type,
  };
  if (input.bytes) {
    const put = await getObjectStore().put(existing.world_id, input.bytes);
    body = objectFileBodySchema.parse({
      cid: put.cid,
      size: put.size,
      mime_type: input.mime_type?.trim() || existing.mime_type,
    });
  } else if (input.mime_type != null) {
    body = objectFileBodySchema.parse({
      ...body,
      mime_type: input.mime_type.trim() || existing.mime_type,
    });
  }

  const updated = await updateEntity(
    omitUndefined({
      id: input.id,
      title: input.title?.trim(),
      body,
    }),
  );
  if (!updated) throw new Error("object_file update failed");
  const parsed = asObjectFile(updated);
  if (!parsed) throw new Error("object_file parse failed");
  return toRow(parsed, { created_at: updated.created_at, updated_at: updated.updated_at });
}

export async function deleteObjectFile(id: number): Promise<void> {
  await deleteEntity(id);
}

export async function downloadObjectFileBytes(id: number): Promise<{
  file: ObjectFileRow;
  bytes: Uint8Array;
}> {
  const file = await getObjectFile(id);
  if (!file) throw new Error("object_file not found");
  const bytes = await getObjectStore().get(file.world_id, file.cid);
  return { file, bytes };
}
