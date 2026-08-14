import {
  OBJECT_FOLDER_COMPONENT,
  asObjectFolder,
  objectFolderBodySchema,
  type ObjectFolderBody,
} from "@freeanima/habitat/core/db/schema/entity";
import {
  createEntity,
  deleteEntity,
  getEntity,
  listEntities,
  updateEntity,
} from "@freeanima/habitat/core/db/pg/entity";
import { omitUndefined } from "@freeanima/habitat/core/util";

import { getObjectFile } from "./file-store.ts";

export type ObjectFolderRow = ObjectFolderBody & {
  id: number;
  title: string;
  world_id: number;
  created_at: string;
  updated_at: string;
};

function toRow(
  parsed: NonNullable<ReturnType<typeof asObjectFolder>>,
  meta: { created_at: Date; updated_at: Date },
): ObjectFolderRow {
  return {
    id: parsed.id,
    title: parsed.title,
    world_id: parsed.world_id,
    parent_id: parsed.parent_id ?? null,
    file_ids: parsed.file_ids,
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

export async function createObjectFolder(input: {
  world_id: number;
  title: string;
  parent_id?: number | null;
}): Promise<ObjectFolderRow> {
  const title = input.title.trim();
  if (!title) throw new Error("title is required");
  const body = objectFolderBodySchema.parse({
    parent_id: input.parent_id ?? null,
    file_ids: [],
  });
  const row = await createEntity({
    type: "content",
    world_id: input.world_id,
    components: [OBJECT_FOLDER_COMPONENT],
    primary_component: OBJECT_FOLDER_COMPONENT,
    title,
    body,
  });
  const parsed = asObjectFolder(row);
  if (!parsed) throw new Error("object_folder create failed");
  return toRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function getObjectFolder(id: number): Promise<ObjectFolderRow | null> {
  const row = await getEntity(id);
  if (!row) return null;
  const parsed = asObjectFolder(row);
  if (!parsed) return null;
  return toRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function listObjectFolders(opts: {
  world_id: number;
  parent_id?: number | null;
  limit?: number;
  offset?: number;
}): Promise<ObjectFolderRow[]> {
  const rows = await listEntities({
    world_id: opts.world_id,
    primary_component: OBJECT_FOLDER_COMPONENT,
    limit: opts.limit ?? 100,
    offset: opts.offset ?? 0,
  });
  const out: ObjectFolderRow[] = [];
  for (const row of rows) {
    const parsed = asObjectFolder(row);
    if (!parsed) continue;
    if (opts.parent_id !== undefined) {
      const pid = parsed.parent_id ?? null;
      if (pid !== (opts.parent_id ?? null)) continue;
    }
    out.push(toRow(parsed, { created_at: row.created_at, updated_at: row.updated_at }));
  }
  return out;
}

export async function updateObjectFolder(input: {
  id: number;
  title?: string;
  parent_id?: number | null;
  file_ids?: number[];
}): Promise<ObjectFolderRow> {
  const existing = await getObjectFolder(input.id);
  if (!existing) throw new Error("object_folder not found");

  const body = objectFolderBodySchema.parse({
    parent_id: input.parent_id !== undefined ? input.parent_id : existing.parent_id,
    file_ids: input.file_ids ?? existing.file_ids,
  });

  const updated = await updateEntity(
    omitUndefined({
      id: input.id,
      title: input.title?.trim(),
      body,
    }),
  );
  if (!updated) throw new Error("object_folder update failed");
  const parsed = asObjectFolder(updated);
  if (!parsed) throw new Error("object_folder parse failed");
  return toRow(parsed, { created_at: updated.created_at, updated_at: updated.updated_at });
}

export async function addFileToObjectFolder(
  folderId: number,
  fileId: number,
): Promise<ObjectFolderRow> {
  const folder = await getObjectFolder(folderId);
  if (!folder) throw new Error("object_folder not found");
  const file = await getObjectFile(fileId);
  if (!file) throw new Error("object_file not found");
  if (file.world_id !== folder.world_id) {
    throw new Error("object_file and object_folder must share world");
  }
  if (folder.file_ids.includes(fileId)) return folder;
  return updateObjectFolder({ id: folderId, file_ids: [...folder.file_ids, fileId] });
}

export async function removeFileFromObjectFolder(
  folderId: number,
  fileId: number,
): Promise<ObjectFolderRow> {
  const folder = await getObjectFolder(folderId);
  if (!folder) throw new Error("object_folder not found");
  return updateObjectFolder({
    id: folderId,
    file_ids: folder.file_ids.filter((id) => id !== fileId),
  });
}

export async function deleteObjectFolder(id: number): Promise<void> {
  await deleteEntity(id);
}
