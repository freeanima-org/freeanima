/**
 * Bitwarden 未加密 JSON 导出 → FreeAnima vault 草稿。
 * 幂等键：cipher.id → import_refs.bitwarden
 */

import type {
  VaultItemType,
  VaultUriEntry,
  VaultUriMatch,
} from "@freeanima/host/core/db/schema/entity";
import type {
  VaultCardSecrets,
  VaultCustomField,
  VaultIdentitySecrets,
  VaultSecretsPayload,
} from "@freeanima/shared/vault-crypto";

export type BitwardenImportMode = "upsert" | "create_only";

export type BitwardenMappedItem = {
  /** Bitwarden cipher UUID；缺省时无法幂等 */
  bitwarden_id?: string;
  title: string;
  content: string;
  item_type: VaultItemType;
  url?: string;
  uris?: VaultUriEntry[];
  username?: string;
  tags: string[];
  secrets: VaultSecretsPayload;
  missing_id: boolean;
};

export type BitwardenImportPlanAction = "create" | "update" | "skip";

export type BitwardenImportPlanEntry = {
  action: BitwardenImportPlanAction;
  mapped: BitwardenMappedItem;
  local_id?: number;
  reason?: string;
};

export type BitwardenImportParseResult =
  | { ok: true; items: BitwardenMappedItem[]; folder_count: number }
  | { ok: false; error: string };

const BW_TYPE_LOGIN = 1;
const BW_TYPE_SECURE_NOTE = 2;
const BW_TYPE_CARD = 3;
const BW_TYPE_IDENTITY = 4;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function mapBwMatch(match: unknown): VaultUriMatch {
  // null / undefined / 0 → domain（Bitwarden 默认）
  if (match == null || match === 0) return "domain";
  if (match === 1) return "host";
  if (match === 2) return "starts_with";
  if (match === 3) return "exact";
  if (match === 4) return "regex";
  if (match === 5) return "never";
  return "domain";
}

function mapLoginUris(login: Record<string, unknown>): {
  uris?: VaultUriEntry[];
  url?: string;
} {
  const raw = login.uris;
  if (!Array.isArray(raw) || raw.length === 0) {
    const u = asString(login.uri)?.trim();
    if (!u) return {};
    return { uris: [{ uri: u, match: "domain" }], url: u };
  }
  const uris: VaultUriEntry[] = [];
  for (const entry of raw) {
    const r = asRecord(entry);
    if (!r) continue;
    const uri = asString(r.uri)?.trim();
    if (!uri) continue;
    uris.push({ uri, match: mapBwMatch(r.match) });
  }
  if (uris.length === 0) return {};
  const url = uris[0]?.uri;
  return url ? { uris, url } : { uris };
}

function mapCustomFields(fields: unknown): VaultCustomField[] | undefined {
  if (!Array.isArray(fields) || fields.length === 0) return undefined;
  const out: VaultCustomField[] = [];
  for (const f of fields) {
    const r = asRecord(f);
    if (!r) continue;
    const name = asString(r.name)?.trim();
    if (!name) continue;
    const value = asString(r.value) ?? "";
    // Bitwarden: 0=text, 1=hidden, 2=boolean
    const t = r.type;
    const type: VaultCustomField["type"] = t === 1 ? "hidden" : t === 2 ? "boolean" : "text";
    out.push({ name, value, type });
  }
  return out.length > 0 ? out : undefined;
}

function mapCard(card: Record<string, unknown>): VaultCardSecrets {
  const brand = asString(card.brand);
  const number = asString(card.number);
  const code = asString(card.code);
  const cardholder = asString(card.cardholderName);
  const exp_month = asString(card.expMonth);
  const exp_year = asString(card.expYear);
  return {
    ...(brand ? { brand } : {}),
    ...(number ? { number } : {}),
    ...(code ? { code } : {}),
    ...(cardholder ? { cardholder } : {}),
    ...(exp_month ? { exp_month } : {}),
    ...(exp_year ? { exp_year } : {}),
  };
}

