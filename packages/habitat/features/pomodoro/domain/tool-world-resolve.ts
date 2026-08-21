import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/habitat/core/db/pg/entity";
import { toolError } from "@freeanima/habitat/core/tool";

export const WORLD_ID_OPTIONAL = {
  type: "number",
  description: "Optional world id override",
} as const;

function parseSubjectId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
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
    const subjectId = parseSubjectId(args.subject_id);
    if (subjectId != null) {
      return await resolveToolWorld({ subjectId, access: "read" });
    }
    try {
      return await resolveToolWorld({ access: "read" });
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
