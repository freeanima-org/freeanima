import { z } from "zod";

/**
 * 校验并规范化对外访问根（origin）。
 * 须为 http(s)、无 path/query/hash；返回 `URL.origin`（无尾 `/`）。
 * 空串视为未配置。
 */
export function parsePublicOrigin(raw: string | undefined | null): string | undefined {
  if (raw == null) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
  if ((u.pathname && u.pathname !== "/") || u.search || u.hash) return undefined;
  return u.origin;
}

const publicOriginFieldSchema = z
  .string()
  .optional()
  .transform((raw, ctx) => {
    if (raw == null || raw.trim() === "") return undefined;
    const origin = parsePublicOrigin(raw);
    if (!origin) {
      ctx.addIssue({
        code: "custom",
        message: "须为绝对 origin（如 https://anima.example.com），勿带 path/query/hash",
      });
      return z.NEVER;
    }
    return origin;
  });

/** 对外访问根（临时分享等可复制链接）；不改监听 / 证书 / habitat_url */
export const publicConfigSchema = z
  .object({
    /** 如 https://anima.example.com */
    origin: publicOriginFieldSchema,
  })
  .optional();

export type PublicConfig = z.infer<typeof publicConfigSchema>;