function mapIdentity(identity: Record<string, unknown>): VaultIdentitySecrets {
  const title = asString(identity.title);
  const first_name = asString(identity.firstName);
  const middle_name = asString(identity.middleName);
  const last_name = asString(identity.lastName);
  const username = asString(identity.username);
  const company = asString(identity.company);
  const ssn = asString(identity.ssn);
  const passport_number = asString(identity.passportNumber);
  const license_number = asString(identity.licenseNumber);
  const email = asString(identity.email);
  const phone = asString(identity.phone);
  const address1 = asString(identity.address1);
  const address2 = asString(identity.address2);
  const address3 = asString(identity.address3);
  const city = asString(identity.city);
  const state = asString(identity.state);
  const postal_code = asString(identity.postalCode);
  const country = asString(identity.country);
  return {
    ...(title ? { title } : {}),
    ...(first_name ? { first_name } : {}),
    ...(middle_name ? { middle_name } : {}),
    ...(last_name ? { last_name } : {}),
    ...(username ? { username } : {}),
    ...(company ? { company } : {}),
    ...(ssn ? { ssn } : {}),
    ...(passport_number ? { passport_number } : {}),
    ...(license_number ? { license_number } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(address1 ? { address1 } : {}),
    ...(address2 ? { address2 } : {}),
    ...(address3 ? { address3 } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(postal_code ? { postal_code } : {}),
    ...(country ? { country } : {}),
  };
}

function mapCipher(
  item: Record<string, unknown>,
  folderById: Map<string, string>,
): BitwardenMappedItem | null {
  const name = asString(item.name)?.trim();
  if (!name) return null;
  const bwId = asString(item.id)?.trim();
  const missing_id = !bwId;
  const notes = asString(item.notes) ?? "";
  const folderId = asString(item.folderId);
  const tags: string[] = [];
  if (folderId) {
    const folderName = folderById.get(folderId);
    if (folderName) tags.push(folderName);
  }
  const custom_fields = mapCustomFields(item.fields);
  const type = typeof item.type === "number" ? item.type : BW_TYPE_LOGIN;

  if (type === BW_TYPE_LOGIN) {
    const login = asRecord(item.login) ?? {};
    const { uris, url } = mapLoginUris(login);
    const password = asString(login.password);
    const totp = asString(login.totp);
    const secrets: VaultSecretsPayload = {
      ...(password ? { password } : {}),
      ...(totp ? { totp } : {}),
      ...(notes ? { notes } : {}),
      ...(custom_fields ? { custom_fields } : {}),
    };
    const username = asString(login.username)?.trim();
    return {
      ...(bwId ? { bitwarden_id: bwId } : {}),
      title: name,
      content: "",
      item_type: "login",
      ...(url ? { url } : {}),
      ...(uris ? { uris } : {}),
      ...(username ? { username } : {}),
      tags,
      secrets,
      missing_id,
    };
  }

  if (type === BW_TYPE_SECURE_NOTE) {
    return {
      ...(bwId ? { bitwarden_id: bwId } : {}),
      title: name,
      content: notes,
      item_type: "secure_note",
      tags,
      secrets: {
        ...(notes ? { notes } : {}),
        ...(custom_fields ? { custom_fields } : {}),
      },
      missing_id,
    };
  }

  if (type === BW_TYPE_CARD) {
    const card = mapCard(asRecord(item.card) ?? {});
    return {
      ...(bwId ? { bitwarden_id: bwId } : {}),
      title: name,
      content: "",
      item_type: "card",
      tags,
      secrets: {
        card,
        ...(notes ? { notes } : {}),
        ...(custom_fields ? { custom_fields } : {}),
      },
      missing_id,
    };
  }

  if (type === BW_TYPE_IDENTITY) {
    const identity = mapIdentity(asRecord(item.identity) ?? {});
    const username = identity.username?.trim();
    return {
      ...(bwId ? { bitwarden_id: bwId } : {}),
      title: name,
      content: "",
      item_type: "identity",
      ...(username ? { username } : {}),
      tags,
      secrets: {
        identity,
        ...(notes ? { notes } : {}),
        ...(custom_fields ? { custom_fields } : {}),
      },
      missing_id,
    };
  }

  // 未知类型 → custom
  return {
    ...(bwId ? { bitwarden_id: bwId } : {}),
    title: name,
    content: notes,
    item_type: "custom",
    tags,
    secrets: {
      ...(notes ? { notes } : {}),
      ...(custom_fields ? { custom_fields } : {}),
    },
    missing_id,
  };
}

/** 解析 Bitwarden 未加密导出 JSON（对象或字符串） */
export function parseBitwardenExport(raw: unknown): BitwardenImportParseResult {
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw) as unknown;
    } catch {
      return { ok: false, error: "JSON 解析失败" };
    }
  }
  const root = asRecord(data);
  if (!root) return { ok: false, error: "根节点须为对象" };
  if (root.encrypted === true) {
    return { ok: false, error: "不支持加密导出；请在 Bitwarden 导出时选择「未加密 .json」" };
  }
  const folders = Array.isArray(root.folders) ? root.folders : [];
  const folderById = new Map<string, string>();
  for (const f of folders) {
    const r = asRecord(f);
    if (!r) continue;
    const id = asString(r.id)?.trim();
    const name = asString(r.name)?.trim();
    if (id && name) folderById.set(id, name);
  }
  const itemsRaw = Array.isArray(root.items) ? root.items : [];
  if (itemsRaw.length === 0) {
    return { ok: false, error: "导出中没有 items" };
  }
  const items: BitwardenMappedItem[] = [];
  for (const item of itemsRaw) {
    const r = asRecord(item);
    if (!r) continue;
    if (r.deletedDate != null) continue; // 回收站跳过
    const mapped = mapCipher(r, folderById);
    if (mapped) items.push(mapped);
  }
  if (items.length === 0) {
    return { ok: false, error: "没有可导入的条目（可能均为已删除）" };
  }
  return { ok: true, items, folder_count: folderById.size };
}

/**
 * 根据本地 `import_refs.bitwarden → id` 索引规划 create / update / skip。
 * - upsert（默认）：已存在则 update；无 id 则 create
 * - create_only：已存在则 skip；无 id 则 create
 */
export function planBitwardenImport(
  mapped: BitwardenMappedItem[],
  existingByBitwardenId: Map<string, number>,
  mode: BitwardenImportMode = "upsert",
): BitwardenImportPlanEntry[] {
  return mapped.map((item) => {
    const bwId = item.bitwarden_id;
    if (!bwId) {
      return {
        action: "create" as const,
        mapped: item,
        reason: "missing_bitwarden_id",
      };
    }
    const localId = existingByBitwardenId.get(bwId);
    if (localId == null) {
      return { action: "create" as const, mapped: item };
    }
    if (mode === "create_only") {
      return {
        action: "skip" as const,
        mapped: item,
        local_id: localId,
        reason: "already_imported",
      };
    }
    return { action: "update" as const, mapped: item, local_id: localId };
  });
}

/** 从 vault.list meta 建 Bitwarden UUID 索引 */
export function indexBitwardenImportRefs(
  items: Array<{ id: number; import_refs?: { bitwarden?: string | undefined } | undefined }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const bw = item.import_refs?.bitwarden?.trim();
    if (bw) map.set(bw, item.id);
  }
  return map;
}
