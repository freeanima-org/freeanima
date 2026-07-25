import type { EntityRevision } from "@freeanima/host/core/db/schema/entity";

export const VAULT_REVISION_CHANGED_FIELDS = [
  "title",
  "url",
  "username",
  "tags",
  "content",
  "item_type",
  "custom_field_names",
  "secrets",
] as const;

export type VaultRevisionChangedField = (typeof VAULT_REVISION_CHANGED_FIELDS)[number];

/** 邻版比较用的快照视图（当前实体或某一档 revision） */
export type VaultRevisionCompareView = {
  title: string;
  content: string;
  url?: string;
  username?: string;
  tags: string[];
  item_type?: string;
  custom_field_names: string[];
  secrets_enc?: string;
};

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== "string") continue;
    const tag = raw.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out.toSorted((a, b) => a.localeCompare(b));
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
}): VaultRevisionCompareView {
  const out: VaultRevisionCompareView = {
    title: row.title,
    content: row.content,
    tags: normalizeTags(row.body.tags),
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
  return out;
}

export function vaultCompareViewFromRevision(rev: EntityRevision): VaultRevisionCompareView {
  return vaultCompareViewFromEntity({
    title: rev.title,
    content: rev.content,
    body: rev.body,
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
  if ((older.username ?? "") !== (newer.username ?? "")) changed.push("username");
  if (JSON.stringify(older.tags) !== JSON.stringify(newer.tags)) changed.push("tags");
  if (older.content !== newer.content) changed.push("content");
  if ((older.item_type ?? "") !== (newer.item_type ?? "")) changed.push("item_type");
  if (JSON.stringify(older.custom_field_names) !== JSON.stringify(newer.custom_field_names)) {
    changed.push("custom_field_names");
  }
  if ((older.secrets_enc ?? "") !== (newer.secrets_enc ?? "")) changed.push("secrets");
  return changed;
}
