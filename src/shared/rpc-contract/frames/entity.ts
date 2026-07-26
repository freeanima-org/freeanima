import { z } from "zod";

import { notificationRecipientKindSchema } from "./notification.ts";

const entitySubjectKindSchema = notificationRecipientKindSchema;

export const entityAdminRowSchema = z.object({
  id: z.number().int().positive(),
  type: z.string(),
  title: z.string(),
  primary_component: z.string().nullable(),
  components: z.array(z.string()),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
  world_id: z.number().int().positive(),
});
export type EntityAdminRowPayload = z.infer<typeof entityAdminRowSchema>;

export const entityReferenceHitSchema = z.object({
  entity_id: z.number().int().positive(),
  via: z.string(),
});
export type EntityReferenceHitPayload = z.infer<typeof entityReferenceHitSchema>;

export const entityListInputSchema = z.object({
  subject_kind: entitySubjectKindSchema,
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type EntityListInput = z.infer<typeof entityListInputSchema>;
export const entityListOutputSchema = z.object({
  items: z.array(entityAdminRowSchema),
  count: z.number().int().nonnegative(),
});
export type EntityListOutput = z.infer<typeof entityListOutputSchema>;

export const entityTrashListInputSchema = entityListInputSchema;
export type EntityTrashListInput = z.infer<typeof entityTrashListInputSchema>;
export const entityTrashListOutputSchema = entityListOutputSchema;
export type EntityTrashListOutput = z.infer<typeof entityTrashListOutputSchema>;

export const entityDeleteInputSchema = z.object({
  subject_kind: entitySubjectKindSchema,
  id: z.number().int().positive(),
  force: z.boolean().optional(),
});
export type EntityDeleteInput = z.infer<typeof entityDeleteInputSchema>;
export const entityDeleteOutputSchema = z.object({
  ok: z.boolean(),
  references: z.array(entityReferenceHitSchema).optional(),
});
export type EntityDeleteOutput = z.infer<typeof entityDeleteOutputSchema>;

export const entityRestoreInputSchema = z.object({
  subject_kind: entitySubjectKindSchema,
  id: z.number().int().positive(),
});
export type EntityRestoreInput = z.infer<typeof entityRestoreInputSchema>;
export const entityRestoreOutputSchema = z.object({ ok: z.literal(true) });
export type EntityRestoreOutput = z.infer<typeof entityRestoreOutputSchema>;

export const entityDeleteComponentInputSchema = z.object({
  subject_kind: entitySubjectKindSchema,
  id: z.number().int().positive(),
  component: z.string().min(1),
});
export type EntityDeleteComponentInput = z.infer<typeof entityDeleteComponentInputSchema>;
export const entityDeleteComponentOutputSchema = z.object({ item: entityAdminRowSchema });
export type EntityDeleteComponentOutput = z.infer<typeof entityDeleteComponentOutputSchema>;
