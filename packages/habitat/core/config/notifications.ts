import type { NotificationRecipientKind } from "@freeanima/habitat/core/db/pg/notifications/types";
import type { RuntimeConfig } from "./schemas/runtime-config.ts";
import { getResolvedWorldContext } from "./resolved-world-context.ts";

export type NotificationRecipientRef = {
  kind: NotificationRecipientKind;
  id: number;
};

export type ResolvedNotificationRecipients = {
  user: NotificationRecipientRef;
  agent: NotificationRecipientRef;
};

/** 从 ResolvedWorldContext（boot 后）解析通知收件主体；agent = 默认聊天 agent（仅收件别名） */
export function resolveNotificationRecipients(
  config: RuntimeConfig,
): ResolvedNotificationRecipients {
  void config;
  const ctx = getResolvedWorldContext();
  return {
    user: { kind: "user", id: ctx.user_subject_id },
    agent: { kind: "agent", id: ctx.default_chat_agent_subject_id },
  };
}
