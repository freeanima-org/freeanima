import { z } from "zod";

import { normalizePgTimestamp } from "../../utils/timestamp.js";

/** 已知 Gateway / 通道（与 runtime/platforms.ts 保持一致） */
export const PLATFORMS = [
  "parlor",
  "discord",
  "weixin",
  "studio-pair-programming",
  "cron",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const platformSchema = z.enum(PLATFORMS);

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}

const parlorPlatformInfoSchema = z.looseObject({
  platform: z.literal("parlor"),
});

const studioPairPlatformInfoSchema = z.looseObject({
  platform: z.literal("studio-pair-programming"),
});

const cronPlatformInfoSchema = z.looseObject({
  platform: z.literal("cron"),
});

/** Discord session 绑定频道/线程（见 gateway/discord-policy extractOrigin） */
const discordPlatformInfoSchema = z.object({
  platform: z.literal("discord"),
  channel_id: z.string(),
  guild_id: z.string().optional(),
  thread_id: z.string().optional(),
});

/** 微信 session 绑定 peer（见 gateway/weixin/weixin-message） */
const weixinPlatformInfoSchema = z.object({
  platform: z.literal("weixin"),
  weixin_user_id: z.string(),
  weixin_peer_id: z.string(),
  is_group: z.boolean(),
});

/**
 * sessions.platform_info：platform + 各通道 extra 合并为 discriminated union。
 * kernel 侧仍投影为 platform + platform_extra。
 */
export const platformInfoSchema = z.discriminatedUnion("platform", [
  parlorPlatformInfoSchema,
  discordPlatformInfoSchema,
  weixinPlatformInfoSchema,
  studioPairPlatformInfoSchema,
  cronPlatformInfoSchema,
]);

export type PlatformInfo = z.infer<typeof platformInfoSchema>;
export type ParlorPlatformInfo = z.infer<typeof parlorPlatformInfoSchema>;
export type DiscordPlatformInfo = z.infer<typeof discordPlatformInfoSchema>;
export type WeixinPlatformInfo = z.infer<typeof weixinPlatformInfoSchema>;
export type StudioPairPlatformInfo = z.infer<typeof studioPairPlatformInfoSchema>;

/** 历史 JSONL 缺字段时的占位（迁移 / 双写容忍） */
export const LEGACY_PLATFORM_STRING_DEFAULT = "nothing";

const PLATFORM_LEGACY_DEFAULTS: Partial<Record<Platform, Record<string, unknown>>> = {
  discord: { channel_id: LEGACY_PLATFORM_STRING_DEFAULT },
  weixin: {
    weixin_user_id: LEGACY_PLATFORM_STRING_DEFAULT,
    weixin_peer_id: LEGACY_PLATFORM_STRING_DEFAULT,
    is_group: false,
  },
};

const PLATFORM_EXTRA_TIMESTAMP_KEYS = ["ended_at", "started_at"] as const;

function isMissingExtraValue(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function normalizePlatformExtra(extra?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!extra) return undefined;
  const out = { ...extra };
  for (const key of PLATFORM_EXTRA_TIMESTAMP_KEYS) {
    const val = out[key];
    if (typeof val === "string" && val.trim()) {
      out[key] = normalizePgTimestamp(val);
    }
  }
  return out;
}

/** 补齐各 platform 必填 extra，避免旧 JSONL 迁移时 Zod 失败 */
export function applyLegacyPlatformDefaults(
  platform: Platform,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const defaults = PLATFORM_LEGACY_DEFAULTS[platform];
  if (!defaults) return extra;
  const out = { ...extra };
  for (const [key, val] of Object.entries(defaults)) {
    if (isMissingExtraValue(out[key])) {
      out[key] = val;
    }
  }
  return out;
}

export function buildPlatformInfo(
  platform?: string,
  platformExtra?: Record<string, unknown>,
): PlatformInfo | null {
  if (!platform || !isPlatform(platform)) {
    return null;
  }
  const extra = normalizePlatformExtra(platformExtra);
  const withDefaults = applyLegacyPlatformDefaults(platform, { ...(extra ?? {}) });
  const merged: Record<string, unknown> = {
    platform,
    ...withDefaults,
  };
  return platformInfoSchema.parse(merged);
}

export function splitPlatformInfo(info: PlatformInfo | null | undefined): {
  platform?: string;
  platform_extra?: Record<string, unknown>;
} {
  if (!info) return {};
  const { platform, ...rest } = info;
  return {
    platform,
    platform_extra: Object.keys(rest).length > 0 ? rest : undefined,
  };
}
