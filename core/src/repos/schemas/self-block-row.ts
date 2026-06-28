import { z } from "zod";

import { selfBlockKeySchema } from "@freeanima/core/db/schema";

export const selfBlockRowSchema = z.object({
  block_key: selfBlockKeySchema,
  content: z.string(),
  locked: z.boolean(),
  version: z.number().int(),
  updated_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type SelfBlockRow = z.infer<typeof selfBlockRowSchema>;
