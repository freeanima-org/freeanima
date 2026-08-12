import { z } from "zod";

/** 全局时区（IANA）；locale 已内联为中文，不再配置 */
export const i18nConfigSchema = z
  .object({
    /** IANA 时区，如 Asia/Shanghai、UTC */
    timezone: z.string().min(1).optional(),
  })
  .optional();

export type I18nConfigInput = z.infer<typeof i18nConfigSchema>;
