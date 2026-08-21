import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/habitat/core/db/pg/entity";
import { toolError } from "@freeanima/habitat/core/tool";

function parseSubjectId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
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
    const subjectId = parseSubjectId(opts.args.subject_id);
    const access = opts.access ?? "read";

    if (explicitWorld != null) {
      return await resolveToolWorld({ explicitWorldId: explicitWorld, access });
    }

    if (opts.entityId != null && opts.entityId > 0) {
      return await resolveToolWorld({ entityId: opts.entityId, access });
    }

    if (subjectId != null) {
      return await resolveToolWorld({ subjectId, access });
    }
    try {
      return await resolveToolWorld({ access });
    } catch (inner) {
      const innerMsg = inner instanceof Error ? inner.message : String(inner);
      if (innerMsg.includes("subject_id") || innerMsg.includes("tool caller subject")) {
        return toolError(
          "subject_id is required when world_id omitted and no tool conversation subject",
        );
      }
      throw inner;
    }
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

export const SUBJECT_ID_TOOL_PROPERTY = {
  type: "integer",
  description:
    "Owning subject entity id (required unless world_id / entity id / conversation tool context resolves world)",
} as const;

export const WORLD_ID_TOOL_PROPERTY = {
  type: "integer",
  description: "Optional world override; otherwise subject_id selects user/agent private world",
} as const;
