import { getResolvedWorldContext } from "@freeanima/habitat/core/config";
import { getEntity } from "@freeanima/habitat/core/db/pg/entity";
import type { NotificationRecipientKind } from "@freeanima/habitat/core/db/pg/notifications/types";
import { toolError } from "@freeanima/habitat/core/tool";
import { coerceString } from "@freeanima/shared/coerce-string";

export type ResolvedNotificationSubject = {
  recipient_kind: NotificationRecipientKind;
  recipient_id: string;
};

export const SUBJECT_ID_TOOL_PROPERTY = {
  type: "integer",
  description:
    "Subject entity id (see system prompt: user_subject_id / agent_subject_id); overrides target/recipient enum",
} as const;

function parseSubjectId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
}

function isConfiguredSubjectId(subjectId: number): boolean {
  const ctx = getResolvedWorldContext();
  return subjectId === ctx.user_subject_id || subjectId === ctx.agent_subject_id;
}

async function resolveExplicitSubject(
  subjectId: number,
): Promise<ResolvedNotificationSubject | string> {
  if (!isConfiguredSubjectId(subjectId)) {
    return toolError(`subject_id ${subjectId} is not a configured user/agent subject`);
  }

  const row = await getEntity(subjectId);
  if (!row) return toolError(`subject not found: ${subjectId}`);
  if (row.type !== "user" && row.type !== "agent") {
    return toolError(`subject_id ${subjectId} must refer to a user or agent entity`);
  }

  return {
    recipient_kind: row.type,
    recipient_id: String(subjectId),
  };
}

export async function resolveNotificationSendTargets(
  args: Record<string, unknown>,
): Promise<ResolvedNotificationSubject[] | string> {
  const explicitId = parseSubjectId(args.subject_id);
  if (explicitId != null) {
    const one = await resolveExplicitSubject(explicitId);
    if (typeof one === "string") return one;
    return [one];
  }

  if (args.target == null || coerceString(args.target).trim() === "") {
    return toolError("target or subject_id is required");
  }
  const target = coerceString(args.target).trim();
  if (target !== "user" && target !== "agent" && target !== "both") {
    return toolError("target must be user, agent, or both");
  }

  const ctx = getResolvedWorldContext();
  if (target === "user") {
    return [{ recipient_kind: "user", recipient_id: String(ctx.user_subject_id) }];
  }
  if (target === "agent") {
    return [{ recipient_kind: "agent", recipient_id: String(ctx.agent_subject_id) }];
  }
  return [
    { recipient_kind: "user", recipient_id: String(ctx.user_subject_id) },
    { recipient_kind: "agent", recipient_id: String(ctx.agent_subject_id) },
  ];
}

export async function resolveNotificationListSubject(
  args: Record<string, unknown>,
): Promise<ResolvedNotificationSubject | string> {
  const explicitId = parseSubjectId(args.subject_id);
  if (explicitId != null) {
    return resolveExplicitSubject(explicitId);
  }

  if (args.recipient == null || coerceString(args.recipient).trim() === "") {
    return toolError("recipient or subject_id is required");
  }
  const recipientKind = coerceString(args.recipient).trim();
  if (recipientKind !== "user" && recipientKind !== "agent") {
    return toolError("recipient must be user or agent");
  }

  const ctx = getResolvedWorldContext();
  return {
    recipient_kind: recipientKind,
    recipient_id: String(recipientKind === "user" ? ctx.user_subject_id : ctx.agent_subject_id),
  };
}
