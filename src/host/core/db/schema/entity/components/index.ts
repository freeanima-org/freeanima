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
import { POMODORO_ACTIVE_COMPONENT, pomodoroActiveBodySchema } from "./pomodoro-active.ts";
import { AGENT_CONFIG_COMPONENT, agentConfigBodySchema } from "./agent-config.ts";
import { CONTENT_BLOCK_COMPONENT, contentBlockBodySchema } from "./content-block.ts";
import {
  DIARY_BLOCK_TEMPLATE_COMPONENT,
  diaryBlockTemplateBodySchema,
} from "./diary-block-template.ts";
import { DIARY_ENTRY_COMPONENT, diaryEntryBodySchema } from "./diary-entry.ts";
import { DREAM_COMPONENT, dreamBodySchema } from "./dream.ts";
import { EMAIL_ACCOUNT_COMPONENT, emailAccountBodySchema } from "./email-account.ts";
import { EMAIL_MESSAGE_COMPONENT, emailMessageBodySchema } from "./email-message.ts";
import { EMAIL_THREAD_COMPONENT, emailThreadBodySchema } from "./email-thread.ts";
import { LIMBIC_COMPONENT, limbicBodySchema } from "./limbic.ts";
import { NARRATIVE_COMPONENT, narrativeBodySchema } from "./narrative.ts";
import { OBJECT_FILE_COMPONENT, objectFileBodySchema } from "./object-file.ts";
import { OBJECT_FOLDER_COMPONENT, objectFolderBodySchema } from "./object-folder.ts";
import { SKILL_COMPONENT, skillBodySchema } from "./skill.ts";
import { SKILL_RESOURCE_COMPONENT, skillResourceBodySchema } from "./skill-resource.ts";
import { SEMANTIC_MEMORY_COMPONENT, semanticMemoryBodySchema } from "./semantic-memory.ts";
import { SEMANTIC_REF_COMPONENT, semanticRefBodySchema } from "./semantic-ref.ts";
import { TASK_ITEM_COMPONENT, taskItemBodySchema } from "./task-item.ts";
import { TASK_LIST_COMPONENT, taskListBodySchema } from "./task-list.ts";
import { SMART_LIST_COMPONENT, smartListBodySchema } from "./smart-list.ts";
import { PROJECT_FOLDER_COMPONENT, projectFolderBodySchema } from "./project-folder.ts";
import { PROJECT_COMPONENT, projectBodySchema } from "./project.ts";
import { TAG_COMPONENT, tagBodySchema } from "./tag.ts";
import { TEMPORAL_SUMMARY_COMPONENT, temporalSummaryBodySchema } from "./temporal-summary.ts";
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
  TAG_COMPONENT,
  DIARY_ENTRY_COMPONENT,
  DIARY_BLOCK_TEMPLATE_COMPONENT,
  CONTENT_BLOCK_COMPONENT,
  LIMBIC_COMPONENT,
  NARRATIVE_COMPONENT,
  DREAM_COMPONENT,
  SEMANTIC_MEMORY_COMPONENT,
  SEMANTIC_REF_COMPONENT,
  TEMPORAL_SUMMARY_COMPONENT,
  EMAIL_ACCOUNT_COMPONENT,
  EMAIL_THREAD_COMPONENT,
  EMAIL_MESSAGE_COMPONENT,
  VAULT_CONFIG_COMPONENT,
  VAULT_ITEM_COMPONENT,
  POMODORO_CONFIG_COMPONENT,
  POMODORO_SESSION_COMPONENT,
  POMODORO_TASK_FOCUS_COMPONENT,
  POMODORO_ACTIVE_COMPONENT,
  COMPANION_PROFILE_COMPONENT,
  OBJECT_FILE_COMPONENT,
  OBJECT_FOLDER_COMPONENT,
  SKILL_COMPONENT,
  SKILL_RESOURCE_COMPONENT,
] as const;

export type ComponentId = (typeof COMPONENT_IDS)[number];

export const primaryComponentSchema = z.enum(COMPONENT_IDS);

/**
 * 删除 primary 后提升用：数字越小越优先成为新的 primary_component。
 * 未列出的已知组件默认 500。
 */
export const COMPONENT_PRIMARY_PRIORITY: Record<ComponentId, number> = {
  [WORLD_CONFIG_COMPONENT]: 10,
  [AGENT_CONFIG_COMPONENT]: 10,
  [USER_CONFIG_COMPONENT]: 10,
  [TASK_LIST_COMPONENT]: 20,
  [SMART_LIST_COMPONENT]: 25,
  [TASK_ITEM_COMPONENT]: 30,
  [PROJECT_FOLDER_COMPONENT]: 35,
  [PROJECT_COMPONENT]: 40,
  [TAG_COMPONENT]: 45,
  [DIARY_ENTRY_COMPONENT]: 50,
  [DIARY_BLOCK_TEMPLATE_COMPONENT]: 55,
  [CONTENT_BLOCK_COMPONENT]: 60,
  [LIMBIC_COMPONENT]: 70,
  [NARRATIVE_COMPONENT]: 71,
  [DREAM_COMPONENT]: 72,
  [SEMANTIC_MEMORY_COMPONENT]: 80,
  [SEMANTIC_REF_COMPONENT]: 81,
  [TEMPORAL_SUMMARY_COMPONENT]: 85,
  [EMAIL_ACCOUNT_COMPONENT]: 90,
  [EMAIL_THREAD_COMPONENT]: 91,
  [EMAIL_MESSAGE_COMPONENT]: 92,
  [VAULT_CONFIG_COMPONENT]: 100,
  [VAULT_ITEM_COMPONENT]: 101,
  [POMODORO_CONFIG_COMPONENT]: 110,
  [POMODORO_SESSION_COMPONENT]: 111,
  [POMODORO_TASK_FOCUS_COMPONENT]: 112,
  [POMODORO_ACTIVE_COMPONENT]: 113,
  [COMPANION_PROFILE_COMPONENT]: 120,
  [OBJECT_FILE_COMPONENT]: 130,
  [OBJECT_FOLDER_COMPONENT]: 131,
  [SKILL_COMPONENT]: 140,
  [SKILL_RESOURCE_COMPONENT]: 141,
};

