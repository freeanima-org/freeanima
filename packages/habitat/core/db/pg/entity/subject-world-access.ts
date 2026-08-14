import {
  worldConfigBodySchema,
  type WorldConfigBody,
  type WorldGrantPermission,
} from "@freeanima/habitat/core/db/schema";

export type SubjectWorldAccessLevel = "none" | "read" | "write";

function grantLevel(permission: WorldGrantPermission): SubjectWorldAccessLevel {
  return permission === "write" ? "write" : "read";
}

/**
 * 按 world_config body 判定 subject 对本 world 的访问级别。
 * - public：全员至少 read；write 需 owner 或 write grant
 * - private：owner 满权限；其余靠 grants（write ⊃ read）
 */
export function subjectWorldAccessLevel(
  body: WorldConfigBody | Record<string, unknown>,
  subjectId: number,
): SubjectWorldAccessLevel {
  const parsed = worldConfigBodySchema.safeParse(body);
  if (!parsed.success) return "none";
  const cfg = parsed.data;

  if (cfg.owner_subject_id === subjectId) return "write";

  const grant = cfg.grants.find((g) => g.subject_id === subjectId);
  const fromGrant = grant ? grantLevel(grant.permission) : "none";

  if (!cfg.private) {
    // public：隐式 read；write 仅 owner（已上）或 write grant
    if (fromGrant === "write") return "write";
    return "read";
  }

  return fromGrant;
}

export function accessLevelMeets(
  level: SubjectWorldAccessLevel,
  required: "read" | "write",
): boolean {
  if (required === "read") return level === "read" || level === "write";
  return level === "write";
}
