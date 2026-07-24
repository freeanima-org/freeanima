import { z } from "zod";

export const notificationsConfigSchema = z
  .object({
    /** 用户主体 entity id（type=user） */
    user_subject_id: z.number().int().positive(),
    /** Agent 主体 entity id（type=agent） */
    agent_subject_id: z.number().int().positive(),
  })
  .optional();

export type NotificationsConfigInput = z.infer<typeof notificationsConfigSchema>;
