import { OBJECT_FILE_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { OBJECT_FILE_COMPONENT };

import { z } from "zod";

/** BLAKE3-128 → 32 小写 hex */
export const objectCidSchema = z
  .string()
  .length(32)
  .regex(/^[0-9a-f]{32}$/, "cid must be 32 lowercase hex chars");

export const objectFileBodySchema = z.object({
  cid: objectCidSchema,
  size: z.number().int().nonnegative(),
  mime_type: z.string().min(1),
});

export type ObjectFileBody = z.infer<typeof objectFileBodySchema>;
