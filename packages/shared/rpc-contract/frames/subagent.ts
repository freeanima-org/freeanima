import { z } from "zod";

import { notificationRecipientKindSchema } from "./notification.ts";

const subjectKindSchema = notificationRecipientKindSchema;

const temperatureTierSchema = z.enum(["focused", "balanced", "creative"]);

export const subagentRowSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  content: z.string(),
  skills: z.array(z.string()),
  max_turns: z.number().int().positive().nullable(),
  temperature_tier: temperatureTierSchema.nullable(),
  allowed_tools: z.array(z.string()),
  denied_tools: z.array(z.string()),
  prompt_includes: z.array(z.enum(["self", "world", "time"])).default([]),
  world_id: z.number().int().positive(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type SubagentRowPayload = z.infer<typeof subagentRowSchema>;

export const subagentListInputSchema = z.object({
  subject_kind: subjectKindSchema,
});
export type SubagentListInput = z.infer<typeof subagentListInputSchema>;
export const subagentListOutputSchema = z.object({ items: z.array(subagentRowSchema) });
export type SubagentListOutput = z.infer<typeof subagentListOutputSchema>;

export const subagentGetInputSchema = z.object({
  subject_kind: subjectKindSchema,
  id: z.number().int().positive().optional(),
  slug: z.string().optional(),
});
export type SubagentGetInput = z.infer<typeof subagentGetInputSchema>;
export const subagentGetOutputSchema = z.object({ item: subagentRowSchema });
export type SubagentGetOutput = z.infer<typeof subagentGetOutputSchema>;

export const subagentCreateInputSchema = z.object({
  subject_kind: subjectKindSchema,
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().optional(),
  content: z.string().optional(),
  skills: z.array(z.string()).optional(),
  max_turns: z.number().int().positive().nullable().optional(),
  temperature_tier: temperatureTierSchema.nullable().optional(),
  allowed_tools: z.array(z.string()).optional(),
  denied_tools: z.array(z.string()).optional(),
  prompt_includes: z.array(z.enum(["self", "world", "time"])).optional(),
});
export type SubagentCreateInput = z.infer<typeof subagentCreateInputSchema>;
export const subagentCreateOutputSchema = z.object({ item: subagentRowSchema });
export type SubagentCreateOutput = z.infer<typeof subagentCreateOutputSchema>;

export const subagentPatchInputSchema = z.object({
  subject_kind: subjectKindSchema,
  id: z.number().int().positive(),
  slug: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  content: z.string().optional(),
  skills: z.array(z.string()).optional(),
  max_turns: z.number().int().positive().nullable().optional(),
  temperature_tier: temperatureTierSchema.nullable().optional(),
  allowed_tools: z.array(z.string()).optional(),
  denied_tools: z.array(z.string()).optional(),
  prompt_includes: z.array(z.enum(["self", "world", "time"])).optional(),
});
export type SubagentPatchInput = z.infer<typeof subagentPatchInputSchema>;
export const subagentPatchOutputSchema = z.object({ item: subagentRowSchema });
export type SubagentPatchOutput = z.infer<typeof subagentPatchOutputSchema>;

export const subagentDeleteInputSchema = z.object({
  subject_kind: subjectKindSchema,
  id: z.number().int().positive(),
});
export type SubagentDeleteInput = z.infer<typeof subagentDeleteInputSchema>;
export const subagentDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type SubagentDeleteOutput = z.infer<typeof subagentDeleteOutputSchema>;
