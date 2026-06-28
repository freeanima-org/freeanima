import type { NotificationRecipientKind } from "@freeanima/core/repos";
import type { AnimaConfig } from "./schemas/config.ts";

export type NotificationRecipientRef = {
  kind: NotificationRecipientKind;
  id: string;
};

export type ResolvedNotificationRecipients = {
  user: NotificationRecipientRef;
  agent: NotificationRecipientRef;
};

/** 从 config 解析通知收件主体；未配置时回退 default id */
export function resolveNotificationRecipients(config: AnimaConfig): ResolvedNotificationRecipients {
  const section = config.notifications;
  return {
    user: {
      kind: "user",
      id: section?.user_subject_id != null ? String(section.user_subject_id) : "default",
    },
    agent: {
      kind: "agent",
      id: section?.agent_subject_id != null ? String(section.agent_subject_id) : "default",
    },
  };
}
