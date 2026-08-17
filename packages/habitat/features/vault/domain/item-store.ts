import {
  VAULT_ITEM_COMPONENT,
  TAG_COMPONENT,
  asVaultItem,
  type VaultImportRefs,
  type VaultItemType,
  type VaultUriEntry,
} from "@freeanima/habitat/core/db/schema/entity";
import {
  createEntity,
  deleteEntity,
  getEntity,
  restoreEntityRevision,
  searchEntities,
  updateEntity,
} from "@freeanima/habitat/core/db/pg/entity";
import { assertEntityInWorld } from "@freeanima/habitat/core/db/pg/entity";
import type { EntityRow } from "@freeanima/habitat/core/db/schema/entity";

export type VaultItemRow = {
  id: number;
  title: string;
  content: string;
  item_type: VaultItemType;
  url?: string;
  uris?: VaultUriEntry[];
  username?: string;
  last_used_at?: string;
  tag_ids: number[];
  secrets_enc: string;
  dek_wrapped: string;
  custom_field_names: string[];
  import_refs?: VaultImportRefs;
  created_at: string;
  updated_at: string;
};

export type VaultItemMetaRow = Omit<VaultItemRow, "secrets_enc" | "dek_wrapped"> & {
  secrets_enc?: string;
  dek_wrapped?: string;
};

export type VaultItemCreateInput = {
  title: string;
  content?: string;
  item_type?: VaultItemType;
  url?: string;
  uris?: VaultUriEntry[];
  username?: string;
  tag_ids?: number[];
  secrets_enc: string;
  dek_wrapped: string;
  custom_field_names?: string[];
  import_refs?: VaultImportRefs;
};

export type VaultItemUpdateInput = {
  id: number;
  title?: string;
  content?: string;
  item_type?: VaultItemType;
  url?: string;
  uris?: VaultUriEntry[];
  username?: string;
  tag_ids?: number[];
  secrets_enc?: string;
  dek_wrapped?: string;
  custom_field_names?: string[];
  import_refs?: VaultImportRefs;
  /** 改密 rewrap 等：跳过顶层 entities.revisions 归档 */
  skip_revision?: boolean;
};

function normalizeTagIds(tagIds: number[] | undefined): number[] {
  if (!tagIds?.length) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of tagIds) {
    const id = Math.floor(raw);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function assertTagIdsInWorld(worldId: number, tagIds: number[]): Promise<void> {
  for (const id of tagIds) {
    const row = await getEntity(id);
    if (!row || row.primary_component !== TAG_COMPONENT) {
      throw new Error(`tag not found: ${id}`);
    }
    await assertEntityInWorld(id, worldId);
  }
}

function normalizeUris(uris: VaultUriEntry[] | undefined): VaultUriEntry[] | undefined {
  if (!uris?.length) return undefined;
  const out: VaultUriEntry[] = [];
  for (const raw of uris) {
    const uri = raw.uri.trim();
    if (!uri) continue;
    out.push({ uri, match: raw.match ?? "domain" });
  }
  return out.length > 0 ? out : undefined;
}

/** 供 FTS/ILIKE：username + url + uris（不含密文 notes） */
export function buildVaultItemSearchContent(opts: {
  username?: string;
  url?: string;
  uris?: VaultUriEntry[];
  extra?: string;
}): string {
  const parts: string[] = [];
  const extra = opts.extra?.trim();
  if (extra) parts.push(extra);
  const username = opts.username?.trim();
  if (username) parts.push(username);
  const url = opts.url?.trim();
  if (url) parts.push(url);
  for (const entry of opts.uris ?? []) {
    const uri = entry.uri.trim();
    if (uri && uri !== url) parts.push(uri);
  }
  return parts.join("\n");
}

function toRow(
  parsed: NonNullable<ReturnType<typeof asVaultItem>>,
  entity: Pick<EntityRow, "created_at" | "updated_at" | "tag_ids">,
): VaultItemRow {
  const uris = normalizeUris(parsed.uris);
  return {
    id: parsed.id,
    title: parsed.title,
    content: parsed.content,
    item_type: parsed.item_type,
    ...(parsed.url !== undefined ? { url: parsed.url } : {}),
    ...(uris !== undefined ? { uris } : {}),
    ...(parsed.username !== undefined ? { username: parsed.username } : {}),
    ...(parsed.last_used_at !== undefined ? { last_used_at: parsed.last_used_at } : {}),
    tag_ids: [...(entity.tag_ids ?? [])],
    secrets_enc: parsed.secrets_enc,
    dek_wrapped: parsed.dek_wrapped,
    custom_field_names: parsed.custom_field_names ?? [],
    ...(parsed.import_refs !== undefined ? { import_refs: parsed.import_refs } : {}),
    created_at: entity.created_at.toISOString(),
    updated_at: entity.updated_at.toISOString(),
  };
}

export function toVaultItemMeta(row: VaultItemRow): VaultItemMetaRow {
  const { secrets_enc: _s, dek_wrapped: _d, ...meta } = row;
  return meta;
}

export async function listVaultItems(
  worldId: number,
  opts: { limit?: number; tag_ids?: number[]; include_secrets?: boolean } = {},
): Promise<Array<VaultItemRow | VaultItemMetaRow>> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: VAULT_ITEM_COMPONENT,
    ...(opts.tag_ids?.length ? { tag_ids: opts.tag_ids } : {}),
    limit: opts.limit ?? 500,
    mode: "filter_only",
    include_count: false,
    ...(opts.include_secrets ? {} : { projection: "list" as const }),
  });
  return result.results
    .map((row) => {
      const parsed = asVaultItem(row);
      if (!parsed) return null;
      const full = toRow(parsed, row);
      return opts.include_secrets ? full : toVaultItemMeta(full);
    })
    .filter((row): row is VaultItemRow | VaultItemMetaRow => row != null)
    .toSorted((a, b) => a.title.localeCompare(b.title) || a.id - b.id);
}

