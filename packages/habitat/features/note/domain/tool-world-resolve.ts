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

export const WORLD_ID_OPTIONAL = {
  world_id: {
    type: "integer" as const,
    description:
      "Optional world override; otherwise subject_id or conversation subject selects the private world",
  },
  subject_id: {
    type: "string" as const,
    enum: ["user", "agent"] as const,
    description:
      "Owning subject: user or agent (required unless world_id or entity id resolves world)",
  },
} as const;

export async function resolveNoteToolWorld(opts: {
  args: Record<string, unknown>;
  entityId?: number;
  access?: "read" | "write";
}): Promise<number | string> {
  try {
    const explicit = parseWorldId(opts.args.world_id);
    const subjectId = parseSubjectId(opts.args.subject_id);
    const access = opts.access ?? "read";

    if (explicit != null) {
      return await resolveToolWorld({ explicitWorldId: explicit, access });
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
