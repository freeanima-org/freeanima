import { z } from "zod";

export const DIARY_ENTRY_COMPONENT = "diary_entry" as const;

export const diaryEntryBodySchema = z.object({
  entry_at: z.string().min(1),
  tags: z.array(z.string()).default([]),
  client_op_id: z.string().min(1).nullable().default(null),
});

export type DiaryEntryBody = z.infer<typeof diaryEntryBodySchema>;
