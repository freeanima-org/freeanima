import { z } from "zod";

export const TAG_COMPONENT = "tag" as const;

export const tagBodySchema = z.object({
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).nullable().default(null),
});

export type TagBody = z.infer<typeof tagBodySchema>;
