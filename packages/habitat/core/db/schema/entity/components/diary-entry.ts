import { z } from "zod";

import { DIARY_ENTRY_COMPONENT } from "@freeanima/shared/entity-shapes/component-ids.ts";

export { DIARY_ENTRY_COMPONENT };

export const diaryEntryBodySchema = z.object({
  entry_at: z.string().min(1),
});

export type DiaryEntryBody = z.infer<typeof diaryEntryBodySchema>;
