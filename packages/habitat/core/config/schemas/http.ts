import { z } from "zod";

import { DEFAULT_HABITAT_TLS_PORT } from "./http-ports.ts";

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

export const httpTlsModeSchema = z.enum(["mkcert", "acme", "manual"]);

export type HttpTlsMode = z.infer<typeof httpTlsModeSchema>;

/** 未写 mode 时默认 mkcert */
export function resolveHttpTlsMode(mode: HttpTlsMode | undefined): HttpTlsMode {
  return mode ?? "mkcert";
}

export const httpTlsConfigSchema = z
  .object({
    /** 为 true 时在独立端口启动 HTTPS（默认 false） */
    enabled: z.boolean().optional(),
    /** HTTPS 监听端口（默认 2659，与 HTTP 端口分离） */
    port: z.number().int().positive().optional(),
    /**
     * 证书来源（默认 mkcert）：
     * - mkcert：缺失时优先 mkcert，否则 openssl 自签
     * - acme：Let's Encrypt HTTP-01（须配 acme）
     * - manual：须提供 cert/key
     */
    mode: httpTlsModeSchema.optional(),
    /** 证书 PEM 路径（支持 env("PATH")）；manual 必填，其它模式可选覆盖默认路径 */
    cert: z.string().min(1).optional(),
    /** 私钥 PEM 路径（支持 env("PATH")）；manual 必填 */
    key: z.string().min(1).optional(),
    /** 加密私钥 passphrase（支持 env("KEY")） */
    passphrase: z.string().optional(),
    /** mode=acme 时必填 */
    acme: httpTlsAcmeConfigSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const mode = resolveHttpTlsMode(data.mode);
    if (mode === "manual") {
      if (!data.cert?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["cert"],
          message: "mode=manual 时须指定 cert",
        });
      }
      if (!data.key?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["key"],
          message: "mode=manual 时须指定 key",
        });
      }
    }
    if (mode === "acme") {
      if (!data.acme) {
        ctx.addIssue({
          code: "custom",
          path: ["acme"],
          message: "mode=acme 时须配置 acme（email + domains）",
        });
      }
    }
    if (mode === "mkcert" && data.acme != null) {
      ctx.addIssue({
        code: "custom",
        path: ["acme"],
        message: "mode=mkcert 时不要配置 acme；请改用 mode=acme",
      });
    }
    if (mode === "manual" && data.acme != null) {
      ctx.addIssue({
        code: "custom",
        path: ["acme"],
        message: "mode=manual 时不要配置 acme；请改用 mode=acme",
      });
    }
  })
  .optional();

export const httpConfigSchema = z
  .object({
    /**
     * Habitat 监听地址（IP 或本机可解析的主机名）。
     * 字符串支持逗号分隔；数组可写多个 bind。未设时默认 127.0.0.1（仅本机）。
     */
    host: z.union([httpBindHostEntrySchema, z.array(httpBindHostEntrySchema)]).optional(),
    /** HTTP 监听端口（默认 2658）；CLI `--port` 优先 */
    port: z.number().int().positive().optional(),
    /**
     * TLS 证书 SAN 额外主机名 / IP（如局域网 mDNS 名）；与 `http.host` bind 地址合并。
     * `http.host: 0.0.0.0` 时建议在此列出客户端访问用的主机名与 IP。
     */
    allowed_hosts: z.array(httpBindHostEntrySchema).optional(),
    /** Habitat 原生 TLS（独立 HTTPS 端口；HTTP 端口不变） */
    tls: httpTlsConfigSchema,
  })
  .optional();

export type HttpTlsAcmeConfig = z.infer<typeof httpTlsAcmeConfigSchema>;
export type HttpTlsConfig = z.infer<typeof httpTlsConfigSchema>;
export type HttpTlsConfigFields = NonNullable<HttpTlsConfig>;
export type HttpConfig = z.infer<typeof httpConfigSchema>;
export type HttpConfigFields = NonNullable<HttpConfig>;

export { DEFAULT_HABITAT_TLS_PORT };
