import type { SubjectKind } from "@freeanima/host/core/config";
import { resolveSubjectWorldId } from "@freeanima/host/core/config";
import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/host/core/db/pg/entity";
import { toolError } from "@freeanima/host/core/tool";

function parseWorldId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
}

function parseSubjectKind(raw: unknown): SubjectKind | undefined {
  if (raw === "user" || raw === "agent") return raw;
  return undefined;
}

export const SUBJECT_KIND_TOOL_PROPERTY = {
  type: "string",
  enum: ["user", "agent"],
  description:
    "Owning subject: user or agent (required unless world_id or entity id resolves world)",
} as const;

export const WORLD_ID_TOOL_PROPERTY = {
  type: "integer",
  description: "Owning world id (see system prompt: user_world_id / agent_world_id)",
} as const;

export const SUBJECT_WORLD_OPTIONAL = {
  subject_kind: SUBJECT_KIND_TOOL_PROPERTY,
  world_id: {
    ...WORLD_ID_TOOL_PROPERTY,
    description: "Optional world override; otherwise subject_kind selects the private world",
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
    const subjectKind = parseSubjectKind(opts.args.subject_kind);
    const entityId =
      opts.entityId ?? (opts.accountId != null && opts.accountId > 0 ? opts.accountId : undefined);
    const access = opts.access ?? "read";

    if (explicit != null) {
      return await resolveToolWorld({ explicitWorldId: explicit, access });
    }
    if (entityId != null) {
      return await resolveToolWorld({ entityId, access });
    }
    if (subjectKind == null) {
      return toolError("subject_kind is required (user|agent) when world_id omitted");
    }
    return resolveSubjectWorldId(subjectKind);
  } catch (e) {
    const msg = e instanceof ToolWorldAccessError ? e.message : String(e);
    return toolError(msg);
  }
}

/** @deprecated use SUBJECT_WORLD_OPTIONAL */
export const WORLD_ID_OPTIONAL = {
  world_id: SUBJECT_WORLD_OPTIONAL.world_id,
  subject_kind: SUBJECT_KIND_TOOL_PROPERTY,
} as const;
