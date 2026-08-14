import { z } from "zod";

import { NOTE_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";

export { NOTE_COMPONENT };

export const noteBodySchema = z.object({
  client_op_id: z.string().min(1).nullable().default(null),
});

export type NoteBody = z.infer<typeof noteBodySchema>;
