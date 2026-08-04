import { z } from "zod";

export const CODING_NOTE_COMPONENT = "coding_note" as const;

/** 项目 World 内探索/理解笔记；展示字段走 entities.title / summary / content */
export const codingNoteBodySchema = z.object({
  /** 可选细分（如 explore / decision）；可空 */
  kind: z.string().trim().min(1).max(64).optional(),
});

export type CodingNoteBody = z.infer<typeof codingNoteBodySchema>;
