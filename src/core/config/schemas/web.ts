import { z } from "zod";

export const DEFAULT_WEB_HOST = "127.0.0.1";
export const DEFAULT_WEB_PORT = 2659;

export const webConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    host: z.string().min(1).optional(),
    port: z.number().int().positive().optional(),
    /** 公网 Web UI 外链（含 /web 前缀），仅文档/展示；不参与 CORS */
    public_url: z.string().url().optional(),
  })
  .optional();

export type WebConfig = z.infer<typeof webConfigSchema>;
export type WebConfigFields = NonNullable<WebConfig>;
