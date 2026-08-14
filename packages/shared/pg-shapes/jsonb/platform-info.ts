import { z } from "zod";

import { omitUndefined } from "@freeanima/shared/util";

import { normalizePgTimestamp } from "./timestamp.ts";

/** Gateway channels（会话 platform_info 合法通道子集，不含 chat / coding / companion） */
export const GATEWAY_PLATFORMS = ["discord", "weixin"] as const;

export type GatewayPlatform = (typeof GATEWAY_PLATFORMS)[number];

export const gatewayPlatformSchema = z.enum(GATEWAY_PLATFORMS);

export function isGatewayPlatform(value: string): value is GatewayPlatform {
  return (GATEWAY_PLATFORMS as readonly string[]).includes(value);
}

/**
 * 工具层仍可识别 `remote:{app}:{instance}` 字符串；
 * **不是** conversations.platform_info.platform 的合法值（coding/companion 用 flat platform）。
 */
export function isRemotePlatformString(platform: string): boolean {
  const parts = platform.split(":");
  if (parts.length !== 3 || parts[0] !== "remote") return false;
  return !!parts[1]?.trim() && !!parts[2]?.trim();
}

export function parseRemotePlatformString(platform: string): {
  app_slug: string;
  instance_id_norm: string;
} | null {
  if (!isRemotePlatformString(platform)) return null;
  const parts = platform.split(":");
  const appSlug = parts[1];
  const instanceId = parts[2];
  if (appSlug === undefined || instanceId === undefined) return null;
  return { app_slug: appSlug, instance_id_norm: instanceId };
}

/** Outpost 类 flat platform（coding / companion）共用字段 */
const outpostFlatExtraShape = {
  outpost_app_id: z.string().optional(),
  outpost_instance_id: z.string().optional(),
  workspace_root: z.string().optional(),
  workspace_gitignore: z.boolean().optional(),
  workspace_show_hidden: z.boolean().optional(),
  /** Coding / 项目会话绑定的 Project World id */
  project_world_id: z.number().int().positive().optional(),
} as const;

/** bundled Chat 会话（flat platform） */
const chatPlatformInfoSchema = z.looseObject({
  platform: z.literal("chat"),
  workspace_root: z.string().optional(),
  project_world_id: z.number().int().positive().optional(),
});

/** Coding outpost 会话（flat platform，同构 weixin 式绑定） */
const codingPlatformInfoSchema = z.looseObject({
  platform: z.literal("coding"),
  ...outpostFlatExtraShape,
});

/** Companion outpost 会话（flat platform） */
const companionPlatformInfoSchema = z.looseObject({
  platform: z.literal("companion"),
  ...outpostFlatExtraShape,
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

/** Discord conversation bound channel/thread (see gateway/discord-policy extractOrigin) */
const discordPlatformInfoSchema = z.looseObject({
  platform: z.literal("discord"),
  channel_id: z.string(),
  guild_id: z.string().optional(),
  thread_id: z.string().optional(),
  origin_active: z.boolean().optional(),
  ended_at: z.string().optional(),
});

/** WeChat conversation bound peer (see gateway/weixin/weixin-message) */
const weixinPlatformInfoSchema = z.looseObject({
  platform: z.literal("weixin"),
  weixin_user_id: z.string(),
  weixin_peer_id: z.string(),
  is_group: z.boolean(),
  origin_active: z.boolean().optional(),
  ended_at: z.string().optional(),
});

/**
 * conversations.platform_info: platform + per-channel extra merged as discriminated union。
 * 合法 platform：`chat` | `weixin` | `discord` | `coding` | `companion`。
 * 不再接受 `cron` / `remote:` / `sap:`。
 */
export const platformInfoSchema = z.union([
  chatPlatformInfoSchema,
  codingPlatformInfoSchema,
  companionPlatformInfoSchema,
  discordPlatformInfoSchema,
  weixinPlatformInfoSchema,
]);

export type PlatformInfo = z.infer<typeof platformInfoSchema>;
export type ChatPlatformInfo = z.infer<typeof chatPlatformInfoSchema>;
export type CodingPlatformInfo = z.infer<typeof codingPlatformInfoSchema>;
export type CompanionPlatformInfo = z.infer<typeof companionPlatformInfoSchema>;
export type DiscordPlatformInfo = z.infer<typeof discordPlatformInfoSchema>;
export type WeixinPlatformInfo = z.infer<typeof weixinPlatformInfoSchema>;

/** Placeholder when platform_extra missing required fields */
export const PLATFORM_STRING_PLACEHOLDER = "nothing";

const PLATFORM_EXTRA_DEFAULTS: Partial<Record<string, Record<string, unknown>>> = {
  discord: { channel_id: PLATFORM_STRING_PLACEHOLDER },
  weixin: {
    weixin_user_id: PLATFORM_STRING_PLACEHOLDER,
    weixin_peer_id: PLATFORM_STRING_PLACEHOLDER,
    is_group: false,
  },
};

const PLATFORM_EXTRA_TIMESTAMP_KEYS = ["ended_at", "started_at"] as const;

function isMissingExtraValue(value: unknown): boolean {
  return value === undefined || value == null || value === "";
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
  platform: string,
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

export function isChatPlatformString(platform: string): boolean {
  return platform === "chat";
}

/** 会话 platform 合法 flat 值 */
export const CONVERSATION_PLATFORMS = ["chat", "weixin", "discord", "coding", "companion"] as const;

export type ConversationPlatform = (typeof CONVERSATION_PLATFORMS)[number];

/**
 * Soft-default：合法 flat 原样；空 / 非法 / 遗留 remote:|sap:|cron → `"chat"`。
 * 供旧会话无 platform 时的 resolve，避免抛 `has no platform`。
 */
export function canonicalizeConversationPlatform(raw?: string | null): string {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if ((CONVERSATION_PLATFORMS as readonly string[]).includes(trimmed)) {
    return trimmed;
  }
  return "chat";
}

function isOutpostFlatPlatform(platform: string): platform is "coding" | "companion" {
  return platform === "coding" || platform === "companion";
}

export function buildPlatformInfo(
  platform?: string,
  platformExtra?: Record<string, unknown>,
): PlatformInfo | null {
  if (!platform) return null;
  if (isChatPlatformString(platform)) {
    const extra = normalizePlatformExtra(platformExtra);
    const merged: Record<string, unknown> = { platform: "chat", ...extra };
    return chatPlatformInfoSchema.parse(merged);
  }
  if (isOutpostFlatPlatform(platform)) {
    const extra = normalizePlatformExtra(platformExtra);
    const merged: Record<string, unknown> = { platform, ...extra };
    return platformInfoSchema.parse(merged);
  }
  if (!isGatewayPlatform(platform)) {
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
  return omitUndefined({
    platform,
    platform_extra: Object.keys(rest).length > 0 ? rest : undefined,
  });
}

/**
 * 迁移前 purge：检测遗留 cron 会话。
 * cron 已不是合法 PlatformInfo；仍接受任意带 platform 字段的对象。
 */
export function isCronPlatformInfo(info: { platform?: string } | null | undefined): boolean {
  return info?.platform === "cron";
}

export function isCronPlatformString(platform: string | null | undefined): boolean {
  return platform === "cron";
}
