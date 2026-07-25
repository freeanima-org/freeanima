import {
  VAULT_ITEM_COMPONENT,
  asVaultItem,
  type VaultImportRefs,
  type VaultItemType,
  type VaultUriEntry,
} from "@freeanima/host/core/db/schema/entity";
import {
  createEntity,
  deleteEntity,
  getEntity,
  restoreEntityRevision,
  searchEntities,
  updateEntity,
} from "@freeanima/host/core/db/pg/entity";
import { assertEntityInWorld } from "@freeanima/host/core/db/pg/entity";

export type VaultItemRow = {
  id: number;
  title: string;
  content: string;
  item_type: VaultItemType;
  url?: string;
  uris?: VaultUriEntry[];
  username?: string;
  tags: string[];
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
  tags?: string[];
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
  tags?: string[];
  secrets_enc?: string;
  dek_wrapped?: string;
  custom_field_names?: string[];
  import_refs?: VaultImportRefs;
  /** 改密 rewrap 等：跳过顶层 entities.revisions 归档 */
  skip_revision?: boolean;
};

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
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

function toRow(
  parsed: NonNullable<ReturnType<typeof asVaultItem>>,
  meta: { created_at: Date; updated_at: Date },
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
    tags: parsed.tags ?? [],
    secrets_enc: parsed.secrets_enc,
    dek_wrapped: parsed.dek_wrapped,
    custom_field_names: parsed.custom_field_names ?? [],
    ...(parsed.import_refs !== undefined ? { import_refs: parsed.import_refs } : {}),
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

export function toVaultItemMeta(row: VaultItemRow): VaultItemMetaRow {
  const { secrets_enc: _s, dek_wrapped: _d, ...meta } = row;
  return meta;
}

export async function listVaultItems(
  worldId: number,
  opts: { limit?: number; tags?: string[]; include_secrets?: boolean } = {},
): Promise<Array<VaultItemRow | VaultItemMetaRow>> {
  const filters: Record<string, unknown> = {};
  if (opts.tags?.length) filters.tags = opts.tags;
  const result = await searchEntities({
    world_id: worldId,
    primary_component: VAULT_ITEM_COMPONENT,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    limit: opts.limit ?? 500,
    mode: "filter_only",
    include_count: false,
    ...(opts.include_secrets ? {} : { projection: "list" as const }),
  });
  return result.results
    .map((row) => {
      const parsed = asVaultItem(row);
      if (!parsed) return null;
      const full = toRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
      return opts.include_secrets ? full : toVaultItemMeta(full);
    })
    .filter((row): row is VaultItemRow | VaultItemMetaRow => row != null)
    .toSorted((a, b) => a.title.localeCompare(b.title) || a.id - b.id);
}

export async function searchVaultItems(
  worldId: number,
  query: string,
  opts: { limit?: number; include_secrets?: boolean } = {},
): Promise<Array<VaultItemRow | VaultItemMetaRow>> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: VAULT_ITEM_COMPONENT,
    query,
    limit: opts.limit ?? 50,
    mode: "hybrid",
  });
  return result.results
    .map((row) => {
      const parsed = asVaultItem(row);
      if (!parsed) return null;
      const full = toRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
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
  const full = toRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
  return opts.include_secrets ? full : toVaultItemMeta(full);
}

export async function createVaultItem(
  worldId: number,
  input: VaultItemCreateInput,
): Promise<VaultItemRow> {
  const uris = normalizeUris(input.uris);
  const body = {
    item_type: input.item_type ?? "login",
    url: input.url,
    ...(uris !== undefined ? { uris } : {}),
    username: input.username,
    tags: normalizeTags(input.tags),
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
    content: input.content?.trim() ?? "",
    body,
  });
  const parsed = asVaultItem(created);
  if (!parsed) throw new Error("invalid vault_item");
  return toRow(parsed, { created_at: created.created_at, updated_at: created.updated_at });
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
  const body = {
    item_type: input.item_type ?? parsed.item_type,
    url: input.url !== undefined ? input.url : parsed.url,
    ...(nextUris !== undefined ? { uris: nextUris } : {}),
    username: input.username !== undefined ? input.username : parsed.username,
    tags: input.tags !== undefined ? normalizeTags(input.tags) : (parsed.tags ?? []),
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
  const updated = await updateEntity({
    id: input.id,
    ...(input.title !== undefined ? { title: input.title.trim().slice(0, 500) } : {}),
    ...(input.content !== undefined ? { content: input.content.trim() } : {}),
    body,
    ...(input.skip_revision ? { skip_revision: true } : {}),
  });
  if (!updated) return null;
  const next = asVaultItem(updated);
  if (!next) return null;
  return toRow(next, { created_at: updated.created_at, updated_at: updated.updated_at });
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
  return toRow(parsed, { created_at: updated.created_at, updated_at: updated.updated_at });
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
