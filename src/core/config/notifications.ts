import type { NotificationRecipientKind } from "@freeanima/core/db/pg/notifications/types";
import type { AnimaConfig } from "./schemas/config.ts";
import { resolveWorldSubjectIds } from "./worlds.ts";

export type NotificationRecipientRef = {
  kind: NotificationRecipientKind;
  id: string;
};

export type ResolvedNotificationRecipients = {
  user: NotificationRecipientRef;
  agent: NotificationRecipientRef;
};

/** 从 config 解析通知收件主体（worlds 段 SSOT，兼容旧 notifications 段） */
export function resolveNotificationRecipients(config: AnimaConfig): ResolvedNotificationRecipients {
  const { user_subject_id, agent_subject_id } = resolveWorldSubjectIds(config);
  return {
    user: {
      kind: "user",
      id: String(user_subject_id),
    },
    agent: {
      kind: "agent",
      id: String(agent_subject_id),
    },
  };
}
