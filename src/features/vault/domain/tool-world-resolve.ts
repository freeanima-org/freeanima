import type { SubjectKind } from "@freeanima/host/core/config";
import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/host/core/db/pg/entity";
import { toolError } from "@freeanima/host/core/tool";

import { defaultVaultSubjectForTools, resolveVaultWorldId } from "./vault-world.ts";

function parseSubjectKind(raw: unknown): SubjectKind | undefined {
  if (raw === "user" || raw === "agent") return raw;
  return undefined;
}

function parseWorldId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
}

export async function resolveVaultToolWorld(opts: {
  args: Record<string, unknown>;
  entityId?: number;
  access?: "read" | "write";
}): Promise<number | string> {
  try {
    const explicitWorld = parseWorldId(opts.args.world_id);
    const subjectKind = parseSubjectKind(opts.args.subject_kind) ?? defaultVaultSubjectForTools();
    const access = opts.access ?? "read";

    if (explicitWorld != null) {
      return await resolveToolWorld({ explicitWorldId: explicitWorld, access });
    }

    if (opts.entityId != null && opts.entityId > 0) {
      return await resolveToolWorld({ entityId: opts.entityId, access });
    }

    return resolveVaultWorldId(subjectKind);
  } catch (e) {
    const msg = e instanceof ToolWorldAccessError ? e.message : String(e);
    return toolError(msg);
  }
}

export function metaPayload(row: {
  id: number;
  title: string;
  content: string;
  item_type: string;
  url?: string;
  username?: string;
  tags: string[];
  custom_field_names: string[];
  created_at: string;
  updated_at: string;
}) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    item_type: row.item_type,
    url: row.url,
    username: row.username,
    tags: row.tags,
    custom_field_names: row.custom_field_names,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const SUBJECT_KIND_TOOL_PROPERTY = {
  type: "string",
  enum: ["user", "agent"],
  description:
    "Vault library: user (client MP) or agent (Habitat machine key). Defaults to agent for tools.",
} as const;

export const WORLD_ID_TOOL_PROPERTY = {
  type: "integer",
  description: "Optional world override; defaults to agent private world for LLM tools",
} as const;
