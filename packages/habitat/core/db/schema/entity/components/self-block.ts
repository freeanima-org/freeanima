import { SELF_BLOCK_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { SELF_BLOCK_COMPONENT };

import { z } from "zod";
import { selfBlockKeySchema } from "@freeanima/shared/pg-shapes/entity/enums.ts";

/** Self-layer block metadata; body text lives on entities.content */
export const selfBlockBodySchema = z.object({
  block_key: selfBlockKeySchema,
  locked: z.boolean().default(false),
  version: z.number().int().nonnegative().default(1),
  updated_by: z.string().nullable().optional(),
});

export type SelfBlockBody = z.infer<typeof selfBlockBodySchema>;