const DEFAULT_COMPONENT_PRIORITY = 500;

/** 在剩余组件中选出应提升为 primary 的组件；无剩余返回 null（空壳）。 */
export function pickPromotedPrimaryComponent(components: readonly string[]): ComponentId | null {
  const known = components.filter(isKnownComponent);
  const first = known[0];
  if (first == null) return null;
  let best: ComponentId = first;
  let bestPri = COMPONENT_PRIMARY_PRIORITY[best] ?? DEFAULT_COMPONENT_PRIORITY;
  for (const c of known.slice(1)) {
    const pri = COMPONENT_PRIMARY_PRIORITY[c] ?? DEFAULT_COMPONENT_PRIORITY;
    if (pri < bestPri) {
      best = c;
      bestPri = pri;
    }
  }
  return best;
}

const COMPONENT_BODY_SCHEMAS: Record<ComponentId, z.ZodTypeAny> = {
  [WORLD_CONFIG_COMPONENT]: worldConfigBodySchema,
  [AGENT_CONFIG_COMPONENT]: agentConfigBodySchema,
  [USER_CONFIG_COMPONENT]: userConfigBodySchema,
  [TASK_LIST_COMPONENT]: taskListBodySchema,
  [SMART_LIST_COMPONENT]: smartListBodySchema,
  [TASK_ITEM_COMPONENT]: taskItemBodySchema,
  [PROJECT_FOLDER_COMPONENT]: projectFolderBodySchema,
  [PROJECT_COMPONENT]: projectBodySchema,
  [TAG_COMPONENT]: tagBodySchema,
  [DIARY_ENTRY_COMPONENT]: diaryEntryBodySchema,
  [DIARY_BLOCK_TEMPLATE_COMPONENT]: diaryBlockTemplateBodySchema,
  [CONTENT_BLOCK_COMPONENT]: contentBlockBodySchema,
  [LIMBIC_COMPONENT]: limbicBodySchema,
  [NARRATIVE_COMPONENT]: narrativeBodySchema,
  [DREAM_COMPONENT]: dreamBodySchema,
  [SEMANTIC_MEMORY_COMPONENT]: semanticMemoryBodySchema,
  [SEMANTIC_REF_COMPONENT]: semanticRefBodySchema,
  [TEMPORAL_SUMMARY_COMPONENT]: temporalSummaryBodySchema,
  [EMAIL_ACCOUNT_COMPONENT]: emailAccountBodySchema,
  [EMAIL_THREAD_COMPONENT]: emailThreadBodySchema,
  [EMAIL_MESSAGE_COMPONENT]: emailMessageBodySchema,
  [VAULT_CONFIG_COMPONENT]: vaultConfigBodySchema,
  [VAULT_ITEM_COMPONENT]: vaultItemBodySchema,
  [COMPANION_PROFILE_COMPONENT]: companionProfileBodySchema,
  [POMODORO_CONFIG_COMPONENT]: pomodoroConfigBodySchema,
  [POMODORO_SESSION_COMPONENT]: pomodoroSessionBodySchema,
  [POMODORO_TASK_FOCUS_COMPONENT]: pomodoroTaskFocusBodySchema,
  [POMODORO_ACTIVE_COMPONENT]: pomodoroActiveBodySchema,
  [OBJECT_FILE_COMPONENT]: objectFileBodySchema,
  [OBJECT_FOLDER_COMPONENT]: objectFolderBodySchema,
  [SKILL_COMPONENT]: skillBodySchema,
  [SKILL_RESOURCE_COMPONENT]: skillResourceBodySchema,
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
export * from "./tag.ts";
export * from "./diary-entry.ts";
export * from "./diary-block-template.ts";
export * from "./dream.ts";
export * from "./content-block.ts";
export * from "./limbic.ts";
export * from "./narrative.ts";
export * from "./semantic-ref.ts";
export * from "./semantic-memory.ts";
export * from "./temporal-summary.ts";
export * from "./email-account.ts";
export * from "./email-thread.ts";
export * from "./email-message.ts";
export * from "./vault-config.ts";
export * from "./vault-item.ts";
export * from "./companion-profile.ts";
export * from "./pomodoro-config.ts";
export * from "./pomodoro-session.ts";
export * from "./pomodoro-task-focus.ts";
export * from "./pomodoro-active.ts";
export * from "./object-file.ts";
export * from "./object-folder.ts";
export * from "./skill.ts";
export * from "./skill-resource.ts";
