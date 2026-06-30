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

const httpBindHostEntrySchema = z.string().min(1);

export const httpConfigSchema = z
  .object({
    /**
     * Hub 监听地址（IP 或本机可解析的主机名）。
     * 字符串支持逗号分隔；数组可写多个 bind。未设时默认 127.0.0.1（仅本机）。
     */
    host: z.union([httpBindHostEntrySchema, z.array(httpBindHostEntrySchema)]).optional(),
    /** Hub REST 跨域允许的浏览器 origin（dev:web 等）；经 Hub /web 同源访问时通常留空 */
    cors_origins: z.array(httpCorsOriginSchema).optional(),
  })
  .optional();

export type HttpConfig = z.infer<typeof httpConfigSchema>;
export type HttpConfigFields = NonNullable<HttpConfig>;
