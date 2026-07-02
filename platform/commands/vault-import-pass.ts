import { createVaultItem, listVaultItems } from "@freeanima/capabilities-vault/item-store";
import { resolveVaultWorldId } from "@freeanima/capabilities-vault/vault-world";
import type { VaultItemType } from "@freeanima/core/db/schema/entity";
import {
  getCredentialDetail,
  listCredentials,
  type CredentialDetail,
  type CredentialMeta,
} from "@freeanima/platform/config";
import { ensureAgentVaultConfig, sealAgentVaultItem } from "@freeanima/platform/connectors/vault";
import type { VaultSecretsPayload } from "@freeanima/vault-crypto";

const PASS_IMPORT_PREFIX = "pass-import:";

const PRIMARY_SECRET_KEYS = [
  "password",
  "token",
  "secret",
  "api_key",
  "apikey",
  "api-token",
  "access_token",
  "refresh_token",
];
const USERNAME_KEYS = ["username", "user", "login", "email"];
const URL_KEYS = ["url", "uri", "website", "host"];
const NOTES_KEYS = ["notes", "note", "desc", "description"];

export type PassImportRow = {
  passPath: string;
  vaultId: number;
  title: string;
  primaryField: string;
};

export type PassImportSkip = {
  passPath: string;
  reason: string;
};

export type PassImportResult = {
  imported: PassImportRow[];
  skipped: PassImportSkip[];
};

export type PassImportOptions = {
  dryRun?: boolean;
};

function passImportMarker(passPath: string): string {
  return `${PASS_IMPORT_PREFIX}${passPath}`;
}

function pickStringField(fields: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const val = fields[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return undefined;
}

export function mapPassToVault(
  meta: CredentialMeta,
  detail: CredentialDetail,
): {
  title: string;
  content: string;
  item_type: VaultItemType;
  url?: string;
  username?: string;
  tags: string[];
  secrets: VaultSecretsPayload;
  primaryField: string;
} {
  const tagSet = new Set<string>(
    [`pass:${meta.path}`, meta.category, ...meta.tags].filter(Boolean),
  );
  const content = passImportMarker(meta.path);
  const title = meta.label?.trim() || meta.name;

  if (!detail.yaml) {
    return {
      title,
      content,
      item_type: "login",
      tags: [...tagSet],
      secrets: {
        password: detail.value,
        ...(meta.desc ? { notes: meta.desc } : {}),
      },
      primaryField: "password",
    };
  }

  const fields = detail.fields;
  let password = pickStringField(fields, PRIMARY_SECRET_KEYS);
  let primaryField = "password";

  const reserved = new Set([
    ...PRIMARY_SECRET_KEYS,
    ...USERNAME_KEYS,
    ...URL_KEYS,
    ...NOTES_KEYS,
    "tags",
  ]);

  const custom_fields: VaultSecretsPayload["custom_fields"] = [];
  if (!password) {
    for (const [name, val] of Object.entries(fields)) {
      if (reserved.has(name) || typeof val !== "string" || !val.trim()) continue;
      custom_fields.push({ name, value: val.trim(), type: "hidden" });
    }
    if (custom_fields[0]) {
      password = custom_fields[0].value;
      primaryField = "custom_fields.0.value";
    }
  } else {
    for (const [name, val] of Object.entries(fields)) {
      if (reserved.has(name) || typeof val !== "string" || !val.trim()) continue;
      custom_fields.push({ name, value: val.trim(), type: "hidden" });
    }
    if (password && PRIMARY_SECRET_KEYS.find((k) => fields[k] === password && k !== "password")) {
      primaryField = "password";
    }
  }

  if (!password) {
    throw new Error("no importable secret field");
  }

  const notes =
    pickStringField(fields, NOTES_KEYS) ?? (meta.desc?.trim() ? meta.desc.trim() : undefined);
  const username = pickStringField(fields, USERNAME_KEYS);
  const url = pickStringField(fields, URL_KEYS);

  const secrets: VaultSecretsPayload = {
    password,
    ...(notes ? { notes } : {}),
    ...(custom_fields.length > 0 ? { custom_fields } : {}),
  };

  return {
    title,
    content,
    item_type: "login",
    ...(url ? { url } : {}),
    ...(username ? { username } : {}),
    tags: [...tagSet],
    secrets,
    primaryField,
  };
}

async function findExistingImportId(worldId: number, passPath: string): Promise<number | null> {
  const marker = passImportMarker(passPath);
  const passTag = `pass:${passPath}`;
  const items = await listVaultItems(worldId, { limit: 5000 });
  for (const item of items) {
    if (item.content.includes(marker) || item.tags.includes(passTag)) return item.id;
  }
  return null;
}

/** 将 ~/.password-store 条目导入 Agent 保险库（machine key，无需 User 主密码） */
export async function importPassToAgentVault(
  options: PassImportOptions = {},
): Promise<PassImportResult> {
  await ensureAgentVaultConfig();
  const worldId = resolveVaultWorldId("agent");
  const result: PassImportResult = { imported: [], skipped: [] };

  const creds = listCredentials();
  if (creds.length === 0) {
    return result;
  }

  for (const meta of creds) {
    try {
      const existingId = await findExistingImportId(worldId, meta.path);
      if (existingId != null) {
        result.skipped.push({ passPath: meta.path, reason: `already_imported:${existingId}` });
        continue;
      }

      const detail = getCredentialDetail(meta.path);
      const mapped = mapPassToVault(meta, detail);

      if (options.dryRun) {
        result.imported.push({
          passPath: meta.path,
          vaultId: -1,
          title: mapped.title,
          primaryField: mapped.primaryField,
        });
        continue;
      }

      const sealed = await sealAgentVaultItem(mapped.secrets);
      const item = await createVaultItem(worldId, {
        title: mapped.title,
        content: mapped.content,
        item_type: mapped.item_type,
        ...(mapped.url ? { url: mapped.url } : {}),
        ...(mapped.username ? { username: mapped.username } : {}),
        tags: mapped.tags,
        secrets_enc: sealed.secrets_enc,
        dek_wrapped: sealed.dek_wrapped,
        custom_field_names: sealed.custom_field_names,
      });

      result.imported.push({
        passPath: meta.path,
        vaultId: item.id,
        title: mapped.title,
        primaryField: mapped.primaryField,
      });
    } catch (err) {
      result.skipped.push({
        passPath: meta.path,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
