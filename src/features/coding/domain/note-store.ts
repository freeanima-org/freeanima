/**
 * 项目 World 内 coding_note 实体。
 * 经 Habitat RPC 写入；domain 不依赖 Habitat client。
 */

import {
  countEntities,
  createEntity,
  getEntity,
  listEntities,
} from "@freeanima/host/core/db/pg/entity";
import {
  CODING_NOTE_COMPONENT,
  codingNoteBodySchema,
} from "@freeanima/host/core/db/schema/entity/components/coding-note.ts";
import { worldConfigBodySchema } from "@freeanima/host/core/db/schema/entity/components/world-config.ts";

export type CodingNoteRow = {
  id: number;
  world_id: number;
  title: string;
  summary: string;
  kind?: string;
  created_at: Date;
  updated_at: Date;
};

async function assertProjectWorld(worldId: number): Promise<void> {
  const world = await getEntity(worldId);
  if (!world || world.type !== "world") {
    throw new Error("project world not found");
  }
  const parsed = worldConfigBodySchema.safeParse(world.body);
  if (!parsed.success) {
    throw new Error("invalid world_config body");
  }
}

function asNote(row: {
  id: number;
  world_id: number;
  title: string;
  summary: string;
  primary_component: string | null;
  body: unknown;
  created_at: Date;
  updated_at: Date;
}): CodingNoteRow | null {
  if (row.primary_component !== CODING_NOTE_COMPONENT) return null;
  const body = codingNoteBodySchema.safeParse(row.body ?? {});
  if (!body.success) return null;
  return {
    id: row.id,
    world_id: row.world_id,
    title: row.title,
    summary: row.summary,
    ...(body.data.kind ? { kind: body.data.kind } : {}),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function createCodingNote(input: {
  world_id: number;
  title: string;
  summary?: string;
  content?: string;
  kind?: string;
}): Promise<CodingNoteRow> {
  await assertProjectWorld(input.world_id);
  const title = input.title.trim();
  if (!title) throw new Error("title is required");
  const bodyParsed = codingNoteBodySchema.safeParse(
    input.kind?.trim() ? { kind: input.kind.trim() } : {},
  );
  if (!bodyParsed.success) throw new Error("invalid coding_note body");

  const created = await createEntity({
    type: "content",
    world_id: input.world_id,
    components: [CODING_NOTE_COMPONENT],
    primary_component: CODING_NOTE_COMPONENT,
    title,
    summary: input.summary?.trim() ?? "",
    content: input.content ?? "",
    body: bodyParsed.data,
  });
  const note = asNote(created);
  if (!note) throw new Error("coding_note create failed");
  return note;
}

export async function listCodingNotes(opts: {
  world_id: number;
  limit?: number;
  offset?: number;
}): Promise<{ items: CodingNoteRow[]; count: number }> {
  await assertProjectWorld(opts.world_id);
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const filter = {
    world_id: opts.world_id,
    type: "content" as const,
    primary_component: CODING_NOTE_COMPONENT,
  };
  const [rows, count] = await Promise.all([
    listEntities({ ...filter, limit, offset, order_by: "updated_at", order_dir: "desc" }),
    countEntities(filter),
  ]);
  const items = rows.map(asNote).filter((x): x is CodingNoteRow => x != null);
  return { items, count };
}
