import { TAG_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { TAG_COMPONENT };

import { z } from "zod";

export const tagBodySchema = z.object({
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).nullable().default(null),
});

export type TagBody = z.infer<typeof tagBodySchema>;
