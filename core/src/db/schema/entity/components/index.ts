import { z } from "zod";

import { AGENT_CONFIG_COMPONENT, agentConfigBodySchema } from "./agent-config.ts";
import { DIARY_ENTRY_COMPONENT, diaryEntryBodySchema } from "./diary-entry.ts";
import { DREAM_ENTRY_COMPONENT, dreamEntryBodySchema } from "./dream-entry.ts";
import { EMAIL_ACCOUNT_COMPONENT, emailAccountBodySchema } from "./email-account.ts";
import { EMAIL_MESSAGE_COMPONENT, emailMessageBodySchema } from "./email-message.ts";
import { EMAIL_THREAD_COMPONENT, emailThreadBodySchema } from "./email-thread.ts";
import { TASK_ITEM_COMPONENT, taskItemBodySchema } from "./task-item.ts";
import { TASK_LIST_COMPONENT, taskListBodySchema } from "./task-list.ts";
import { USER_CONFIG_COMPONENT, userConfigBodySchema } from "./user-config.ts";
import { WORLD_CONFIG_COMPONENT, worldConfigBodySchema } from "./world-config.ts";

export const COMPONENT_IDS = [
  WORLD_CONFIG_COMPONENT,
  AGENT_CONFIG_COMPONENT,
  USER_CONFIG_COMPONENT,
  TASK_LIST_COMPONENT,
  TASK_ITEM_COMPONENT,
  DIARY_ENTRY_COMPONENT,
  DREAM_ENTRY_COMPONENT,
  EMAIL_ACCOUNT_COMPONENT,
  EMAIL_THREAD_COMPONENT,
  EMAIL_MESSAGE_COMPONENT,
] as const;

export type ComponentId = (typeof COMPONENT_IDS)[number];

export const primaryComponentSchema = z.enum(COMPONENT_IDS);

const COMPONENT_BODY_SCHEMAS: Record<ComponentId, z.ZodTypeAny> = {
  [WORLD_CONFIG_COMPONENT]: worldConfigBodySchema,
  [AGENT_CONFIG_COMPONENT]: agentConfigBodySchema,
  [USER_CONFIG_COMPONENT]: userConfigBodySchema,
  [TASK_LIST_COMPONENT]: taskListBodySchema,
  [TASK_ITEM_COMPONENT]: taskItemBodySchema,
  [DIARY_ENTRY_COMPONENT]: diaryEntryBodySchema,
  [DREAM_ENTRY_COMPONENT]: dreamEntryBodySchema,
  [EMAIL_ACCOUNT_COMPONENT]: emailAccountBodySchema,
  [EMAIL_THREAD_COMPONENT]: emailThreadBodySchema,
  [EMAIL_MESSAGE_COMPONENT]: emailMessageBodySchema,
};

export function componentBodySchema(component: ComponentId): z.ZodTypeAny {
  return COMPONENT_BODY_SCHEMAS[component];
}

export function isKnownComponent(value: string): value is ComponentId {
  return (COMPONENT_IDS as readonly string[]).includes(value);
}

export * from "./schedulable.ts";
export * from "./subject-config.ts";
export * from "./world-config.ts";
export * from "./agent-config.ts";
export * from "./user-config.ts";
export * from "./task-list.ts";
export * from "./task-item.ts";
export * from "./diary-entry.ts";
export * from "./dream-entry.ts";
export * from "./email-account.ts";
export * from "./email-thread.ts";
export * from "./email-message.ts";
