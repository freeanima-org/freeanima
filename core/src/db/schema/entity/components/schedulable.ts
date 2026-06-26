import { z } from "zod";

/** 抽象 schedulable — 仅 Zod 层，不写入 components 数组 */
export const schedulableBodySchema = z.object({
  due_at: z.string().nullable().optional(),
  remind_at: z.string().nullable().optional(),
});

export type SchedulableBody = z.infer<typeof schedulableBodySchema>;
