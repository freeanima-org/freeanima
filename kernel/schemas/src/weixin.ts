import { z } from "zod";

export const weixinSyncSchema = z.object({
  sync_buf: z.string().optional(),
});

export const weixinContextTokensSchema = z.record(z.string(), z.string());
