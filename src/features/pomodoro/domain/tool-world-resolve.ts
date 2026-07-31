import type { SubjectKind } from "@freeanima/host/core/config";
import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/host/core/db/pg/entity";
import { toolError } from "@freeanima/host/core/tool";

export const WORLD_ID_OPTIONAL = {
  type: "number",
  description: "Optional world id override",
} as const;

function parseSubjectKind(raw: unknown): SubjectKind | undefined {
  if (raw === "user" || raw === "agent") return raw;
  return undefined;
}

export async function resolvePomodoroToolWorld(
  args: Record<string, unknown>,
): Promise<number | string> {
  try {
    const rawWorld = args.world_id;
    if (rawWorld != null && rawWorld !== "") {
      const worldId = Number(rawWorld);
      if (!Number.isFinite(worldId) || worldId <= 0) return toolError("invalid world_id");
      return await resolveToolWorld({ explicitWorldId: worldId, access: "read" });
    }
    const kind = parseSubjectKind(args.subject_kind);
    if (kind == null) {
      return toolError("subject_kind is required (user|agent) when world_id omitted");
    }
    return await resolveToolWorld({ subjectKind: kind, access: "read" });
  } catch (e) {
    const msg = e instanceof ToolWorldAccessError ? e.message : String(e);
    return toolError(msg);
  }
}
