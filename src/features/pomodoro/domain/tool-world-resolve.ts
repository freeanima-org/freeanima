import { resolveSubjectWorldId } from "@freeanima/host/core/config";
import type { PomodoroSubjectKind } from "./types.ts";

export const WORLD_ID_OPTIONAL = {
  type: "number",
  description: "Optional world id override",
} as const;

export async function resolvePomodoroToolWorld(
  args: Record<string, unknown>,
): Promise<number | string> {
  const rawWorld = args.world_id;
  if (rawWorld != null && rawWorld !== "") {
    const worldId = Number(rawWorld);
    if (!Number.isFinite(worldId) || worldId <= 0) return "invalid world_id";
    return worldId;
  }
  const kind = String(args.subject_kind ?? "user").trim() as PomodoroSubjectKind;
  if (kind !== "user" && kind !== "agent") return "subject_kind must be user or agent";
  return resolveSubjectWorldId(kind);
}
