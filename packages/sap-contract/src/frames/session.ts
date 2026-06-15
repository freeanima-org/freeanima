import { z } from "zod";

export const capabilityMaskInputSchema = z.object({
  presets: z.array(z.string()).default([]),
});

export const sessionCreateInputSchema = z.object({
  title: z.string().optional(),
  platform: z.string().optional(),
  workspace_root: z.string().optional(),
  workspace_gitignore: z.boolean().optional(),
  workspace_show_hidden: z.boolean().optional(),
  capability_mask: capabilityMaskInputSchema.optional(),
});

export type SessionCreateInput = z.infer<typeof sessionCreateInputSchema>;

export const sessionCreateOutputSchema = z.object({
  session_id: z.string(),
});

export type SessionCreateOutput = z.infer<typeof sessionCreateOutputSchema>;

export const sessionListInputSchema = z.object({
  platform: z.string().optional(),
});

export type SessionListInput = z.infer<typeof sessionListInputSchema>;

export const sessionSummarySchema = z.object({
  session_id: z.string(),
  title: z.string().optional(),
  platform: z.string().optional(),
  updated_at: z.string().optional(),
});

export type SessionSummary = z.infer<typeof sessionSummarySchema>;

export const sessionListOutputSchema = z.object({
  sessions: z.array(sessionSummarySchema),
});

export type SessionListOutput = z.infer<typeof sessionListOutputSchema>;

export const sessionMessagesInputSchema = z.object({
  session_id: z.string().min(1),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export type SessionMessagesInput = z.infer<typeof sessionMessagesInputSchema>;

export const sessionPatchTitleInputSchema = z.object({
  session_id: z.string().min(1),
  title: z.string().min(1),
});

export type SessionPatchTitleInput = z.infer<typeof sessionPatchTitleInputSchema>;

export const sessionSubscribeInputSchema = z.object({
  session_id: z.string().min(1),
});

export type SessionSubscribeInput = z.infer<typeof sessionSubscribeInputSchema>;

export const sessionUpdatedPayloadSchema = z.object({
  session_id: z.string(),
});

export type SessionUpdatedPayload = z.infer<typeof sessionUpdatedPayloadSchema>;

export const sessionCommandsInputSchema = z.object({
  platform: z.string().optional(),
  all: z.boolean().optional(),
});

export type SessionCommandsInput = z.infer<typeof sessionCommandsInputSchema>;

export const sessionCommandItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  scope: z.string(),
  platforms: z.array(z.string()).nullable(),
});

export type SessionCommandItem = z.infer<typeof sessionCommandItemSchema>;

export const sessionCommandsOutputSchema = z.object({
  commands: z.array(sessionCommandItemSchema),
  platform: z.string().optional(),
});

export type SessionCommandsOutput = z.infer<typeof sessionCommandsOutputSchema>;
