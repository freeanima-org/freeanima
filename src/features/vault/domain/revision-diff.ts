import type { EntityRevision } from "@freeanima/host/core/db/schema/entity";

export const VAULT_REVISION_CHANGED_FIELDS = [
  "title",
  "url",
  "uris",
  "username",
  "tag_ids",
  "content",
  "item_type",
  "custom_field_names",
  "import_refs",
  "secrets",
] as const;

export type VaultRevisionChangedField = (typeof VAULT_REVISION_CHANGED_FIELDS)[number];

/** 邻版比较用的快照视图（当前实体或某一档 revision） */
export type VaultRevisionCompareView = {
  title: string;
  content: string;
  url?: string;
  uris_json?: string;
  username?: string;
  tag_ids: number[];
  item_type?: string;
  custom_field_names: string[];
  import_refs_json?: string;
  secrets_enc?: string;
};

function normalizeTagIds(tagIds: unknown): number[] {
  if (!Array.isArray(tagIds)) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of tagIds) {
    const id = Math.floor(Number(raw));
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.toSorted((a, b) => a - b);
}

function normalizeNames(names: unknown): string[] {
  if (!Array.isArray(names)) return [];
  return names
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
    .map((n) => n.trim())
    .toSorted((a, b) => a.localeCompare(b));
}

function optStr(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function vaultCompareViewFromEntity(row: {
  title: string;
  content: string;
  body: Record<string, unknown>;
  tag_ids?: number[];
}): VaultRevisionCompareView {
  const out: VaultRevisionCompareView = {
    title: row.title,
    content: row.content,
    tag_ids: normalizeTagIds(row.tag_ids),
    custom_field_names: normalizeNames(row.body.custom_field_names),
  };
  const url = optStr(row.body.url);
  const username = optStr(row.body.username);
  const item_type = optStr(row.body.item_type);
  const secrets_enc = optStr(row.body.secrets_enc);
  if (url !== undefined) out.url = url;
  if (username !== undefined) out.username = username;
  if (item_type !== undefined) out.item_type = item_type;
  if (secrets_enc !== undefined) out.secrets_enc = secrets_enc;
  if (row.body.uris !== undefined) out.uris_json = JSON.stringify(row.body.uris);
  if (row.body.import_refs !== undefined) {
    out.import_refs_json = JSON.stringify(row.body.import_refs);
  }
  return out;
}

export function vaultCompareViewFromRevision(rev: EntityRevision): VaultRevisionCompareView {
  return vaultCompareViewFromEntity({
    title: rev.title,
    content: rev.content,
    body: rev.body,
    tag_ids: rev.tag_ids,
  });
}

/**
 * 比较「较旧快照」相对「更新一版」变动了哪些字段。
 * （列表语义：离开 older、进入 newer 时的变更）
 */
export function diffVaultRevisionFields(
  older: VaultRevisionCompareView,
  newer: VaultRevisionCompareView,
): VaultRevisionChangedField[] {
  const changed: VaultRevisionChangedField[] = [];
  if (older.title !== newer.title) changed.push("title");
  if ((older.url ?? "") !== (newer.url ?? "")) changed.push("url");
  if ((older.uris_json ?? "") !== (newer.uris_json ?? "")) changed.push("uris");
  if ((older.username ?? "") !== (newer.username ?? "")) changed.push("username");
  if (JSON.stringify(older.tag_ids) !== JSON.stringify(newer.tag_ids)) changed.push("tag_ids");
  if (older.content !== newer.content) changed.push("content");
  if ((older.item_type ?? "") !== (newer.item_type ?? "")) changed.push("item_type");
  if (JSON.stringify(older.custom_field_names) !== JSON.stringify(newer.custom_field_names)) {
    changed.push("custom_field_names");
  }
  if ((older.import_refs_json ?? "") !== (newer.import_refs_json ?? "")) {
    changed.push("import_refs");
  }
  if ((older.secrets_enc ?? "") !== (newer.secrets_enc ?? "")) changed.push("secrets");
  return changed;
}
