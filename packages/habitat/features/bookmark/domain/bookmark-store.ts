import {
  BOOKMARK_COMPONENT,
  asBookmark,
  type BookmarkBody,
} from "@freeanima/habitat/core/db/schema/entity";
import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  assertEntityInWorld,
  createEntity,
  deleteEntity,
  getEntity,
  restoreEntity,
  searchEntities,
  updateEntity,
} from "@freeanima/habitat/core/db/pg/entity";

import type {
  BookmarkCreateInput,
  BookmarkKind,
  BookmarkListOpts,
  BookmarkPullOpts,
  BookmarkRow,
  BookmarkSearchOpts,
  BookmarkUpdateInput,
  BookmarkUpsertInput,
} from "./types.ts";

function toBookmarkRow(row: NonNullable<ReturnType<typeof asBookmark>>): BookmarkRow {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    url: row.url ?? null,
    parent_id: row.parent_id ?? null,
    sort_order: row.sort_order ?? 0,
    browser_id: row.browser_id ?? null,
    deleted_at: row.deleted_at ? row.deleted_at.toISOString() : null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function sortBookmarks(a: BookmarkRow, b: BookmarkRow): number {
  return a.sort_order - b.sort_order || a.title.localeCompare(b.title) || a.id - b.id;
}

function assertBookmarkInWorld(
  existing: Awaited<ReturnType<typeof getEntity>>,
  worldId: number,
): existing is NonNullable<typeof existing> {
  if (!existing || existing.primary_component !== BOOKMARK_COMPONENT) return false;
  return existing.world_id === worldId;
}

function buildBody(input: {
  kind: BookmarkKind;
  url: string | null;
  parent_id: number | null;
  sort_order: number;
  browser_id: string | null;
  client_op_id: string | null;
}): BookmarkBody {
  return {
    kind: input.kind,
    url: input.kind === "url" ? input.url : null,
    parent_id: input.parent_id,
    sort_order: input.sort_order,
    browser_id: input.browser_id,
    client_op_id: input.client_op_id,
  };
}

function contentFor(kind: BookmarkKind, url?: string | null): string {
  return kind === "url" ? (url?.trim() ?? "") : "";
}

export async function findBookmarkByBrowserId(
  worldId: number,
  browserId: string,
  opts?: { include_deleted?: boolean },
): Promise<BookmarkRow | null> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: BOOKMARK_COMPONENT,
    filters: { browser_id: browserId },
    limit: 1,
    mode: "filter_only",
    include_count: false,
    deleted: opts?.include_deleted ? "all" : "alive",
  });
  const row = result.results[0];
  if (!row) return null;
  const parsed = asBookmark(row);
  return parsed ? toBookmarkRow(parsed) : null;
}

export async function listBookmarks(
  worldId: number,
  opts: BookmarkListOpts = {},
): Promise<BookmarkRow[]> {
  const filters: Record<string, unknown> = {};
  if (opts.kind) filters.kind = opts.kind;
  if (opts.parent_id === null) filters.parent_id = null;
  else if (opts.parent_id != null) filters.parent_id = opts.parent_id;

  const result = await searchEntities({
    world_id: worldId,
    primary_component: BOOKMARK_COMPONENT,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    limit: opts.limit ?? 2000,
    offset: opts.offset ?? 0,
    mode: "filter_only",
    include_count: false,
  });

  return result.results
    .map((row) => {
      const parsed = asBookmark(row);
      return parsed ? toBookmarkRow(parsed) : null;
    })
    .filter((row): row is BookmarkRow => row != null)
    .toSorted(sortBookmarks);
}

export async function getBookmark(worldId: number, id: number): Promise<BookmarkRow | null> {
  const existing = await getEntity(id);
  if (!assertBookmarkInWorld(existing, worldId)) return null;
  const parsed = asBookmark(existing);
  return parsed ? toBookmarkRow(parsed) : null;
}

