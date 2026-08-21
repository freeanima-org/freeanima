import { z } from "zod";

export const SHELL_QUICK_ALLOWED_PRIMARIES = [
  "project",
  "task_list",
  "note",
  "diary_entry",
  "email_account",
] as const;

export const shellQuickAllowedPrimarySchema = z.enum(SHELL_QUICK_ALLOWED_PRIMARIES);
export type ShellQuickAllowedPrimary = z.infer<typeof shellQuickAllowedPrimarySchema>;

export const shellQuickEntryRowSchema = z.object({
  id: z.number().int().positive(),
  primary_component: shellQuickAllowedPrimarySchema,
  title: z.string(),
  quick_sort_order: z.number().int(),
});

export type ShellQuickEntryRowPayload = z.infer<typeof shellQuickEntryRowSchema>;

export const shellQuickListInputSchema = z.object({
  subject_id: z.number().int().positive(),
});
export type ShellQuickListInput = z.infer<typeof shellQuickListInputSchema>;
export const shellQuickListOutputSchema = z.object({
  entries: z.array(shellQuickEntryRowSchema),
});
export type ShellQuickListOutput = z.infer<typeof shellQuickListOutputSchema>;

export const shellQuickAttachInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type ShellQuickAttachInput = z.infer<typeof shellQuickAttachInputSchema>;
export const shellQuickAttachOutputSchema = z.object({
  entry: shellQuickEntryRowSchema,
});
export type ShellQuickAttachOutput = z.infer<typeof shellQuickAttachOutputSchema>;

export const shellQuickDetachInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type ShellQuickDetachInput = z.infer<typeof shellQuickDetachInputSchema>;
export const shellQuickDetachOutputSchema = z.object({
  ok: z.literal(true),
});
export type ShellQuickDetachOutput = z.infer<typeof shellQuickDetachOutputSchema>;
