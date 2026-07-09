import { z } from "zod";

import { COMPANION_PROFILE_COMPONENT, companionProfileBodySchema } from "./companion-profile.ts";
import { VAULT_CONFIG_COMPONENT, vaultConfigBodySchema } from "./vault-config.ts";
import { VAULT_ITEM_COMPONENT, vaultItemBodySchema } from "./vault-item.ts";
import { POMODORO_CONFIG_COMPONENT, pomodoroConfigBodySchema } from "./pomodoro-config.ts";
import { POMODORO_SESSION_COMPONENT, pomodoroSessionBodySchema } from "./pomodoro-session.ts";
import {
  POMODORO_TASK_FOCUS_COMPONENT,
  pomodoroTaskFocusBodySchema,
} from "./pomodoro-task-focus.ts";
import { AGENT_CONFIG_COMPONENT, agentConfigBodySchema } from "./agent-config.ts";
import { DIARY_ENTRY_COMPONENT, diaryEntryBodySchema } from "./diary-entry.ts";
import { DREAM_ENTRY_COMPONENT, dreamEntryBodySchema } from "./dream-entry.ts";
import { EMAIL_ACCOUNT_COMPONENT, emailAccountBodySchema } from "./email-account.ts";
import { EMAIL_MESSAGE_COMPONENT, emailMessageBodySchema } from "./email-message.ts";
import { EMAIL_THREAD_COMPONENT, emailThreadBodySchema } from "./email-thread.ts";
import { TASK_ITEM_COMPONENT, taskItemBodySchema } from "./task-item.ts";
import { TASK_LIST_COMPONENT, taskListBodySchema } from "./task-list.ts";
import { SMART_LIST_COMPONENT, smartListBodySchema } from "./smart-list.ts";
import { PROJECT_FOLDER_COMPONENT, projectFolderBodySchema } from "./project-folder.ts";
import { PROJECT_COMPONENT, projectBodySchema } from "./project.ts";
import { MILESTONE_COMPONENT, milestoneBodySchema } from "./milestone.ts";
import { USER_CONFIG_COMPONENT, userConfigBodySchema } from "./user-config.ts";
import { WORLD_CONFIG_COMPONENT, worldConfigBodySchema } from "./world-config.ts";

export const COMPONENT_IDS = [
  WORLD_CONFIG_COMPONENT,
  AGENT_CONFIG_COMPONENT,
  USER_CONFIG_COMPONENT,
  TASK_LIST_COMPONENT,
  SMART_LIST_COMPONENT,
  TASK_ITEM_COMPONENT,
  PROJECT_FOLDER_COMPONENT,
  PROJECT_COMPONENT,
  MILESTONE_COMPONENT,
  DIARY_ENTRY_COMPONENT,
  DREAM_ENTRY_COMPONENT,
  EMAIL_ACCOUNT_COMPONENT,
  EMAIL_THREAD_COMPONENT,
  EMAIL_MESSAGE_COMPONENT,
  VAULT_CONFIG_COMPONENT,
  VAULT_ITEM_COMPONENT,
  POMODORO_CONFIG_COMPONENT,
  POMODORO_SESSION_COMPONENT,
  POMODORO_TASK_FOCUS_COMPONENT,
  COMPANION_PROFILE_COMPONENT,
] as const;

export type ComponentId = (typeof COMPONENT_IDS)[number];

export const primaryComponentSchema = z.enum(COMPONENT_IDS);

const COMPONENT_BODY_SCHEMAS: Record<ComponentId, z.ZodTypeAny> = {
  [WORLD_CONFIG_COMPONENT]: worldConfigBodySchema,
  [AGENT_CONFIG_COMPONENT]: agentConfigBodySchema,
  [USER_CONFIG_COMPONENT]: userConfigBodySchema,
  [TASK_LIST_COMPONENT]: taskListBodySchema,
  [SMART_LIST_COMPONENT]: smartListBodySchema,
  [TASK_ITEM_COMPONENT]: taskItemBodySchema,
  [PROJECT_FOLDER_COMPONENT]: projectFolderBodySchema,
  [PROJECT_COMPONENT]: projectBodySchema,
  [MILESTONE_COMPONENT]: milestoneBodySchema,
  [DIARY_ENTRY_COMPONENT]: diaryEntryBodySchema,
  [DREAM_ENTRY_COMPONENT]: dreamEntryBodySchema,
  [EMAIL_ACCOUNT_COMPONENT]: emailAccountBodySchema,
  [EMAIL_THREAD_COMPONENT]: emailThreadBodySchema,
  [EMAIL_MESSAGE_COMPONENT]: emailMessageBodySchema,
  [VAULT_CONFIG_COMPONENT]: vaultConfigBodySchema,
  [VAULT_ITEM_COMPONENT]: vaultItemBodySchema,
  [COMPANION_PROFILE_COMPONENT]: companionProfileBodySchema,
  [POMODORO_CONFIG_COMPONENT]: pomodoroConfigBodySchema,
  [POMODORO_SESSION_COMPONENT]: pomodoroSessionBodySchema,
  [POMODORO_TASK_FOCUS_COMPONENT]: pomodoroTaskFocusBodySchema,
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
export * from "./smart-list.ts";
export * from "./task-item.ts";
export * from "./project-folder.ts";
export * from "./project.ts";
export * from "./milestone.ts";
export * from "./diary-entry.ts";
export * from "./dream-entry.ts";
export * from "./email-account.ts";
export * from "./email-thread.ts";
export * from "./email-message.ts";
export * from "./vault-config.ts";
export * from "./vault-item.ts";
export * from "./companion-profile.ts";
export * from "./pomodoro-config.ts";
export * from "./pomodoro-session.ts";
export * from "./pomodoro-task-focus.ts";
