import { z } from "zod";

import { DEFAULT_HABITAT_TLS_PORT } from "./http-ports.ts";

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

/** ACME / Let's Encrypt 域名（拒绝裸 IP） */
const httpTlsAcmeDomainSchema = z
  .string()
  .min(1)
  .refine(
    (value) => {
      const host = value.trim().toLowerCase();
      if (!host || host.includes("/") || host.includes(":")) return false;
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
      if (host.includes(":")) return false;
      return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host);
    },
    { message: "须为 DNS 主机名（Let's Encrypt 不签裸 IP）" },
  );

export const httpTlsAcmeConfigSchema = z.object({
  /** ACME 联系邮箱（LE 账号） */
  email: z.string().email(),
  /** 证书域名（须公网解析到本机；HTTP-01） */
  domains: z.array(httpTlsAcmeDomainSchema).min(1),
  /** HTTP-01 challenge 监听端口（默认 80，须公网可达） */
  challenge_port: z.number().int().positive().optional(),
  /** true 时使用 Let's Encrypt staging directory */
  staging: z.boolean().optional(),
});

export const httpTlsConfigSchema = z
  .object({
    /** 为 true 时在独立端口启动 HTTPS（默认 false） */
    enabled: z.boolean().optional(),
    /** TLS 监听端口（默认 2659，与 HTTP 2658 分离） */
    port: z.number().int().positive().optional(),
    /** 缺失 cert/key 时自动生成（默认 true；启用 acme 时忽略） */
    auto: z.boolean().optional(),
    /** 证书 PEM 路径（支持 env("PATH")） */
    cert: z.string().min(1).optional(),
    /** 私钥 PEM 路径（支持 env("PATH")） */
    key: z.string().min(1).optional(),
    /** 加密私钥 passphrase（支持 env("KEY")） */
    passphrase: z.string().optional(),
    /**
     * 可选 Let's Encrypt（HTTP-01）。配置后优先于 mkcert/openssl 自签；
     * 需公网域名 A/AAAA 指向本机，且 challenge_port（默认 80）可达。
     */
    acme: httpTlsAcmeConfigSchema.optional(),
  })
  .optional();

export const httpConfigSchema = z
  .object({
    /**
     * Habitat 监听地址（IP 或本机可解析的主机名）。
     * 字符串支持逗号分隔；数组可写多个 bind。未设时默认 127.0.0.1（仅本机）。
     */
    host: z.union([httpBindHostEntrySchema, z.array(httpBindHostEntrySchema)]).optional(),
    /** Habitat REST 跨域允许的浏览器 origin（dev:web 等）；经 Habitat /web 同源访问时通常留空 */
    cors_origins: z.array(httpCorsOriginSchema).optional(),
    /**
     * TLS 证书 SAN 额外主机名 / IP（如局域网 mDNS 名）；与 `http.host` bind 地址合并。
     * `http.host: 0.0.0.0` 时建议在此列出客户端访问用的主机名与 IP。
     */
    allowed_hosts: z.array(httpBindHostEntrySchema).optional(),
    /** Habitat 原生 TLS（独立端口；HTTP 端口不变） */
    tls: httpTlsConfigSchema,
  })
  .optional();

export type HttpTlsAcmeConfig = z.infer<typeof httpTlsAcmeConfigSchema>;
export type HttpTlsConfig = z.infer<typeof httpTlsConfigSchema>;
export type HttpTlsConfigFields = NonNullable<HttpTlsConfig>;
export type HttpConfig = z.infer<typeof httpConfigSchema>;
export type HttpConfigFields = NonNullable<HttpConfig>;

export { DEFAULT_HABITAT_TLS_PORT };
