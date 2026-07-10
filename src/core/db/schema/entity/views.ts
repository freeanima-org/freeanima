import { z } from "zod";

import { entityTypeSchema, type EntitySelect } from "./entity.ts";
import {
  DIARY_ENTRY_COMPONENT,
  DREAM_ENTRY_COMPONENT,
  EMAIL_ACCOUNT_COMPONENT,
  EMAIL_MESSAGE_COMPONENT,
  EMAIL_THREAD_COMPONENT,
  TASK_ITEM_COMPONENT,
  TASK_LIST_COMPONENT,
  SMART_LIST_COMPONENT,
  PROJECT_FOLDER_COMPONENT,
  PROJECT_COMPONENT,
  MILESTONE_COMPONENT,
  VAULT_CONFIG_COMPONENT,
  VAULT_ITEM_COMPONENT,
  COMPANION_PROFILE_COMPONENT,
  POMODORO_CONFIG_COMPONENT,
  POMODORO_SESSION_COMPONENT,
  POMODORO_TASK_FOCUS_COMPONENT,
  POMODORO_ACTIVE_COMPONENT,
  WORLD_CONFIG_COMPONENT,
  diaryEntryBodySchema,
  dreamEntryBodySchema,
  emailAccountBodySchema,
  emailMessageBodySchema,
  emailThreadBodySchema,
  taskItemBodySchema,
  taskListBodySchema,
  smartListBodySchema,
  projectFolderBodySchema,
  projectBodySchema,
  milestoneBodySchema,
  vaultConfigBodySchema,
  vaultItemBodySchema,
  companionProfileBodySchema,
  pomodoroConfigBodySchema,
  pomodoroSessionBodySchema,
  pomodoroTaskFocusBodySchema,
  pomodoroActiveBodySchema,
  worldConfigBodySchema,
  type DiaryEntryBody,
  type DreamEntryBody,
  type EmailAccountBody,
  type EmailMessageBody,
  type EmailThreadBody,
  type TaskItemBody,
  type TaskListBody,
  type SmartListBody,
  type ProjectFolderBody,
  type ProjectBody,
  type MilestoneBody,
  type VaultConfigBody,
  type VaultItemBody,
  type CompanionProfileBody,
  type PomodoroConfigBody,
  type PomodoroSessionBody,
  type PomodoroTaskFocusBody,
  type PomodoroActiveBody,
  type WorldConfigBody,
} from "./components/index.ts";

export type EntityRow = {
  id: number;
  type: z.infer<typeof entityTypeSchema>;
  world_id: number;
  components: string[];
  primary_component: string;
  title: string;
  summary: string;
  content: string;
  body: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

export function mapEntityRow(row: EntitySelect): EntityRow {
  const typeParsed = entityTypeSchema.parse(row.type);
  return {
    id: row.id,
    type: typeParsed,
    world_id: row.world_id,
    components: [...row.components],
    primary_component: row.primary_component,
    title: row.title ?? "",
    summary: row.summary ?? "",
    content: row.content ?? "",
    body: (row.body ?? {}) as Record<string, unknown>,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function asWorld(row: EntityRow): WorldConfigBody | null {
  if (row.type !== "world" || !row.components.includes(WORLD_CONFIG_COMPONENT)) return null;
  const parsed = worldConfigBodySchema.safeParse(row.body);
  return parsed.success ? parsed.data : null;
}

export function worldAccessFromRow(row: EntityRow): WorldConfigBody | null {
  return asWorld(row);
}

export function asTaskList(row: EntityRow): (TaskListBody & { id: number; name: string }) | null {
  if (row.primary_component !== TASK_LIST_COMPONENT) return null;
  const parsed = taskListBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, name: row.title, ...parsed.data } : null;
}

export function asSmartList(
  row: EntityRow,
): (SmartListBody & { id: number; title: string }) | null {
  if (row.primary_component !== SMART_LIST_COMPONENT) return null;
  const parsed = smartListBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, title: row.title, ...parsed.data } : null;
}

export function asTaskItem(
  row: EntityRow,
): (TaskItemBody & { id: number; title: string; content: string }) | null {
  if (row.primary_component !== TASK_ITEM_COMPONENT) return null;
  const parsed = taskItemBodySchema.safeParse(row.body);
  return parsed.success
    ? { id: row.id, title: row.title, content: row.content, ...parsed.data }
    : null;
}

export function asDiaryEntry(
  row: EntityRow,
): (DiaryEntryBody & { id: number; title: string; content: string; summary: string }) | null {
  if (row.primary_component !== DIARY_ENTRY_COMPONENT) return null;
  const parsed = diaryEntryBodySchema.safeParse(row.body);
  return parsed.success
    ? { id: row.id, title: row.title, content: row.content, summary: row.summary, ...parsed.data }
    : null;
}

export function asDreamEntry(
  row: EntityRow,
): (DreamEntryBody & { id: number; content: string }) | null {
  if (row.primary_component !== DREAM_ENTRY_COMPONENT) return null;
  const parsed = dreamEntryBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, content: row.content, ...parsed.data } : null;
}

