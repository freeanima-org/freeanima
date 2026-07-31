import type { SubjectKind } from "@freeanima/host/core/config";
import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/host/core/db/pg/entity";
import { toolError } from "@freeanima/host/core/tool";

import { parseWorldId, WORLD_ID_TOOL_PROPERTY } from "./block-tool-helpers.ts";

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

export const WORLD_ID_OPTIONAL = {
  world_id: {
    ...WORLD_ID_TOOL_PROPERTY,
    description: "Optional world override; otherwise subject_kind selects the private world",
  },
  subject_kind: SUBJECT_KIND_TOOL_PROPERTY,
} as const;

export async function resolveContentBlockToolWorld(opts: {
  args: Record<string, unknown>;
  entityId?: number;
  access?: "read" | "write";
}): Promise<number | string> {
  try {
    const explicit = parseWorldId(opts.args.world_id);
    const subjectKind = parseSubjectKind(opts.args.subject_kind);
    const access = opts.access ?? "read";
    if (explicit != null) {
      return await resolveToolWorld({ explicitWorldId: explicit, access });
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
