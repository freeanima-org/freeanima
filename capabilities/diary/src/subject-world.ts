import { resolveNotificationRecipients } from "@freeanima/core/config";
import type { AnimaConfig } from "@freeanima/core/config";
import { getEntity } from "@freeanima/core/db/pg/entity";
import { subjectConfigBodySchema } from "@freeanima/core/db/schema/entity";

export type DiarySubjectKind = "user" | "agent";

export async function resolveDiaryWorldId(
  kind: DiarySubjectKind,
  config: AnimaConfig,
): Promise<number> {
  const recipients = resolveNotificationRecipients(config);
  const ref = kind === "user" ? recipients.user : recipients.agent;
  const subjectId = Number(ref.id);
  if (!Number.isFinite(subjectId) || subjectId <= 0) {
    throw new Error(`diary subject not configured for kind=${kind}`);
  }

  const subject = await getEntity(subjectId);
  if (!subject || (subject.type !== "user" && subject.type !== "agent")) {
    throw new Error(`diary subject not found: ${subjectId}`);
  }

  const parsed = subjectConfigBodySchema.safeParse(subject.body);
  const worldId = parsed.success ? parsed.data.default_private_world_id : undefined;
  if (worldId == null || worldId <= 0) {
    throw new Error(`subject ${subjectId} has no default_private_world_id`);
  }
  return worldId;
}
