import { z } from "zod";

import { omitUndefined } from "@freeanima/host/core/util";

import { normalizePgTimestamp } from "./timestamp.ts";

/** Gateway channels (non-remote-tool) */
export const GATEWAY_PLATFORMS = ["discord", "weixin", "cron"] as const;

export type GatewayPlatform = (typeof GATEWAY_PLATFORMS)[number];

export const gatewayPlatformSchema = z.enum(GATEWAY_PLATFORMS);

export function isGatewayPlatform(value: string): value is GatewayPlatform {
  return (GATEWAY_PLATFORMS as readonly string[]).includes(value);
}

export function isRemotePlatformString(platform: string): boolean {
  const parts = platform.split(":");
  const prefix = parts[0];
  if (parts.length !== 3 || prefix !== "remote") return false;
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

const remotePlatformInfoSchema = z.looseObject({
  platform: z
    .string()
    .refine((p) => isRemotePlatformString(p), { message: "invalid remote platform" }),
  outpost_app_id: z.string().optional(),
  outpost_instance_id: z.string().optional(),
  workspace_root: z.string().optional(),
  workspace_gitignore: z.boolean().optional(),
  workspace_show_hidden: z.boolean().optional(),
  /** Coding / 项目会话绑定的 Project World id */
  project_world_id: z.number().int().positive().optional(),
});

const cronPlatformInfoSchema = z.looseObject({
  platform: z.literal("cron"),
});

/** bundled Chat 会话（flat platform，无 SAP instance 段） */
const chatPlatformInfoSchema = z.looseObject({
  platform: z.literal("chat"),
  workspace_root: z.string().optional(),
  project_world_id: z.number().int().positive().optional(),
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
 * conversations.platform_info: platform + per-channel extra merged as discriminated union.
 * Remote-tool hosts use platform `remote:{app_slug}:{instance_id}` (legacy `sap:` accepted).
 */
export const platformInfoSchema = z.union([
  chatPlatformInfoSchema,
  remotePlatformInfoSchema,
  discordPlatformInfoSchema,
  weixinPlatformInfoSchema,
  cronPlatformInfoSchema,
]);

export type PlatformInfo = z.infer<typeof platformInfoSchema>;
export type SapPlatformInfo = z.infer<typeof remotePlatformInfoSchema>;
export type RemotePlatformInfo = z.infer<typeof remotePlatformInfoSchema>;
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
  if (!isGatewayPlatform(platform) && !isRemotePlatformString(platform)) {
    return null;
  }
  const extra = normalizePlatformExtra(platformExtra);
  const withDefaults = applyPlatformExtraDefaults(platform, { ...extra });
  const merged: Record<string, unknown> = {
    platform,
    ...withDefaults,
  };
  if (isRemotePlatformString(platform)) {
    const parsed = parseRemotePlatformString(platform);
    if (parsed) {
      merged.outpost_app_id ??= parsed.app_slug;
      merged.outpost_instance_id ??= parsed.instance_id_norm;
    }
  }
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

/** conversations.platform_info 标记为 cron agent 遗留会话（浅睡/梦境应排除） */
export function isCronPlatformInfo(info: PlatformInfo | null | undefined): boolean {
  return info?.platform === "cron";
}

export function isCronPlatformString(platform: string | null | undefined): boolean {
  return platform === "cron";
}
