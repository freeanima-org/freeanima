import { z } from "zod";

import { NOTE_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";

export { NOTE_COMPONENT };

export const noteBodySchema = z.object({});

export type NoteBody = z.infer<typeof noteBodySchema>;
