import { z } from "zod";

import { notificationRecipientKindSchema } from "./notification.ts";

const projectSubjectKindSchema = notificationRecipientKindSchema;

export const projectStatusSchema = z.enum(["active", "completed", "cancelled", "on_hold"]);

export const projectFolderRowSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  parent_id: z.number().int().positive().nullable(),
  sort_order: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ProjectFolderRowPayload = z.infer<typeof projectFolderRowSchema>;

export const projectRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  folder_id: z.number().int().positive().nullable(),
  start_at: z.string().nullable(),
  end_at: z.string().nullable(),
  status: projectStatusSchema,
  product_tag: z.string().nullable(),
  sort_order: z.number().int(),
  /** 次要数据：仅 project.stats 返回；list/get/create/patch 省略 */
  task_count: z.number().int().nonnegative().optional(),
  linked_diary_ids: z.array(z.number().int().positive()),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ProjectRowPayload = z.infer<typeof projectRowSchema>;

export const projectfolderListInputSchema = z.object({
  subject_kind: projectSubjectKindSchema,
});
export type ProjectfolderListInput = z.infer<typeof projectfolderListInputSchema>;
export const projectfolderListOutputSchema = z.object({
  folders: z.array(projectFolderRowSchema),
});
export type ProjectfolderListOutput = z.infer<typeof projectfolderListOutputSchema>;

export const projectfolderCreateInputSchema = z.object({
  subject_kind: projectSubjectKindSchema,
  name: z.string().min(1),
  parent_id: z.number().int().positive().nullable().optional(),
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type ProjectfolderCreateInput = z.infer<typeof projectfolderCreateInputSchema>;
export const projectfolderCreateOutputSchema = z.object({ item: projectFolderRowSchema });
export type ProjectfolderCreateOutput = z.infer<typeof projectfolderCreateOutputSchema>;

export const projectfolderPatchInputSchema = z.object({
  subject_kind: projectSubjectKindSchema,
  id: z.number().int().positive(),
  name: z.string().min(1).optional(),
  parent_id: z.number().int().positive().nullable().optional(),
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type ProjectfolderPatchInput = z.infer<typeof projectfolderPatchInputSchema>;
export const projectfolderPatchOutputSchema = z.object({ item: projectFolderRowSchema });
export type ProjectfolderPatchOutput = z.infer<typeof projectfolderPatchOutputSchema>;

export const projectfolderDeleteInputSchema = z.object({
  subject_kind: projectSubjectKindSchema,
  id: z.number().int().positive(),
  client_op_id: z.string().min(1).optional(),
});
export type ProjectfolderDeleteInput = z.infer<typeof projectfolderDeleteInputSchema>;
export const projectfolderDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type ProjectfolderDeleteOutput = z.infer<typeof projectfolderDeleteOutputSchema>;

export const projectListInputSchema = z.object({
  subject_kind: projectSubjectKindSchema,
  folder_id: z.number().int().positive().nullable().optional(),
  status: projectStatusSchema.optional(),
});
export type ProjectListInput = z.infer<typeof projectListInputSchema>;
export const projectListOutputSchema = z.object({ projects: z.array(projectRowSchema) });
export type ProjectListOutput = z.infer<typeof projectListOutputSchema>;

export const projectStatsInputSchema = z.object({
  subject_kind: projectSubjectKindSchema,
  folder_id: z.number().int().positive().nullable().optional(),
  status: projectStatusSchema.optional(),
});
export type ProjectStatsInput = z.infer<typeof projectStatsInputSchema>;
export const projectStatsOutputSchema = z.object({
  counts: z.array(
    z.object({
      id: z.number().int().positive(),
      task_count: z.number().int().nonnegative(),
    }),
  ),
});
export type ProjectStatsOutput = z.infer<typeof projectStatsOutputSchema>;

export const projectCreateInputSchema = z.object({
  subject_kind: projectSubjectKindSchema,
  title: z.string().min(1),
  start_at: z.string().nullable().optional(),
  end_at: z.string().nullable().optional(),
  content: z.string().optional(),
  folder_id: z.number().int().positive().nullable().optional(),
  product_tag: z.string().optional(),
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type ProjectCreateInput = z.infer<typeof projectCreateInputSchema>;
export const projectCreateOutputSchema = z.object({ item: projectRowSchema });
export type ProjectCreateOutput = z.infer<typeof projectCreateOutputSchema>;

export const projectGetInputSchema = z.object({
  subject_kind: projectSubjectKindSchema,
  id: z.number().int().positive(),
});
export type ProjectGetInput = z.infer<typeof projectGetInputSchema>;
export const projectGetOutputSchema = z.object({ item: projectRowSchema });
export type ProjectGetOutput = z.infer<typeof projectGetOutputSchema>;

export const projectPatchInputSchema = z.object({
  subject_kind: projectSubjectKindSchema,
  id: z.number().int().positive(),
  title: z.string().min(1).optional(),
  start_at: z.string().nullable().optional(),
  end_at: z.string().nullable().optional(),
  content: z.string().optional(),
  folder_id: z.number().int().positive().nullable().optional(),
  product_tag: z.string().nullable().optional(),
  status: projectStatusSchema.optional(),
  sort_order: z.number().int().optional(),
  release_tasks: z.boolean().optional(),
  linked_diary_ids: z.array(z.number().int().positive()).optional(),
  client_op_id: z.string().min(1).optional(),
});
export type ProjectPatchInput = z.infer<typeof projectPatchInputSchema>;
export const projectPatchOutputSchema = z.object({ item: projectRowSchema });
export type ProjectPatchOutput = z.infer<typeof projectPatchOutputSchema>;

export const projectDeleteInputSchema = z.object({
  subject_kind: projectSubjectKindSchema,
  id: z.number().int().positive(),
  client_op_id: z.string().min(1).optional(),
});
export type ProjectDeleteInput = z.infer<typeof projectDeleteInputSchema>;
export const projectDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type ProjectDeleteOutput = z.infer<typeof projectDeleteOutputSchema>;
