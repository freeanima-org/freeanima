import { z } from "zod";

export const MILESTONE_COMPONENT = "milestone" as const;

export const milestoneStatusSchema = z.enum(["pending", "in_progress", "completed", "delayed"]);
export type MilestoneStatus = z.infer<typeof milestoneStatusSchema>;

export const milestoneBodySchema = z.object({
  project_id: z.number().int().positive(),
  due_at: z.string(),
  status: milestoneStatusSchema.default("pending"),
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).nullable().default(null),
});

export type MilestoneBody = z.infer<typeof milestoneBodySchema>;
