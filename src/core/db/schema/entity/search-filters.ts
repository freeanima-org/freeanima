import { z } from "zod";

import {
  CONTENT_BLOCK_COMPONENT,
  DIARY_ENTRY_COMPONENT,
  EMAIL_ACCOUNT_COMPONENT,
  EMAIL_MESSAGE_COMPONENT,
  EMAIL_THREAD_COMPONENT,
  emailDirectionSchema,
  TAG_COMPONENT,
  pomodoroPhaseSchema,
  POMODORO_SESSION_COMPONENT,
  POMODORO_TASK_FOCUS_COMPONENT,
  PROJECT_COMPONENT,
  PROJECT_FOLDER_COMPONENT,
  TASK_ITEM_COMPONENT,
  TASK_LIST_COMPONENT,
  VAULT_ITEM_COMPONENT,
  vaultItemTypeSchema,
} from "./components/index.ts";
import { contentBlockSearchFiltersSchema } from "./content-block-search-filters.ts";
import { tagSearchFiltersSchema } from "./tag-search-filters.ts";
import { taskItemSearchFiltersSchema } from "./task-item-search-filters.ts";

export {
  parseTaskItemSearchFilters,
  taskItemSearchFiltersSchema,
  taskRelativeDaySchema,
  type TaskItemSearchFilters,
} from "./task-item-search-filters.ts";

export {
  contentBlockSearchFiltersSchema,
  parseContentBlockSearchFilters,
  type ContentBlockSearchFilters,
} from "./content-block-search-filters.ts";

export {
  parseTagSearchFilters,
  tagSearchFiltersSchema,
  type TagSearchFilters,
} from "./tag-search-filters.ts";

export const emailAccountSearchFiltersSchema = z
  .object({
    enabled: z.boolean().optional(),
    default_sender: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict();

export type EmailAccountSearchFilters = z.infer<typeof emailAccountSearchFiltersSchema>;

export function parseEmailAccountSearchFilters(
  raw: Record<string, unknown> | undefined,
): EmailAccountSearchFilters {
  if (!raw || Object.keys(raw).length === 0) return {};
  const parsed = emailAccountSearchFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid email_account filters: ${parsed.error.message}`);
  }
  return parsed.data;
}

export const emailThreadSearchFiltersSchema = z
  .object({
    account_id: z.number().int().positive().optional(),
    thread_key: z.string().min(1).optional(),
    tags: z.array(z.string()).optional(),
    has_unread: z.boolean().optional(),
  })
  .strict();

export type EmailThreadSearchFilters = z.infer<typeof emailThreadSearchFiltersSchema>;

export function parseEmailThreadSearchFilters(
  raw: Record<string, unknown> | undefined,
): EmailThreadSearchFilters {
  if (!raw || Object.keys(raw).length === 0) return {};
  const parsed = emailThreadSearchFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid email_thread filters: ${parsed.error.message}`);
  }
  return parsed.data;
}

export const emailMessageSearchFiltersSchema = z
  .object({
    account_id: z.number().int().positive().optional(),
    thread_id: z.number().int().positive().optional(),
    imap_uid: z.number().int().positive().optional(),
    imap_mailbox: z.string().min(1).optional(),
    unread: z.boolean().optional(),
    direction: emailDirectionSchema.optional(),
    tags: z.array(z.string()).optional(),
    since: z.string().optional(),
    before: z.string().optional(),
  })
  .strict();

export type EmailMessageSearchFilters = z.infer<typeof emailMessageSearchFiltersSchema>;

export function parseEmailMessageSearchFilters(
  raw: Record<string, unknown> | undefined,
): EmailMessageSearchFilters {
  if (!raw || Object.keys(raw).length === 0) return {};
  const parsed = emailMessageSearchFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid email_message filters: ${parsed.error.message}`);
  }
  return parsed.data;
}

export const diaryEntrySearchFiltersSchema = z
  .object({
    entry_after: z.string().optional(),
    entry_before: z.string().optional(),
    tags: z.array(z.string()).optional(),
    client_op_id: z.string().min(1).optional(),
  })
  .strict();

export type DiaryEntrySearchFilters = z.infer<typeof diaryEntrySearchFiltersSchema>;

export function parseDiaryEntrySearchFilters(
  raw: Record<string, unknown> | undefined,
): DiaryEntrySearchFilters {
  if (!raw || Object.keys(raw).length === 0) return {};
  const parsed = diaryEntrySearchFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid diary_entry filters: ${parsed.error.message}`);
  }
  return parsed.data;
}

