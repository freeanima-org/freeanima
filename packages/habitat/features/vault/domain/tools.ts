import type { VaultItemType } from "@freeanima/habitat/core/db/schema/entity";
import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/habitat/core/tool";
import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  ensureAgentVaultConfig,
  openAgentVaultSecrets,
  sealAgentVaultItem,
} from "@freeanima/habitat/capabilities/connectors/vault";
import type { VaultSecretsPayload } from "@freeanima/shared/vault-crypto";
import { normalizeTotpSecret } from "@freeanima/shared/vault-crypto";

import { ensureTagsByTitles } from "@freeanima/features/tag/domain";
import {
  createVaultItem,
  deleteVaultItem,
  getVaultItem,
  listVaultItems,
  searchVaultItems,
  updateVaultItem,
  toVaultItemMeta,
} from "./item-store.ts";
import { VAULT_TOOL_RETURNS } from "./return-schemas.ts";
import { coerceString } from "@freeanima/shared/coerce-string";
import {
  metaPayload,
  resolveVaultToolWorld,
  SUBJECT_KIND_TOOL_PROPERTY,
  WORLD_ID_TOOL_PROPERTY,
} from "./tool-world-resolve.ts";

const ITEM_TYPES = new Set<VaultItemType>(["login", "secure_note", "card", "identity", "custom"]);

const SECRETS_TOOL_PROPERTY = {
  type: "object",
  description:
    "Plaintext secret fields to seal into Agent vault (password, notes, totp, custom_fields). " +
    "Later use secrets[].field / browser_type secret.field with password/notes/totp or a custom_fields[].name. " +
    "totp stores the Base32 shared secret (otpauth URI accepted); resolving field=totp yields the current TOTP code. " +
    "Never returned in tool results.",
  properties: {
    password: { type: "string" },
    notes: { type: "string" },
    totp: {
      type: "string",
      description:
        "Base32 TOTP secret or otpauth:// URI (stored encrypted; field=totp resolves to current code)",
    },
    custom_fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Field name later passed as secrets[].field / secret.field",
          },
          value: { type: "string" },
          type: { type: "string", enum: ["text", "hidden", "boolean"] },
        },
        required: ["name", "value"],
      },
    },
  },
} as const;

const META_WRITE_PROPERTIES = {
  title: { type: "string" },
  content: { type: "string" },
  item_type: {
    type: "string",
    enum: ["login", "secure_note", "card", "identity", "custom"],
  },
  url: { type: "string" },
  username: { type: "string" },
  tags: {
    type: "array",
    items: { type: "string" },
    description: "Tag titles (find-or-create); merged with tag_ids",
  },
  tag_ids: {
    type: "array",
    items: { type: "integer" },
    description: "Existing tag entity ids (same world)",
  },
} as const;

