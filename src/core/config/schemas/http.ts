import { z } from "zod";

import { DEFAULT_HUB_TLS_PORT } from "./http-ports.ts";

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

export const httpTlsConfigSchema = z
  .object({
    /** 为 true 时在独立端口启动 HTTPS（默认 false） */
    enabled: z.boolean().optional(),
    /** TLS 监听端口（默认 2659，与 HTTP 2658 分离） */
    port: z.number().int().positive().optional(),
    /** 缺失 cert/key 时自动生成（默认 true） */
    auto: z.boolean().optional(),
    /** 证书 PEM 路径（支持 env("PATH")） */
    cert: z.string().min(1).optional(),
    /** 私钥 PEM 路径（支持 env("PATH")） */
    key: z.string().min(1).optional(),
    /** 加密私钥 passphrase（支持 env("KEY")） */
    passphrase: z.string().optional(),
  })
  .optional();

export const httpConfigSchema = z
  .object({
    /**
     * Hub 监听地址（IP 或本机可解析的主机名）。
     * 字符串支持逗号分隔；数组可写多个 bind。未设时默认 127.0.0.1（仅本机）。
     */
    host: z.union([httpBindHostEntrySchema, z.array(httpBindHostEntrySchema)]).optional(),
    /** Hub REST 跨域允许的浏览器 origin（dev:web 等）；经 Hub /web 同源访问时通常留空 */
    cors_origins: z.array(httpCorsOriginSchema).optional(),
    /** Hub 原生 TLS（独立端口；HTTP 端口不变） */
    tls: httpTlsConfigSchema,
  })
  .optional();

export type HttpTlsConfig = z.infer<typeof httpTlsConfigSchema>;
export type HttpTlsConfigFields = NonNullable<HttpTlsConfig>;
export type HttpConfig = z.infer<typeof httpConfigSchema>;
export type HttpConfigFields = NonNullable<HttpConfig>;

export { DEFAULT_HUB_TLS_PORT };
