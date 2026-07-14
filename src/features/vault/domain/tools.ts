import type { SubjectKind } from "@freeanima/core/config";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/core/tool";
import { getToolConversationId } from "@freeanima/core/tool/tool-context";
import { omitUndefined } from "@freeanima/core/util";

import { getVaultItem, listVaultItems, searchVaultItems } from "./item-store.ts";
import { defaultVaultSubjectForTools } from "./vault-world.ts";
import { VAULT_TOOL_RETURNS } from "./return-schemas.ts";
import {
  metaPayload,
  resolveVaultToolWorld,
  SUBJECT_KIND_TOOL_PROPERTY,
  WORLD_ID_TOOL_PROPERTY,
} from "./tool-world-resolve.ts";

export type VaultToolIo = {
  resolveAgentSecret: (opts: { worldId: number; itemId: number; field: string }) => Promise<string>;
  resolveUserSecret?: (opts: {
    worldId: number;
    itemId: number;
    field: string;
    conversationId?: string;
  }) => Promise<string>;
  injectEnv: (opts: { envName: string; value: string }) => void;
};

function parseSubjectKind(raw: unknown): SubjectKind {
  if (raw === "user" || raw === "agent") return raw;
  return defaultVaultSubjectForTools();
}

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

async function handleInjectEnv(args: Record<string, unknown>, io: VaultToolIo): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");

  const field = String(args.field ?? "password").trim();
  if (!field) return toolError("field is required");

  const envName = String(args.env_name ?? "").trim();
  if (!envName) return toolError("env_name is required");

  const subjectKind = parseSubjectKind(args.subject_kind);
  const worldId = await resolveVaultToolWorld({ args, entityId: id, access: "write" });
  if (typeof worldId === "string") return worldId;

  try {
    let value: string;
    if (subjectKind === "user") {
      if (!io.resolveUserSecret) {
        return toolError("user vault inject requires connected shell client");
      }
      const conversationId = getToolConversationId() ?? undefined;
      value = await io.resolveUserSecret(
        omitUndefined({
          worldId,
          itemId: id,
          field,
          conversationId,
        }),
      );
    } else {
      value = await io.resolveAgentSecret({ worldId, itemId: id, field });
    }

    io.injectEnv({ envName, value });
    return toolResult({
      ok: true,
      action: "inject_env",
      env_name: envName,
      item_id: id,
      subject_kind: subjectKind,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "vault_locked" || msg === "vault_locked_user" || msg === "VAULT_SHELL_OFFLINE") {
      return toolError(
        subjectKind === "user"
          ? "user vault locked; unlock via Vault UI or Chat dedicated control"
          : "agent vault secret unavailable",
      );
    }
    if (msg === "NOT_FOUND" || msg === "FIELD_NOT_FOUND" || msg === "vault_field_not_found") {
      return toolError(`vault item or field not found: ${id}/${field}`);
    }
    return toolError(msg);
  }
}

const WORLD_AND_SUBJECT = {
  world_id: WORLD_ID_TOOL_PROPERTY,
  subject_kind: SUBJECT_KIND_TOOL_PROPERTY,
} as const;

export function registerVaultTools(toolSets: ToolSetRegistry, io: VaultToolIo): void {
  toolSets.registerToolSet(
    "vault",
    "Vault metadata and runtime env injection (no secrets in tool results). Default library: agent.",
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
          name: "vault_inject_env",
          description:
            "Inject a vault secret into runtime env for subprocess use. Returns ack only; never returns secret values.",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_AND_SUBJECT,
              id: { type: "integer" },
              field: {
                type: "string",
                description: 'Secret field path, e.g. "password" or "custom_fields.0.value"',
              },
              env_name: { type: "string", description: "Process env var name to set" },
            },
            required: ["id", "env_name"],
          },
          handler: (args) => handleInjectEnv(args, io),
        },
      ],
      VAULT_TOOL_RETURNS,
    ),
  );
}

/** 供测试重置 */
export function resetVaultToolsForTests(): void {}