async function resolveVaultToolTagIds(
  worldId: number,
  args: Record<string, unknown>,
): Promise<number[] | undefined | string> {
  if (args.tags === undefined && args.tag_ids === undefined) return undefined;
  const parts: number[][] = [];
  if (args.tag_ids !== undefined) {
    if (!Array.isArray(args.tag_ids)) return toolError("tag_ids must be an array of integers");
    const ids: number[] = [];
    for (const raw of args.tag_ids) {
      const id = Math.floor(Number(raw));
      if (!Number.isFinite(id) || id <= 0)
        return toolError(`invalid tag_ids element: ${String(raw)}`);
      ids.push(id);
    }
    parts.push(ids);
  }
  if (args.tags !== undefined) {
    const titles = parseTags(args.tags);
    if (titles === undefined) return toolError("tags must be an array of strings");
    try {
      parts.push(await ensureTagsByTitles(worldId, titles));
    } catch (e) {
      return toolError(e instanceof Error ? e.message : String(e));
    }
  }
  const out: number[] = [];
  const seen = new Set<number>();
  for (const part of parts) {
    for (const id of part) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function parseTags(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw))
    return raw
      .map((v) => String(v))
      .map((s) => s.trim())
      .filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

function parseItemType(raw: unknown): VaultItemType | undefined {
  if (raw == null) return undefined;
  const v = coerceString(raw);
  return ITEM_TYPES.has(v as VaultItemType) ? (v as VaultItemType) : undefined;
}

function rejectUserLibraryWrites(args: Record<string, unknown>): string | null {
  if (args.subject_kind === "user") {
    return toolError(
      "vault_create/vault_update only support agent library; use Vault UI for user library",
    );
  }
  return null;
}

function parseSecretsPayload(raw: unknown): VaultSecretsPayload | string {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return toolError("secrets must be an object");
  }
  const rec = raw as Record<string, unknown>;
  const out: VaultSecretsPayload = {};
  if (rec.password != null) out.password = coerceString(rec.password).trim();
  if (rec.notes != null) out.notes = coerceString(rec.notes);
  if (rec.totp != null) {
    const totp = normalizeTotpSecret(coerceString(rec.totp));
    if (totp) out.totp = totp;
  }
  if (rec.custom_fields != null) {
    if (!Array.isArray(rec.custom_fields)) {
      return toolError("secrets.custom_fields must be an array");
    }
    const fields: NonNullable<VaultSecretsPayload["custom_fields"]> = [];
    for (const entry of rec.custom_fields) {
      if (entry == null || typeof entry !== "object") {
        return toolError("secrets.custom_fields[] must be objects");
      }
      const f = entry as Record<string, unknown>;
      const name = coerceString(f.name ?? "").trim();
      if (!name) return toolError("secrets.custom_fields[].name is required");
      const typeRaw = f.type != null ? coerceString(f.type) : "text";
      const type =
        typeRaw === "hidden" || typeRaw === "boolean" || typeRaw === "text" ? typeRaw : "text";
      fields.push({ name, value: coerceString(f.value ?? "").trim(), type });
    }
    out.custom_fields = fields;
  }
  return out;
}

async function handleList(args: Record<string, unknown>): Promise<string> {
  const worldId = await resolveVaultToolWorld({ args });
  if (typeof worldId === "string") return worldId;

  const tagIds = await resolveVaultToolTagIds(worldId, args);
  if (typeof tagIds === "string") return tagIds;
  const limit =
    typeof args.limit === "number" && Number.isFinite(args.limit)
      ? Math.max(1, Math.min(500, Math.floor(args.limit)))
      : 50;

  const items = await listVaultItems(worldId, {
    ...(tagIds !== undefined ? { tag_ids: tagIds } : {}),
    limit,
    include_secrets: false,
  });
  return toolResult({
    ok: true,
    action: "list",
    count: items.length,
    items: items.map(metaPayload),
  });
}

async function handleSearch(args: Record<string, unknown>): Promise<string> {
  const query = coerceString(args.query ?? "").trim();
  if (!query) return toolError("query is required");

  const worldId = await resolveVaultToolWorld({ args });
  if (typeof worldId === "string") return worldId;

  const limit =
    typeof args.limit === "number" && Number.isFinite(args.limit)
      ? Math.max(1, Math.min(50, Math.floor(args.limit)))
      : undefined;

  const items = await searchVaultItems(
    worldId,
    query,
    omitUndefined({ limit, include_secrets: false }),
  );
  return toolResult({
    ok: true,
    action: "search",
    count: items.length,
    items: items.map(metaPayload),
  });
}

async function handleGetMeta(args: Record<string, unknown>): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");

  const worldId = await resolveVaultToolWorld({ args, entityId: id });
  if (typeof worldId === "string") return worldId;

  const item = await getVaultItem(worldId, id, { include_secrets: false });
  if (!item) return toolError(`vault item not found: ${id}`);
  return toolResult({ ok: true, action: "get_meta", item: metaPayload(item) });
}