export const vaultItemSearchFiltersSchema = z
  .object({
    item_type: vaultItemTypeSchema.optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict();

export type VaultItemSearchFilters = z.infer<typeof vaultItemSearchFiltersSchema>;

export function parseVaultItemSearchFilters(
  raw: Record<string, unknown> | undefined,
): VaultItemSearchFilters {
  if (!raw || Object.keys(raw).length === 0) return {};
  const parsed = vaultItemSearchFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid vault_item filters: ${parsed.error.message}`);
  }
  return parsed.data;
}

export const pomodoroSessionSearchFiltersSchema = z
  .object({
    started_after: z.string().optional(),
    started_before: z.string().optional(),
    phase: pomodoroPhaseSchema.optional(),
    interrupted: z.boolean().optional(),
    task_item_id: z.number().int().positive().optional(),
    client_op_id: z.string().min(1).optional(),
  })
  .strict();

export type PomodoroSessionSearchFilters = z.infer<typeof pomodoroSessionSearchFiltersSchema>;

export function parsePomodoroSessionSearchFilters(
  raw: Record<string, unknown> | undefined,
): PomodoroSessionSearchFilters {
  if (!raw || Object.keys(raw).length === 0) return {};
  const parsed = pomodoroSessionSearchFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid pomodoro_session filters: ${parsed.error.message}`);
  }
  return parsed.data;
}

export const pomodoroTaskFocusSearchFiltersSchema = z
  .object({
    task_item_id: z.number().int().positive().optional(),
    session_local_id: z.string().min(1).optional(),
    pomodoro_session_id: z.number().int().positive().optional(),
    phase_started_at: z.string().optional(),
    started_after: z.string().optional(),
    started_before: z.string().optional(),
  })
  .strict();

export type PomodoroTaskFocusSearchFilters = z.infer<typeof pomodoroTaskFocusSearchFiltersSchema>;

export function parsePomodoroTaskFocusSearchFilters(
  raw: Record<string, unknown> | undefined,
): PomodoroTaskFocusSearchFilters {
  if (!raw || Object.keys(raw).length === 0) return {};
  const parsed = pomodoroTaskFocusSearchFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid pomodoro_task_focus filters: ${parsed.error.message}`);
  }
  return parsed.data;
}

export const taskListSearchFiltersSchema = z
  .object({
    client_op_id: z.string().min(1).optional(),
  })
  .strict();

export type TaskListSearchFilters = z.infer<typeof taskListSearchFiltersSchema>;

export function parseTaskListSearchFilters(
  raw: Record<string, unknown> | undefined,
): TaskListSearchFilters {
  if (!raw || Object.keys(raw).length === 0) return {};
  const parsed = taskListSearchFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid task_list filters: ${parsed.error.message}`);
  }
  return parsed.data;
}

export const projectFolderSearchFiltersSchema = z
  .object({
    client_op_id: z.string().min(1).optional(),
  })
  .strict();

export type ProjectFolderSearchFilters = z.infer<typeof projectFolderSearchFiltersSchema>;

export function parseProjectFolderSearchFilters(
  raw: Record<string, unknown> | undefined,
): ProjectFolderSearchFilters {
  if (!raw || Object.keys(raw).length === 0) return {};
  const parsed = projectFolderSearchFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid project_folder filters: ${parsed.error.message}`);
  }
  return parsed.data;
}

export const projectSearchFiltersSchema = z
  .object({
    client_op_id: z.string().min(1).optional(),
  })
  .strict();

export type ProjectSearchFilters = z.infer<typeof projectSearchFiltersSchema>;

export function parseProjectSearchFilters(
  raw: Record<string, unknown> | undefined,
): ProjectSearchFilters {
  if (!raw || Object.keys(raw).length === 0) return {};
  const parsed = projectSearchFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid project filters: ${parsed.error.message}`);
  }
  return parsed.data;
}

export const ENTITY_SEARCH_FILTER_COMPONENTS = {
  [TASK_ITEM_COMPONENT]: taskItemSearchFiltersSchema,
  [TASK_LIST_COMPONENT]: taskListSearchFiltersSchema,
  [PROJECT_FOLDER_COMPONENT]: projectFolderSearchFiltersSchema,
  [PROJECT_COMPONENT]: projectSearchFiltersSchema,
  [TAG_COMPONENT]: tagSearchFiltersSchema,
  [CONTENT_BLOCK_COMPONENT]: contentBlockSearchFiltersSchema,
  [DIARY_ENTRY_COMPONENT]: diaryEntrySearchFiltersSchema,
  [EMAIL_ACCOUNT_COMPONENT]: emailAccountSearchFiltersSchema,
  [EMAIL_THREAD_COMPONENT]: emailThreadSearchFiltersSchema,
  [EMAIL_MESSAGE_COMPONENT]: emailMessageSearchFiltersSchema,
  [VAULT_ITEM_COMPONENT]: vaultItemSearchFiltersSchema,
  [POMODORO_SESSION_COMPONENT]: pomodoroSessionSearchFiltersSchema,
  [POMODORO_TASK_FOCUS_COMPONENT]: pomodoroTaskFocusSearchFiltersSchema,
} as const;