export async function searchBookmarks(
  worldId: number,
  opts: BookmarkSearchOpts,
): Promise<{ items: BookmarkRow[]; count: number }> {
  const query = opts.query.trim();
  const result = await searchEntities({
    world_id: worldId,
    primary_component: BOOKMARK_COMPONENT,
    query,
    limit: opts.limit ?? 100,
    offset: opts.offset ?? 0,
    mode: "hybrid",
  });
  const items = result.results
    .map((row) => {
      const parsed = asBookmark(row);
      return parsed ? toBookmarkRow(parsed) : null;
    })
    .filter((row): row is BookmarkRow => row != null);
  return { items, count: result.count };
}

export async function createBookmark(
  worldId: number,
  input: BookmarkCreateInput,
): Promise<BookmarkRow> {
  if (input.client_op_id) {
    const byOp = await findByClientOpId(worldId, input.client_op_id);
    if (byOp) return byOp;
  }
  if (input.browser_id) {
    const byBrowser = await findBookmarkByBrowserId(worldId, input.browser_id, {
      include_deleted: true,
    });
    if (byBrowser && !byBrowser.deleted_at) return byBrowser;
  }

  const title = input.title.trim() || (input.kind === "folder" ? "未命名文件夹" : "未命名书签");
  const body = buildBody({
    kind: input.kind,
    url: input.url ?? null,
    parent_id: input.parent_id ?? null,
    sort_order: input.sort_order ?? 0,
    browser_id: input.browser_id ?? null,
    client_op_id: input.client_op_id ?? null,
  });
  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [BOOKMARK_COMPONENT],
    primary_component: BOOKMARK_COMPONENT,
    title,
    summary: "",
    content: contentFor(input.kind, input.url),
    body,
  });
  const parsed = asBookmark(row);
  if (!parsed) throw new Error("bookmark create parse failed");
  return toBookmarkRow(parsed);
}

export async function updateBookmark(
  worldId: number,
  input: BookmarkUpdateInput,
): Promise<BookmarkRow | null> {
  const existing = await getEntity(input.id);
  if (!assertBookmarkInWorld(existing, worldId)) return null;
  const current = asBookmark(existing);
  if (!current) return null;

  const kind = input.kind ?? current.kind;
  const url = input.url !== undefined ? input.url : (current.url ?? null);
  const parent_id = input.parent_id !== undefined ? input.parent_id : (current.parent_id ?? null);
  const sort_order = input.sort_order !== undefined ? input.sort_order : (current.sort_order ?? 0);
  const browser_id =
    input.browser_id !== undefined ? input.browser_id : (current.browser_id ?? null);
  const client_op_id =
    input.client_op_id !== undefined ? input.client_op_id : (current.client_op_id ?? null);

  const title = input.title !== undefined ? input.title.trim() || current.title : current.title;

  const updated = await updateEntity({
    id: input.id,
    title,
    content: contentFor(kind, url),
    body: buildBody({
      kind,
      url,
      parent_id,
      sort_order,
      browser_id,
      client_op_id,
    }),
  });
  if (!updated) return null;
  const parsed = asBookmark(updated);
  return parsed ? toBookmarkRow(parsed) : null;
}

export async function deleteBookmark(worldId: number, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!assertBookmarkInWorld(existing, worldId)) return false;
  await assertEntityInWorld(id, worldId);
  return deleteEntity(id);
}

export async function pullBookmarksSince(
  worldId: number,
  opts: BookmarkPullOpts = {},
): Promise<BookmarkRow[]> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: BOOKMARK_COMPONENT,
    ...(opts.updated_after ? { updated_after: opts.updated_after } : {}),
    limit: opts.limit ?? 2000,
    mode: "filter_only",
    include_count: false,
    deleted: "all",
  });
  return result.results
    .map((row) => {
      const parsed = asBookmark(row);
      return parsed ? toBookmarkRow(parsed) : null;
    })
    .filter((row): row is BookmarkRow => row != null)
    .toSorted((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at) || a.id - b.id);
}