export async function searchVaultItems(
  worldId: number,
  query: string,
  opts: { limit?: number; include_secrets?: boolean; tag_ids?: number[] } = {},
): Promise<Array<VaultItemRow | VaultItemMetaRow>> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: VAULT_ITEM_COMPONENT,
    query,
    limit: opts.limit ?? 50,
    mode: "hybrid",
    ...(opts.tag_ids?.length ? { tag_ids: opts.tag_ids } : {}),
  });
  return result.results
    .map((row) => {
      const parsed = asVaultItem(row);
      if (!parsed) return null;
      const full = toRow(parsed, row);
      return opts.include_secrets ? full : toVaultItemMeta(full);
    })
    .filter((row): row is VaultItemRow | VaultItemMetaRow => row != null);
}

export async function getVaultItem(
  worldId: number,
  id: number,
  opts: { include_secrets?: boolean } = {},
): Promise<VaultItemRow | VaultItemMetaRow | null> {
  await assertEntityInWorld(id, worldId);
  const row = await getEntity(id);
  if (!row) return null;
  const parsed = asVaultItem(row);
  if (!parsed) return null;
  const full = toRow(parsed, row);
  return opts.include_secrets ? full : toVaultItemMeta(full);
}

export async function createVaultItem(
  worldId: number,
  input: VaultItemCreateInput,
): Promise<VaultItemRow> {
  const uris = normalizeUris(input.uris);
  const tagIds = normalizeTagIds(input.tag_ids);
  await assertTagIdsInWorld(worldId, tagIds);
  const body = {
    item_type: input.item_type ?? "login",
    url: input.url,
    ...(uris !== undefined ? { uris } : {}),
    username: input.username,
    secrets_enc: input.secrets_enc,
    dek_wrapped: input.dek_wrapped,
    custom_field_names: input.custom_field_names ?? [],
    ...(input.import_refs !== undefined ? { import_refs: input.import_refs } : {}),
  };
  const created = await createEntity({
    type: "content",
    world_id: worldId,
    components: [VAULT_ITEM_COMPONENT],
    primary_component: VAULT_ITEM_COMPONENT,
    title: input.title.trim().slice(0, 500),
    content: buildVaultItemSearchContent({
      ...(input.username !== undefined ? { username: input.username } : {}),
      ...(input.url !== undefined ? { url: input.url } : {}),
      ...(uris !== undefined ? { uris } : {}),
      ...(input.content !== undefined ? { extra: input.content } : {}),
    }),
    body,
    tag_ids: tagIds,
  });
  const parsed = asVaultItem(created);
  if (!parsed) throw new Error("invalid vault_item");
  return toRow(parsed, created);
}

