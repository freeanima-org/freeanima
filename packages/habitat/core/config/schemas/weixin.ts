import { z } from "zod";

export const weixinConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    token: z.string().optional(),
    base_url: z.string().optional(),
    user_id: z.string().optional(),
    account_id: z.string().optional(),
    session_handoff_on_new: z.boolean().optional(),
  })
  .passthrough()
  .optional();

export type WeixinConfigInput = z.infer<typeof weixinConfigSchema>;