async function findByClientOpId(worldId: number, clientOpId: string): Promise<BookmarkRow | null> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: BOOKMARK_COMPONENT,
    filters: { client_op_id: clientOpId },
    limit: 1,
    mode: "filter_only",
    include_count: false,
  });
  const row = result.results[0];
  if (!row) return null;
  const parsed = asBookmark(row);
  return parsed ? toBookmarkRow(parsed) : null;
}

async function resolveParentId(
  worldId: number,
  input: BookmarkUpsertInput,
): Promise<number | null> {
  if (input.parent_id != null) return input.parent_id;
  if (input.parent_browser_id) {
    const parent = await findBookmarkByBrowserId(worldId, input.parent_browser_id);
    return parent?.id ?? null;
  }
  return null;
}

export async function upsertBookmarkByBrowserId(
  worldId: number,
  input: BookmarkUpsertInput,
): Promise<BookmarkRow> {
  const existing = await findBookmarkByBrowserId(worldId, input.browser_id, {
    include_deleted: true,
  });

  if (input.deleted) {
    if (!existing) {
      // 从未入库的删除：建 tombstone 再软删，便于 pull 传播
      const created = await createBookmark(
        worldId,
        omitUndefined({
          title: input.title,
          kind: input.kind,
          url: input.url ?? null,
          parent_id: await resolveParentId(worldId, input),
          sort_order: input.sort_order,
          browser_id: input.browser_id,
          client_op_id: input.client_op_id,
        }),
      );
      await deleteBookmark(worldId, created.id);
      const deleted = await getBookmarkIncludingDeleted(worldId, created.id);
      if (!deleted) throw new Error("bookmark tombstone missing");
      return deleted;
    }
    if (!existing.deleted_at) {
      await deleteBookmark(worldId, existing.id);
    }
    const deleted = await getBookmarkIncludingDeleted(worldId, existing.id);
    if (!deleted) throw new Error("bookmark missing after delete");
    return deleted;
  }

  const parent_id = await resolveParentId(worldId, input);

  if (existing) {
    if (existing.deleted_at) {
      await restoreEntity(existing.id);
    }
    const updated = await updateBookmark(
      worldId,
      omitUndefined({
        id: existing.id,
        title: input.title,
        kind: input.kind,
        url: input.url ?? null,
        parent_id,
        sort_order: input.sort_order,
        browser_id: input.browser_id,
        client_op_id: input.client_op_id,
      }),
    );
    if (!updated) throw new Error("bookmark update failed");
    return updated;
  }

  return createBookmark(
    worldId,
    omitUndefined({
      title: input.title,
      kind: input.kind,
      url: input.url ?? null,
      parent_id,
      sort_order: input.sort_order,
      browser_id: input.browser_id,
      client_op_id: input.client_op_id,
    }),
  );
}

async function getBookmarkIncludingDeleted(
  worldId: number,
  id: number,
): Promise<BookmarkRow | null> {
  const existing = await getEntity(id, { include_deleted: true });
  if (!existing || existing.primary_component !== BOOKMARK_COMPONENT) return null;
  if (existing.world_id !== worldId) return null;
  const parsed = asBookmark(existing);
  return parsed ? toBookmarkRow(parsed) : null;
}

export async function upsertBookmarkBatch(
  worldId: number,
  items: BookmarkUpsertInput[],
): Promise<BookmarkRow[]> {
  // 文件夹优先，便于 parent_browser_id 解析
  const ordered = [...items].toSorted((a, b) => {
    if (a.kind === b.kind) return 0;
    return a.kind === "folder" ? -1 : 1;
  });
  const out: BookmarkRow[] = [];
  for (const item of ordered) {
    out.push(await upsertBookmarkByBrowserId(worldId, item));
  }
  return out;
}
