import { z } from "zod";

import { normalizePgTimestamp } from "./timestamp.ts";

/** Known Gateway / channels (aligned with runtime/platforms.ts) */
export const PLATFORMS = [
  "parlor",
  "discord",
  "weixin",
  "studio-pair-programming",
  "companion",
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
  satellite_app_id: z.string().optional(),
  satellite_instance_id: z.string().optional(),
  workspace_root: z.string().optional(),
  workspace_gitignore: z.boolean().optional(),
  workspace_show_hidden: z.boolean().optional(),
});

const companionPlatformInfoSchema = z.looseObject({
  platform: z.literal("companion"),
  satellite_app_id: z.string().optional(),
  satellite_instance_id: z.string().optional(),
});

const cronPlatformInfoSchema = z.looseObject({
  platform: z.literal("cron"),
});

/** Keys excluded from origin identity matching / probe construction */
export const ORIGIN_ROUTING_META_KEYS = new Set(["origin_active", "ended_at"]);

export function stripOriginRoutingMeta(
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const out = { ...extra };
  for (const key of ORIGIN_ROUTING_META_KEYS) {
    delete out[key];
  }
  return out;
}

export function buildOriginIdentityProbe(
  platform?: string,
  platformExtra?: Record<string, unknown>,
): PlatformInfo | null {
  const identity = stripOriginRoutingMeta(platformExtra ?? {});
  return buildPlatformInfo(platform, Object.keys(identity).length > 0 ? identity : undefined);
}

/** Discord session bound channel/thread (see gateway/discord-policy extractOrigin) */
const discordPlatformInfoSchema = z.object({
  platform: z.literal("discord"),
  channel_id: z.string(),
  guild_id: z.string().optional(),
  thread_id: z.string().optional(),
  origin_active: z.boolean().optional(),
  ended_at: z.string().optional(),
});

/** WeChat session bound peer (see gateway/weixin/weixin-message) */
const weixinPlatformInfoSchema = z.object({
  platform: z.literal("weixin"),
  weixin_user_id: z.string(),
  weixin_peer_id: z.string(),
  is_group: z.boolean(),
  origin_active: z.boolean().optional(),
  ended_at: z.string().optional(),
});

/**
 * sessions.platform_info: platform + per-channel extra merged as discriminated union.
 * Kernel side still projects as platform + platform_extra.
 */
export const platformInfoSchema = z.discriminatedUnion("platform", [
  parlorPlatformInfoSchema,
  discordPlatformInfoSchema,
  weixinPlatformInfoSchema,
  studioPairPlatformInfoSchema,
  companionPlatformInfoSchema,
  cronPlatformInfoSchema,
]);

export type PlatformInfo = z.infer<typeof platformInfoSchema>;
export type ParlorPlatformInfo = z.infer<typeof parlorPlatformInfoSchema>;
export type DiscordPlatformInfo = z.infer<typeof discordPlatformInfoSchema>;
export type WeixinPlatformInfo = z.infer<typeof weixinPlatformInfoSchema>;
export type StudioPairPlatformInfo = z.infer<typeof studioPairPlatformInfoSchema>;

/** Placeholder when platform_extra missing required fields */
export const PLATFORM_STRING_PLACEHOLDER = "nothing";

const PLATFORM_EXTRA_DEFAULTS: Partial<Record<Platform, Record<string, unknown>>> = {
  discord: { channel_id: PLATFORM_STRING_PLACEHOLDER },
  weixin: {
    weixin_user_id: PLATFORM_STRING_PLACEHOLDER,
    weixin_peer_id: PLATFORM_STRING_PLACEHOLDER,
    is_group: false,
  },
};

const PLATFORM_EXTRA_TIMESTAMP_KEYS = ["ended_at", "started_at"] as const;

function isMissingExtraValue(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function normalizePlatformExtra(
  extra?: Record<string, unknown>,
): Record<string, unknown> | undefined {
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

/** Fill required extra fields per platform */
export function applyPlatformExtraDefaults(
  platform: Platform,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const defaults = PLATFORM_EXTRA_DEFAULTS[platform];
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
  const withDefaults = applyPlatformExtraDefaults(platform, { ...extra });
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
