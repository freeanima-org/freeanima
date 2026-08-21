import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/habitat/core/db/pg/entity";
import { toolError } from "@freeanima/habitat/core/tool";

function parseWorldId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
}

function parseSubjectId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
}

export const SUBJECT_ID_TOOL_PROPERTY = {
  type: "integer",
  description:
    "Owning subject entity id (required unless world_id / entity id / conversation tool context resolves world)",
} as const;

export const WORLD_ID_TOOL_PROPERTY = {
  type: "integer",
  description: "Owning world id (see system prompt: user_world_id / agent_world_id)",
} as const;

export const SUBJECT_WORLD_OPTIONAL = {
  subject_id: SUBJECT_ID_TOOL_PROPERTY,
  world_id: {
    ...WORLD_ID_TOOL_PROPERTY,
    description:
      "Optional world override; otherwise subject_id or conversation subject selects the private world",
  },
} as const;

export async function resolveEmailToolWorld(opts: {
  args: Record<string, unknown>;
  entityId?: number;
  accountId?: number;
  access?: "read" | "write";
}): Promise<number | string> {
  try {
    const explicit = parseWorldId(opts.args.world_id);
    const subjectId = parseSubjectId(opts.args.subject_id);
    const entityId =
      opts.entityId ?? (opts.accountId != null && opts.accountId > 0 ? opts.accountId : undefined);
    const access = opts.access ?? "read";

    if (explicit != null) {
      return await resolveToolWorld({ explicitWorldId: explicit, access });
    }
    if (entityId != null) {
      return await resolveToolWorld({ entityId, access });
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

/** @deprecated use SUBJECT_WORLD_OPTIONAL */
export const WORLD_ID_OPTIONAL = {
  world_id: SUBJECT_WORLD_OPTIONAL.world_id,
  subject_id: SUBJECT_ID_TOOL_PROPERTY,
} as const;