async function handleCreate(args: Record<string, unknown>): Promise<string> {
  const userDeny = rejectUserLibraryWrites(args);
  if (userDeny) return userDeny;

  const title = coerceString(args.title ?? "").trim();
  if (!title) return toolError("title is required");

  const secretsParsed = parseSecretsPayload(args.secrets ?? {});
  if (typeof secretsParsed === "string") return secretsParsed;

  const worldId = await resolveVaultToolWorld({
    args: { ...args, subject_kind: "agent" },
    access: "write",
  });
  if (typeof worldId === "string") return worldId;

  try {
    await ensureAgentVaultConfig(worldId);
    const sealed = await sealAgentVaultItem(secretsParsed);
    const tagIds = await resolveVaultToolTagIds(worldId, args);
    if (typeof tagIds === "string") return tagIds;
    const item = await createVaultItem(
      worldId,
      omitUndefined({
        title,
        content: args.content != null ? coerceString(args.content) : undefined,
        item_type: parseItemType(args.item_type),
        url: args.url != null ? coerceString(args.url) : undefined,
        username: args.username != null ? coerceString(args.username) : undefined,
        tag_ids: tagIds,
        secrets_enc: sealed.secrets_enc,
        dek_wrapped: sealed.dek_wrapped,
        custom_field_names: sealed.custom_field_names,
      }),
    );
    return toolResult({
      ok: true,
      action: "create",
      item: metaPayload(toVaultItemMeta(item)),
    });
  } catch (e) {
    return toolError(e instanceof Error ? e.message : String(e));
  }
}

