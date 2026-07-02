import { z } from "zod";

import {
  DIARY_ENTRY_COMPONENT,
  DREAM_ENTRY_COMPONENT,
  EMAIL_ACCOUNT_COMPONENT,
  EMAIL_MESSAGE_COMPONENT,
  EMAIL_THREAD_COMPONENT,
  emailDirectionSchema,
  taskItemPrioritySchema,
  taskItemStatusSchema,
  TASK_ITEM_COMPONENT,
  VAULT_ITEM_COMPONENT,
  vaultItemTypeSchema,
} from "./components/index.ts";

/** task_item 结构化搜索 filters（EntitySearchOpts.filters） */
export const taskItemSearchFiltersSchema = z
  .object({
    list_id: z.number().int().positive().optional(),
    status: z.union([taskItemStatusSchema, z.literal("all")]).optional(),
    priority: taskItemPrioritySchema.optional(),
    tags: z.array(z.string()).optional(),
    due_today: z.boolean().optional(),
    due_before: z.string().optional(),
    due_after: z.string().optional(),
  })
  .strict();

export type TaskItemSearchFilters = z.infer<typeof taskItemSearchFiltersSchema>;

export function parseTaskItemSearchFilters(
  raw: Record<string, unknown> | undefined,
): TaskItemSearchFilters {
  if (!raw || Object.keys(raw).length === 0) return {};
  const parsed = taskItemSearchFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid task_item filters: ${parsed.error.message}`);
  }
  return parsed.data;
}

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

export const dreamEntrySearchFiltersSchema = z
  .object({
    dream_day: z.string().optional(),
    dream_after: z.string().optional(),
    dream_before: z.string().optional(),
  })
  .strict();

export type DreamEntrySearchFilters = z.infer<typeof dreamEntrySearchFiltersSchema>;

export function parseDreamEntrySearchFilters(
  raw: Record<string, unknown> | undefined,
): DreamEntrySearchFilters {
  if (!raw || Object.keys(raw).length === 0) return {};
  const parsed = dreamEntrySearchFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid dream_entry filters: ${parsed.error.message}`);
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

export const ENTITY_SEARCH_FILTER_COMPONENTS = {
  [TASK_ITEM_COMPONENT]: taskItemSearchFiltersSchema,
  [DIARY_ENTRY_COMPONENT]: diaryEntrySearchFiltersSchema,
  [DREAM_ENTRY_COMPONENT]: dreamEntrySearchFiltersSchema,
  [EMAIL_ACCOUNT_COMPONENT]: emailAccountSearchFiltersSchema,
  [EMAIL_THREAD_COMPONENT]: emailThreadSearchFiltersSchema,
  [EMAIL_MESSAGE_COMPONENT]: emailMessageSearchFiltersSchema,
  [VAULT_ITEM_COMPONENT]: vaultItemSearchFiltersSchema,
} as const;
