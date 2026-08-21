import {
  appendDiaryEntry,
  createDiaryBlockTemplate,
  createDiaryEntry,
  createDiaryTextBlock,
  deleteDiaryBlockTemplate,
  deleteDiaryEntry,
  deleteDiaryTextBlock,
  getDiaryEntry,
  listDiaryBlockTemplates,
  listDiaryEntries,
  reorderDiaryTextBlocks,
  resolveDiaryWorldId,
  searchDiaryEntries,
  updateDiaryBlockTemplate,
  updateDiaryEntry,
  updateDiaryTextBlock,
  type DiaryBlockTemplatePreset,
} from "../domain/index.ts";

import { DIARY_ENTRY_COMPONENT } from "@freeanima/habitat/core/db/schema";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { suggestTags } from "@freeanima/features/tag/domain/index.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

async function storeContext(_deps: RuntimeDeps, subjectId: number) {
  const worldId = await resolveDiaryWorldId(subjectId);
  return { worldId };
}

export async function serviceDiaryList(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    entry_after?: string;
    entry_before?: string;
    tag_ids?: number[];
    limit?: number;
    offset?: number;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const items = await listDiaryEntries(
    ctx,
    omitUndefined({
      entry_after: input.entry_after,
      entry_before: input.entry_before,
      tag_ids: input.tag_ids,
      limit: input.limit,
      offset: input.offset,
    }),
  );
  return { items };
}

export async function serviceDiaryCreate(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    title: string;
    content?: string;
    summary?: string;
    entry_at: string;
    tags?: string[];
    tag_ids?: number[];
    client_op_id?: string;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const item = await createDiaryEntry(ctx, input);
  return { item };
}

export async function serviceDiaryAppend(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    id: number;
    content: string;
    client_op_id?: string;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const item = await appendDiaryEntry(ctx, input);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceDiaryPatch(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    id: number;
    title?: string;
    summary?: string;
    entry_at?: string;
    tags?: string[];
    tag_ids?: number[];
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const { id, subject_id: _sid, ...patch } = input;
  const item = await updateDiaryEntry(ctx, { id, ...patch });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceDiaryDelete(
  deps: RuntimeDeps,
  input: { subject_id: number; id: number },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const ok = await deleteDiaryEntry(ctx, input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceDiaryGet(
  deps: RuntimeDeps,
  input: { subject_id: number; id: number },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const item = await getDiaryEntry(ctx, input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceDiarySearch(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    query: string;
    entry_after?: string;
    entry_before?: string;
    tag_ids?: number[];
    limit?: number;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const items = await searchDiaryEntries(ctx, input);
  // UI 列表/离线缓存仍按「壳 + 空 blocks」；命中摘要仅经 diary_search 工具返回
  return { items: items.map((item) => ({ ...item, blocks: [] as typeof item.blocks })) };
}

export async function serviceDiaryBlockCreate(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    parent_id: number;
    content: string;
    title?: string;
    tag_ids?: number[];
    components?: string[];
    sort_order?: number;
    client_op_id?: string;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const item = await createDiaryTextBlock(
    ctx,
    omitUndefined({
      parent_id: input.parent_id,
      content: input.content,
      title: input.title,
      tag_ids: input.tag_ids,
      components: input.components,
      sort_order: input.sort_order,
      client_op_id: input.client_op_id,
    }),
  );
  return { item };
}

export async function serviceDiaryBlockPatch(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    id: number;
    content?: string;
    title?: string;
    tag_ids?: number[];
    sort_order?: number;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const item = await updateDiaryTextBlock(
    ctx,
    omitUndefined({
      id: input.id,
      content: input.content,
      title: input.title,
      tag_ids: input.tag_ids,
      sort_order: input.sort_order,
    }),
  );
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceDiaryBlockDelete(
  deps: RuntimeDeps,
  input: { subject_id: number; id: number },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const ok = await deleteDiaryTextBlock(ctx, input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceDiaryBlockReorder(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    items: Array<{ id: number; sort_order: number }>;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const items = await reorderDiaryTextBlocks(ctx, input.items);
  return { items };
}

export async function serviceDiaryTemplateList(deps: RuntimeDeps, input: { subject_id: number }) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const items = await listDiaryBlockTemplates(ctx);
  return { items };
}

export async function serviceDiaryTemplateCreate(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    name: string;
    preset: DiaryBlockTemplatePreset;
    sort_order?: number;
    client_op_id?: string;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const item = await createDiaryBlockTemplate(
    ctx,
    omitUndefined({
      name: input.name,
      preset: input.preset,
      sort_order: input.sort_order,
      client_op_id: input.client_op_id,
    }),
  );
  return { item };
}

export async function serviceDiaryTemplatePatch(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    id: number;
    name?: string;
    preset?: Partial<DiaryBlockTemplatePreset>;
    sort_order?: number;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const item = await updateDiaryBlockTemplate(
    ctx,
    omitUndefined({
      id: input.id,
      name: input.name,
      preset: input.preset,
      sort_order: input.sort_order,
    }),
  );
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceDiaryTemplateDelete(
  deps: RuntimeDeps,
  input: { subject_id: number; id: number },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const ok = await deleteDiaryBlockTemplate(ctx, input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceDiarySuggestTags(
  deps: RuntimeDeps,
  input: { subject_id: number; query?: string; limit?: number },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const items = await suggestTags(
    ctx.worldId,
    DIARY_ENTRY_COMPONENT,
    omitUndefined({ query: input.query, limit: input.limit }),
  );
  return { items };
}