async function handleUpdate(args: Record<string, unknown>): Promise<string> {
  const userDeny = rejectUserLibraryWrites(args);
  if (userDeny) return userDeny;

  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");

  const hasTitle = args.title != null;
  const hasContent = args.content != null;
  const hasItemType = args.item_type != null;
  const hasUrl = args.url != null;
  const hasUsername = args.username != null;
  const hasTags = args.tags != null || args.tag_ids != null;
  const hasSecrets = args.secrets != null;
  if (
    !hasTitle &&
    !hasContent &&
    !hasItemType &&
    !hasUrl &&
    !hasUsername &&
    !hasTags &&
    !hasSecrets
  ) {
    return toolError("vault_update requires at least one field to change");
  }

  let secretsParsed: VaultSecretsPayload | undefined;
  if (hasSecrets) {
    const parsed = parseSecretsPayload(args.secrets);
    if (typeof parsed === "string") return parsed;
    secretsParsed = parsed;
  }

  const worldId = await resolveVaultToolWorld({
    args: { ...args, subject_kind: "agent" },
    entityId: id,
    access: "write",
  });
  if (typeof worldId === "string") return worldId;

  try {
    await ensureAgentVaultConfig(worldId);
    const tagIds = hasTags ? await resolveVaultToolTagIds(worldId, args) : undefined;
    if (typeof tagIds === "string") return tagIds;
    const patch: Parameters<typeof updateVaultItem>[1] = omitUndefined({
      id,
      title: hasTitle ? String(args.title) : undefined,
      content: hasContent ? String(args.content) : undefined,
      item_type: hasItemType ? parseItemType(args.item_type) : undefined,
      url: hasUrl ? String(args.url) : undefined,
      username: hasUsername ? String(args.username) : undefined,
      tag_ids: tagIds,
    });

    if (secretsParsed) {
      const existing = await getVaultItem(worldId, id, { include_secrets: true });
      if (!existing || !("secrets_enc" in existing)) {
        return toolError(`vault item not found: ${id}`);
      }
      let merged: VaultSecretsPayload;
      if (existing.secrets_enc && existing.dek_wrapped) {
        const current = await openAgentVaultSecrets(existing.secrets_enc, existing.dek_wrapped);
        merged = { ...current, ...secretsParsed };
      } else {
        merged = secretsParsed;
      }
      const sealed = await sealAgentVaultItem(merged);
      patch.secrets_enc = sealed.secrets_enc;
      patch.dek_wrapped = sealed.dek_wrapped;
      patch.custom_field_names = sealed.custom_field_names;
    }

    const item = await updateVaultItem(worldId, patch);
    if (!item) return toolError(`vault item not found: ${id}`);
    return toolResult({
      ok: true,
      action: "update",
      item: metaPayload(toVaultItemMeta(item)),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "NOT_FOUND") return toolError(`vault item not found: ${id}`);
    return toolError(msg);
  }
}

async function handleDelete(args: Record<string, unknown>): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");

  const worldId = await resolveVaultToolWorld({ args, entityId: id, access: "write" });
  if (typeof worldId === "string") return worldId;

  try {
    const ok = await deleteVaultItem(worldId, id);
    if (!ok) return toolError(`vault item not found: ${id}`);
    return toolResult({ ok: true, action: "delete", id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "NOT_FOUND" || msg.includes("not found")) {
      return toolError(`vault item not found: ${id}`);
    }
    return toolError(msg);
  }
}

const WORLD_AND_SUBJECT = {
  world_id: WORLD_ID_TOOL_PROPERTY,
  subject_kind: SUBJECT_KIND_TOOL_PROPERTY,
} as const;

export function registerVaultTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "vault",
    "Vault metadata and Agent-library write tools (no secrets in tool results). " +
      "Use terminal_run/code_execute secrets[] for subprocess credentials, or browser_type secret for form fields " +
      "(field = password/notes/totp or a custom_field_names entry). " +
      "Pass subject_kind (user|agent); world_id optional. " +
      "Vault tools are Habitat-only (not MCP).",
    attachToolReturns(
      [
        {
          name: "vault_list",
          description: "List vault item metadata (no secrets)",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_AND_SUBJECT,
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Filter by tag titles (resolved to tag_ids)",
              },
              tag_ids: { type: "array", items: { type: "integer" } },
              limit: { type: "integer" },
            },
            required: ["subject_kind"],
          },
          handler: handleList,
        },
        {
          name: "vault_search",
          description: "Search vault items by metadata (no secrets)",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_AND_SUBJECT,
              query: { type: "string" },
              limit: { type: "integer" },
            },
            required: ["subject_kind", "query"],
          },
          handler: handleSearch,
        },
        {
          name: "vault_get_meta",
          description:
            "Get one vault item metadata (no secrets). custom_field_names lists names usable as " +
            "secrets[].field / browser_type secret.field (same form as password).",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_AND_SUBJECT,
              id: { type: "integer" },
            },
            required: ["subject_kind", "id"],
          },
          handler: handleGetMeta,
        },
        {
          name: "vault_create",
          description:
            "Create an Agent-library vault item. Pass plaintext secrets to seal on Habitat; result is metadata only. Not exposed via MCP. User library: use Vault UI.",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_AND_SUBJECT,
              ...META_WRITE_PROPERTIES,
              secrets: SECRETS_TOOL_PROPERTY,
            },
            required: ["subject_kind", "title"],
          },
          handler: handleCreate,
        },
        {
          name: "vault_update",
          description:
            "Update an Agent-library vault item (metadata and/or secrets merge). Result is metadata only. Not exposed via MCP. User library: use Vault UI.",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_AND_SUBJECT,
              id: { type: "integer" },
              ...META_WRITE_PROPERTIES,
              secrets: SECRETS_TOOL_PROPERTY,
            },
            required: ["subject_kind", "id"],
          },
          handler: handleUpdate,
        },
        {
          name: "vault_delete",
          description: "Delete a vault item by id. Not exposed via MCP.",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_AND_SUBJECT,
              id: { type: "integer" },
            },
            required: ["subject_kind", "id"],
          },
          handler: handleDelete,
        },
      ],
      VAULT_TOOL_RETURNS,
    ),
    { visibility: "searchable" },
  );
}

/** 供测试重置 */
export function resetVaultToolsForTests(): void {}
