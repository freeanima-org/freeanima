import { TAG_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { TAG_COMPONENT };

import { z } from "zod";

export const tagBodySchema = z.object({
  sort_order: z.number().int().optional(),
});

export type TagBody = z.infer<typeof tagBodySchema>;
