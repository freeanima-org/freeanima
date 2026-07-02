import { z } from "zod";

export const tunnelCloudflareConfigSchema = z
  .object({
    account_id: z.string().optional(),
    tunnel_id: z.string().optional(),
    tunnel_name: z.string().optional(),
    zone_id: z.string().optional(),
  })
  .optional();

export const tunnelCredentialsConfigSchema = z
  .object({
    api_token: z.string().optional(),
    tunnel_credentials: z.string().optional(),
  })
  .optional();

export const tunnelConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    hostname: z.string().min(1).optional(),
    cloudflare: tunnelCloudflareConfigSchema,
    credentials: tunnelCredentialsConfigSchema,
  })
  .optional();

export type TunnelConfig = z.infer<typeof tunnelConfigSchema>;
/** tunnel 段对象（不含 undefined） */
export type TunnelConfigFields = NonNullable<TunnelConfig>;
export type TunnelCloudflareConfig = z.infer<typeof tunnelCloudflareConfigSchema>;

/** pass 路径约定（非密钥，供 CLI / 文档引用） */
export const TUNNEL_PASS_PATHS = {
  apiToken: "services/cloudflare/api-token",
  tunnelCredentials: "services/cloudflare/tunnel-credentials",
} as const;

/** Vault / env 引用示例（item_id 因实例而异，请改用 env() 或填写实际 id） */
export const TUNNEL_CREDENTIAL_REFS = {
  apiToken: 'env("CLOUDFLARE_API_TOKEN")',
  tunnelCredentials: 'env("CLOUDFLARE_TUNNEL_CREDENTIALS_JSON")',
} as const;
