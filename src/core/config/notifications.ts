import type { NotificationRecipientKind } from "@freeanima/core/db/pg/notifications/types";
import type { AnimaConfig } from "./schemas/config.ts";
import { getResolvedWorldContext } from "./resolved-world-context.ts";
import { resolveWorldSubjectIds } from "./worlds.ts";

export type NotificationRecipientRef = {
  kind: NotificationRecipientKind;
  id: string;
};

export type ResolvedNotificationRecipients = {
  user: NotificationRecipientRef;
  agent: NotificationRecipientRef;
};

/** 从 ResolvedWorldContext（boot 后）或 config worlds/legacy 解析通知收件主体 */
export function resolveNotificationRecipients(config: AnimaConfig): ResolvedNotificationRecipients {
  try {
    const ctx = getResolvedWorldContext();
    return {
      user: { kind: "user", id: String(ctx.user_subject_id) },
      agent: { kind: "agent", id: String(ctx.agent_subject_id) },
    };
  } catch {
    /* WorldContext 尚未 bind：回退到配置 */
  }

  const { user_subject_id, agent_subject_id } = resolveWorldSubjectIds(config);
  if (user_subject_id == null || agent_subject_id == null) {
    throw new Error(
      "worlds subject ids 未解析；请等待 Habitat 启动完成 ensureWorldSubjects，或配置 worlds.user_subject_id / agent_subject_id",
    );
  }
  return {
    user: { kind: "user", id: String(user_subject_id) },
    agent: { kind: "agent", id: String(agent_subject_id) },
  };
}
