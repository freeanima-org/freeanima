import { z } from "zod";

/** 完整 origin（scheme://host[:port]，无 path） */
export const httpCorsOriginSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      try {
        return new URL(value).origin === value;
      } catch {
        return false;
      }
    },
    { message: "须为完整 origin（无 path）" },
  );

export const httpConfigSchema = z
  .object({
    /** Hub REST 跨域允许的浏览器 origin；与 tunnel / web 无关 */
    cors_origins: z.array(httpCorsOriginSchema).optional(),
  })
  .optional();

export type HttpConfig = z.infer<typeof httpConfigSchema>;
export type HttpConfigFields = NonNullable<HttpConfig>;
