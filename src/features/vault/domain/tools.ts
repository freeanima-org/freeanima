import type { VaultItemType } from "@freeanima/core/db/schema/entity";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/core/tool";
import { omitUndefined } from "@freeanima/core/util";
import {
  ensureAgentVaultConfig,
  openAgentVaultSecrets,
  sealAgentVaultItem,
} from "@freeanima/platform/connectors/vault";
import type { VaultSecretsPayload } from "@freeanima/shared/vault-crypto";

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
    "Plaintext secret fields to seal into Agent vault (password, notes, totp, custom_fields). Never returned in tool results.",
  properties: {
    password: { type: "string" },
    notes: { type: "string" },
    totp: { type: "string" },
    custom_fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
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
  tags: { type: "array", items: { type: "string" } },
} as const;

function parseTags(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) return raw.map((v) => String(v));
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
  const v = String(raw);
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
  if (rec.password != null) out.password = String(rec.password);
  if (rec.notes != null) out.notes = String(rec.notes);
  if (rec.totp != null) out.totp = String(rec.totp);
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
      const name = String(f.name ?? "").trim();
      if (!name) return toolError("secrets.custom_fields[].name is required");
      const typeRaw = f.type != null ? String(f.type) : "text";
      const type =
        typeRaw === "hidden" || typeRaw === "boolean" || typeRaw === "text" ? typeRaw : "text";
      fields.push({ name, value: String(f.value ?? ""), type });
    }
    out.custom_fields = fields;
  }
  return out;
}

async function handleList(args: Record<string, unknown>): Promise<string> {
  const worldId = await resolveVaultToolWorld({ args });
  if (typeof worldId === "string") return worldId;

  const tags = parseTags(args.tags);
  const limit =
    typeof args.limit === "number" && Number.isFinite(args.limit)
      ? Math.max(1, Math.min(500, Math.floor(args.limit)))
      : 50;

  const items = await listVaultItems(worldId, {
    ...(tags !== undefined ? { tags } : {}),
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
  const query = String(args.query ?? "").trim();
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

  const title = String(args.title ?? "").trim();
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
    const item = await createVaultItem(
      worldId,
      omitUndefined({
        title,
        content: args.content != null ? String(args.content) : undefined,
        item_type: parseItemType(args.item_type),
        url: args.url != null ? String(args.url) : undefined,
        username: args.username != null ? String(args.username) : undefined,
        tags: parseTags(args.tags),
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
  const hasTags = args.tags != null;
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
    const patch: Parameters<typeof updateVaultItem>[1] = omitUndefined({
      id,
      title: hasTitle ? String(args.title) : undefined,
      content: hasContent ? String(args.content) : undefined,
      item_type: hasItemType ? parseItemType(args.item_type) : undefined,
      url: hasUrl ? String(args.url) : undefined,
      username: hasUsername ? String(args.username) : undefined,
      tags: hasTags ? parseTags(args.tags) : undefined,
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
      "Use terminal_run/code_execute secrets[] for subprocess credentials, or browser_type secret for form fields. " +
      "Default library: agent. " +
      "vault_create/vault_update/vault_delete are Habitat-only (not MCP).",
    attachToolReturns(
      [
        {
          name: "vault_list",
          description: "List vault item metadata (no secrets)",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_AND_SUBJECT,
              tags: { type: "array", items: { type: "string" } },
              limit: { type: "integer" },
            },
          },
          handler: handleList,
        },
        {
          name: "vault_search",
          description: "Search vault items by metadata (no secrets)",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_AND_SUBJECT,
              query: { type: "string" },
              limit: { type: "integer" },
            },
            required: ["query"],
          },
          handler: handleSearch,
        },
        {
          name: "vault_get_meta",
          description: "Get one vault item metadata (no secrets)",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_AND_SUBJECT,
              id: { type: "integer" },
            },
            required: ["id"],
          },
          handler: handleGetMeta,
        },
        {
          name: "vault_create",
          description:
            "Create an Agent-library vault item. Pass plaintext secrets to seal on Hub; result is metadata only. Not exposed via MCP. User library: use Vault UI.",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_AND_SUBJECT,
              ...META_WRITE_PROPERTIES,
              secrets: SECRETS_TOOL_PROPERTY,
            },
            required: ["title"],
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
            required: ["id"],
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
            required: ["id"],
          },
          handler: handleDelete,
        },
      ],
      VAULT_TOOL_RETURNS,
    ),
  );
}

/** 供测试重置 */
export function resetVaultToolsForTests(): void {}
