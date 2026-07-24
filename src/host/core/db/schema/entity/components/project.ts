import { z } from "zod";

export const PROJECT_COMPONENT = "project" as const;

export const projectStatusSchema = z.enum(["active", "completed", "cancelled", "on_hold"]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const projectBodySchema = z.object({
  folder_id: z.number().int().positive().nullable().optional(),
  start_at: z.string().nullable().default(null),
  end_at: z.string().nullable().default(null),
  status: projectStatusSchema.default("active"),
  product_tag: z.string().optional(),
  sort_order: z.number().int().optional(),
  linked_diary_ids: z.array(z.number().int().positive()).default([]),
  client_op_id: z.string().min(1).nullable().default(null),
});

export type ProjectBody = z.infer<typeof projectBodySchema>;
