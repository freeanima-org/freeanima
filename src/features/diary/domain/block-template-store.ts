import {
  CONTENT_BLOCK_COMPONENT,
  DIARY_BLOCK_TEMPLATE_COMPONENT,
  asDiaryBlockTemplate,
  diaryBlockTemplatePresetSchema,
} from "@freeanima/host/core/db/schema/entity";
import {
  assertEntityInWorld,
  createEntity,
  deleteEntity,
  getEntity,
  listEntities,
  updateEntity,
} from "@freeanima/host/core/db/pg/entity";
import { omitUndefined } from "@freeanima/host/core/util";

import type {
  DiaryBlockTemplateCreateInput,
  DiaryBlockTemplatePreset,
  DiaryBlockTemplateRow,
  DiaryBlockTemplateUpdateInput,
  DiaryStoreContext,
} from "./types.ts";

const SEED_TEMPLATE_NAMES = ["今日回顾", "运动"] as const;

function normalizePreset(preset: DiaryBlockTemplatePreset): DiaryBlockTemplatePreset {
  const parsed = diaryBlockTemplatePresetSchema.parse(preset);
  const components = parsed.components.map((c) => c.trim()).filter(Boolean);
  if (!components.includes(CONTENT_BLOCK_COMPONENT)) {
    components.unshift(CONTENT_BLOCK_COMPONENT);
  }
  return {
    title: parsed.title.trim(),
    content: parsed.content,
    components: [...new Set(components)],
    tag_ids: [...new Set(parsed.tag_ids)],
  };
}

function toRow(
  parsed: NonNullable<ReturnType<typeof asDiaryBlockTemplate>>,
  meta: { created_at: Date; updated_at: Date },
): DiaryBlockTemplateRow {
  return {
    id: parsed.id,
    name: parsed.name,
    sort_order: parsed.sort_order ?? 0,
    preset: {
      title: parsed.preset.title,
      content: parsed.preset.content,
      components: [...parsed.preset.components],
      tag_ids: [...parsed.preset.tag_ids],
    },
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

async function findByClientOpId(
  worldId: number,
  clientOpId: string,
): Promise<DiaryBlockTemplateRow | null> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: DIARY_BLOCK_TEMPLATE_COMPONENT,
    limit: 200,
  });
  for (const row of rows) {
    const parsed = asDiaryBlockTemplate(row);
    if (!parsed || parsed.client_op_id !== clientOpId) continue;
    return toRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
  }
  return null;
}

export async function listDiaryBlockTemplates(
  ctx: DiaryStoreContext,
): Promise<DiaryBlockTemplateRow[]> {
  await ensureDiaryBlockTemplateSeeds(ctx);
  const rows = await listEntities({
    world_id: ctx.worldId,
    primary_component: DIARY_BLOCK_TEMPLATE_COMPONENT,
    limit: 200,
  });
  const items: DiaryBlockTemplateRow[] = [];
  for (const row of rows) {
    const parsed = asDiaryBlockTemplate(row);
    if (!parsed) continue;
    items.push(toRow(parsed, { created_at: row.created_at, updated_at: row.updated_at }));
  }
  return items.toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export async function createDiaryBlockTemplate(
  ctx: DiaryStoreContext,
  input: DiaryBlockTemplateCreateInput,
): Promise<DiaryBlockTemplateRow> {
  const name = input.name.trim();
  if (name.length === 0) throw new Error("diary block template name is required");

  if (input.client_op_id) {
    const existing = await findByClientOpId(ctx.worldId, input.client_op_id);
    if (existing) return existing;
  }

  let sortOrder = input.sort_order;
  if (sortOrder == null) {
    const existing = await listEntities({
      world_id: ctx.worldId,
      primary_component: DIARY_BLOCK_TEMPLATE_COMPONENT,
      limit: 200,
    });
    let max = -1;
    for (const row of existing) {
      const parsed = asDiaryBlockTemplate(row);
      if (!parsed) continue;
      max = Math.max(max, parsed.sort_order ?? 0);
    }
    sortOrder = max + 1;
  }

  const preset = normalizePreset(input.preset);
  const row = await createEntity({
    type: "content",
    world_id: ctx.worldId,
    components: [DIARY_BLOCK_TEMPLATE_COMPONENT],
    primary_component: DIARY_BLOCK_TEMPLATE_COMPONENT,
    title: name,
    summary: "",
    content: "",
    tag_ids: [],
    body: {
      sort_order: sortOrder,
      client_op_id: input.client_op_id ?? null,
      preset,
    },
  });

  const parsed = asDiaryBlockTemplate(row);
  if (!parsed) throw new Error("diary block template create failed");
  return toRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function updateDiaryBlockTemplate(
  ctx: DiaryStoreContext,
  input: DiaryBlockTemplateUpdateInput,
): Promise<DiaryBlockTemplateRow | null> {
  const existing = await getEntity(input.id);
  if (!existing || existing.primary_component !== DIARY_BLOCK_TEMPLATE_COMPONENT) return null;
  await assertEntityInWorld(input.id, ctx.worldId);

  const parsed = asDiaryBlockTemplate(existing);
  if (!parsed) return null;

  const nextPreset = normalizePreset({
    title: input.preset?.title ?? parsed.preset.title,
    content: input.preset?.content ?? parsed.preset.content,
    components: input.preset?.components ?? parsed.preset.components,
    tag_ids: input.preset?.tag_ids ?? parsed.preset.tag_ids,
  });

  const bodyPatch: Record<string, unknown> = { preset: nextPreset };
  if (input.sort_order !== undefined) bodyPatch.sort_order = input.sort_order;

  const name = input.name !== undefined ? input.name.trim() : undefined;
  if (name !== undefined && name.length === 0) {
    throw new Error("diary block template name is required");
  }

  const row = await updateEntity(
    omitUndefined({
      id: input.id,
      title: name,
      content: "",
      tag_ids: [],
      body: bodyPatch,
    }),
  );
  if (!row) return null;
  const next = asDiaryBlockTemplate(row);
  if (!next) return null;
  return toRow(next, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function deleteDiaryBlockTemplate(
  ctx: DiaryStoreContext,
  id: number,
): Promise<boolean> {
  const existing = await getEntity(id);
  if (!existing || existing.primary_component !== DIARY_BLOCK_TEMPLATE_COMPONENT) return false;
  await assertEntityInWorld(id, ctx.worldId);
  return deleteEntity(id);
}

/** 世界内无任何日记块模板时写入默认种子 */
export async function ensureDiaryBlockTemplateSeeds(ctx: DiaryStoreContext): Promise<void> {
  const rows = await listEntities({
    world_id: ctx.worldId,
    primary_component: DIARY_BLOCK_TEMPLATE_COMPONENT,
    limit: 1,
  });
  if (rows.length > 0) return;

  for (const [index, name] of SEED_TEMPLATE_NAMES.entries()) {
    await createEntity({
      type: "content",
      world_id: ctx.worldId,
      components: [DIARY_BLOCK_TEMPLATE_COMPONENT],
      primary_component: DIARY_BLOCK_TEMPLATE_COMPONENT,
      title: name,
      summary: "",
      content: "",
      tag_ids: [],
      body: {
        sort_order: index,
        client_op_id: null,
        preset: {
          title: name,
          content: "",
          components: [CONTENT_BLOCK_COMPONENT],
          tag_ids: [],
        },
      },
    });
  }
}