export function asEmailAccount(
  row: EntityRow,
): (EmailAccountBody & { id: number; display_name: string }) | null {
  if (row.primary_component !== EMAIL_ACCOUNT_COMPONENT) return null;
  const parsed = emailAccountBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, display_name: row.title, ...parsed.data } : null;
}

export function asEmailThread(
  row: EntityRow,
): (EmailThreadBody & { id: number; subject: string; preview: string }) | null {
  if (row.primary_component !== EMAIL_THREAD_COMPONENT) return null;
  const parsed = emailThreadBodySchema.safeParse(row.body);
  return parsed.success
    ? { id: row.id, subject: row.title, preview: row.summary, ...parsed.data }
    : null;
}

export function asEmailMessage(
  row: EntityRow,
): (EmailMessageBody & { id: number; subject: string; preview: string; body: string }) | null {
  if (row.primary_component !== EMAIL_MESSAGE_COMPONENT) return null;
  const parsed = emailMessageBodySchema.safeParse(row.body);
  return parsed.success
    ? {
        id: row.id,
        subject: row.title,
        preview: row.summary,
        body: row.content,
        ...parsed.data,
      }
    : null;
}

export function asVaultConfig(row: EntityRow): (VaultConfigBody & { id: number }) | null {
  if (row.primary_component !== VAULT_CONFIG_COMPONENT) return null;
  const parsed = vaultConfigBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, ...parsed.data } : null;
}

export function asVaultItem(
  row: EntityRow,
): (VaultItemBody & { id: number; title: string; content: string }) | null {
  if (row.primary_component !== VAULT_ITEM_COMPONENT) return null;
  const parsed = vaultItemBodySchema.safeParse(row.body);
  return parsed.success
    ? { id: row.id, title: row.title, content: row.content, ...parsed.data }
    : null;
}

export function asCompanionProfile(row: EntityRow): (CompanionProfileBody & { id: number }) | null {
  if (row.primary_component !== COMPANION_PROFILE_COMPONENT) return null;
  const parsed = companionProfileBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, ...parsed.data } : null;
}

export function asPomodoroConfig(row: EntityRow): (PomodoroConfigBody & { id: number }) | null {
  if (row.primary_component !== POMODORO_CONFIG_COMPONENT) return null;
  const parsed = pomodoroConfigBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, ...parsed.data } : null;
}

export function asPomodoroSession(
  row: EntityRow,
): (PomodoroSessionBody & { id: number; title: string }) | null {
  if (row.primary_component !== POMODORO_SESSION_COMPONENT) return null;
  const parsed = pomodoroSessionBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, title: row.title, ...parsed.data } : null;
}

export function asPomodoroTaskFocus(
  row: EntityRow,
): (PomodoroTaskFocusBody & { id: number }) | null {
  if (row.primary_component !== POMODORO_TASK_FOCUS_COMPONENT) return null;
  const parsed = pomodoroTaskFocusBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, ...parsed.data } : null;
}

export function asPomodoroActive(row: EntityRow): (PomodoroActiveBody & { id: number }) | null {
  if (row.primary_component !== POMODORO_ACTIVE_COMPONENT) return null;
  const parsed = pomodoroActiveBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, ...parsed.data } : null;
}

export function asProjectFolder(
  row: EntityRow,
): (ProjectFolderBody & { id: number; name: string }) | null {
  if (row.primary_component !== PROJECT_FOLDER_COMPONENT) return null;
  const parsed = projectFolderBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, name: row.title, ...parsed.data } : null;
}

export function asProject(
  row: EntityRow,
): (ProjectBody & { id: number; title: string; content: string }) | null {
  if (row.primary_component !== PROJECT_COMPONENT) return null;
  const parsed = projectBodySchema.safeParse(row.body);
  return parsed.success
    ? { id: row.id, title: row.title, content: row.content, ...parsed.data }
    : null;
}

export function asMilestone(
  row: EntityRow,
): (MilestoneBody & { id: number; title: string }) | null {
  if (row.primary_component !== MILESTONE_COMPONENT) return null;
  const parsed = milestoneBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, title: row.title, ...parsed.data } : null;
}
