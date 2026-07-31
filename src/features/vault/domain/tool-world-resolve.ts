import type { SubjectKind } from "@freeanima/host/core/config";
import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/host/core/db/pg/entity";
import { toolError } from "@freeanima/host/core/tool";

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
    const subjectKind = parseSubjectKind(opts.args.subject_kind);
    const access = opts.access ?? "read";

    if (explicitWorld != null) {
      return await resolveToolWorld({ explicitWorldId: explicitWorld, access });
    }

    if (opts.entityId != null && opts.entityId > 0) {
      return await resolveToolWorld({ entityId: opts.entityId, access });
    }

    if (subjectKind == null) {
      return toolError("subject_kind is required (user|agent) when world_id omitted");
    }
    return await resolveToolWorld({ subjectKind, access });
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
  tag_ids: number[];
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
    tag_ids: row.tag_ids,
    custom_field_names: row.custom_field_names,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const SUBJECT_KIND_TOOL_PROPERTY = {
  type: "string",
  enum: ["user", "agent"],
  description:
    "Owning subject: user or agent (required unless world_id or entity id resolves world)",
} as const;

export const WORLD_ID_TOOL_PROPERTY = {
  type: "integer",
  description: "Optional world override; otherwise subject_kind selects user/agent private world",
} as const;
