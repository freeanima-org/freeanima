import { z } from "zod";

/** 全局语言与时区（Host 提示词/错误与 UI 默认值同源） */
export const i18nConfigSchema = z
  .object({
    /** BCP 47 / 产品 locale：en | zh-cn */
    locale: z.enum(["en", "zh-cn"]).optional(),
    /** IANA 时区，如 Asia/Shanghai、UTC */
    timezone: z.string().min(1).optional(),
  })
  .optional();

export type I18nConfigInput = z.infer<typeof i18nConfigSchema>;