export async function updateVaultItem(
  worldId: number,
  input: VaultItemUpdateInput,
): Promise<VaultItemRow | null> {
  await assertEntityInWorld(input.id, worldId);
  const existing = await getEntity(input.id);
  if (!existing) return null;
  const parsed = asVaultItem(existing);
  if (!parsed) return null;
  const nextUris =
    input.uris !== undefined ? normalizeUris(input.uris) : normalizeUris(parsed.uris);
  let nextTagIds = existing.tag_ids ?? [];
  if (input.tag_ids !== undefined) {
    nextTagIds = normalizeTagIds(input.tag_ids);
    await assertTagIdsInWorld(worldId, nextTagIds);
  }
  const body = {
    item_type: input.item_type ?? parsed.item_type,
    url: input.url !== undefined ? input.url : parsed.url,
    ...(nextUris !== undefined ? { uris: nextUris } : {}),
    username: input.username !== undefined ? input.username : parsed.username,
    ...(parsed.last_used_at !== undefined ? { last_used_at: parsed.last_used_at } : {}),
    secrets_enc: input.secrets_enc ?? parsed.secrets_enc,
    dek_wrapped: input.dek_wrapped ?? parsed.dek_wrapped,
    custom_field_names:
      input.custom_field_names !== undefined
        ? input.custom_field_names
        : (parsed.custom_field_names ?? []),
    ...(input.import_refs !== undefined
      ? { import_refs: input.import_refs }
      : parsed.import_refs !== undefined
        ? { import_refs: parsed.import_refs }
        : {}),
  };
  const nextUsername = input.username !== undefined ? input.username : parsed.username;
  const nextUrl = input.url !== undefined ? input.url : parsed.url;
  const updated = await updateEntity({
    id: input.id,
    ...(input.title !== undefined ? { title: input.title.trim().slice(0, 500) } : {}),
    content: buildVaultItemSearchContent({
      ...(nextUsername !== undefined ? { username: nextUsername } : {}),
      ...(nextUrl !== undefined ? { url: nextUrl } : {}),
      ...(nextUris !== undefined ? { uris: nextUris } : {}),
      ...(input.content !== undefined ? { extra: input.content } : {}),
    }),
    body,
    ...(input.tag_ids !== undefined ? { tag_ids: nextTagIds } : {}),
    ...(input.skip_revision ? { skip_revision: true } : {}),
  });
  if (!updated) return null;
  const next = asVaultItem(updated);
  if (!next) return null;
  return toRow(next, updated);
}

/** 仅更新 last_used_at；跳过 revisions（填充高频写） */
export async function touchVaultItemLastUsed(
  worldId: number,
  id: number,
  at: string = new Date().toISOString(),
): Promise<VaultItemRow | null> {
  await assertEntityInWorld(id, worldId);
  const existing = await getEntity(id);
  if (!existing) return null;
  const parsed = asVaultItem(existing);
  if (!parsed) return null;
  const uris = normalizeUris(parsed.uris);
  const body: Record<string, unknown> = {
    item_type: parsed.item_type,
    secrets_enc: parsed.secrets_enc,
    dek_wrapped: parsed.dek_wrapped,
    custom_field_names: parsed.custom_field_names ?? [],
    last_used_at: at,
  };
  if (parsed.url !== undefined) body.url = parsed.url;
  if (uris !== undefined) body.uris = uris;
  if (parsed.username !== undefined) body.username = parsed.username;
  if (parsed.import_refs !== undefined) body.import_refs = parsed.import_refs;
  const updated = await updateEntity({
    id,
    body,
    skip_revision: true,
  });
  if (!updated) return null;
  const next = asVaultItem(updated);
  if (!next) return null;
  return toRow(next, updated);
}

import {
  diffVaultRevisionFields,
  vaultCompareViewFromEntity,
  vaultCompareViewFromRevision,
} from "./revision-diff.ts";

export type VaultItemRevisionMeta = {
  index: number;
  captured_at: string;
  title: string;
  changed_fields: ReturnType<typeof diffVaultRevisionFields>;
};

export async function listVaultItemRevisions(
  worldId: number,
  id: number,
): Promise<VaultItemRevisionMeta[] | null> {
  await assertEntityInWorld(id, worldId);
  const row = await getEntity(id);
  if (!row || !asVaultItem(row)) return null;
  const currentView = vaultCompareViewFromEntity(row);
  return row.revisions.map((rev, index) => {
    const newerRev = index === 0 ? null : row.revisions[index - 1];
    const newerView = newerRev == null ? currentView : vaultCompareViewFromRevision(newerRev);
    const olderView = vaultCompareViewFromRevision(rev);
    return {
      index,
      captured_at: rev.captured_at,
      title: rev.title,
      changed_fields: diffVaultRevisionFields(olderView, newerView),
    };
  });
}

export async function restoreVaultItemRevision(
  worldId: number,
  id: number,
  revisionIndex: number,
): Promise<VaultItemRow | null> {
  await assertEntityInWorld(id, worldId);
  const updated = await restoreEntityRevision(id, revisionIndex);
  if (!updated) return null;
  const parsed = asVaultItem(updated);
  if (!parsed) return null;
  return toRow(parsed, updated);
}

export type VaultWrappedDekRow = {
  id: number;
  dek_wrapped: string;
  revision_deks: string[];
};

export async function listVaultItemsWithWrappedDek(worldId: number): Promise<VaultWrappedDekRow[]> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: VAULT_ITEM_COMPONENT,
    limit: 10_000,
    mode: "filter_only",
    include_count: false,
  });
  const out: VaultWrappedDekRow[] = [];
  for (const row of result.results) {
    const parsed = asVaultItem(row);
    if (!parsed?.dek_wrapped) continue;
    const revision_deks = row.revisions
      .map((rev) => rev.body.dek_wrapped)
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    out.push({ id: parsed.id, dek_wrapped: parsed.dek_wrapped, revision_deks });
  }
  return out;
}

export async function deleteVaultItem(worldId: number, id: number): Promise<boolean> {
  await assertEntityInWorld(id, worldId);
  return deleteEntity(id);
}
