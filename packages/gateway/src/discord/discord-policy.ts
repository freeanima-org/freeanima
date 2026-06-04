/** Discord 响应策略（与 Python discord_adapter 对齐，便于单测） */

export const DISCORD_CONFIG_DEFAULTS = {
  require_mention: true,
  free_response_channels: "",
  allowed_channels: "",
  auto_thread: true,
  thread_require_mention: false,
  history_backfill: true,
  history_backfill_limit: 50,
  reactions: true,
  channel_prompts: {} as Record<string, string>,
  dm_role_auth_guild: "",
  /** 注册 Discord 原生 Slash Command（输入 / 时出现候选） */
  slash_commands: true,
  /** 若设置则仅注册到该 guild（即时生效）；留空则全局注册（最多约 1 小时传播） */
  slash_commands_guild_id: "",
};

export type DiscordConfig = typeof DISCORD_CONFIG_DEFAULTS & Record<string, unknown>;

export type PlatformOrigin = {
  platform: "discord";
  platform_extra: Record<string, string>;
};

export type DiscordMessageContext = {
  content: string;
  authorIsBot: boolean;
  isDm: boolean;
  isThread: boolean;
  channelId: string;
  parentChannelId: string;
  isMentioned: boolean;
  isReplyToBot: boolean;
};

function parseIdList(csv: string): string[] {
  return csv
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

function channelInList(channelId: string, parentChannelId: string, csv: string): boolean {
  const ids = parseIdList(csv);
  if (!ids.length) return false;
  return ids.includes(channelId) || (parentChannelId !== "" && ids.includes(parentChannelId));
}

export function mergeDiscordConfig(config?: Record<string, unknown>): DiscordConfig {
  return { ...DISCORD_CONFIG_DEFAULTS, ...config } as DiscordConfig;
}

export function shouldRespond(ctx: DiscordMessageContext, cfg: DiscordConfig): boolean {
  if (ctx.authorIsBot) return false;
  if (!ctx.content.trim()) return false;

  const allowed = String(cfg.allowed_channels ?? "");
  if (allowed && !channelInList(ctx.channelId, ctx.parentChannelId, allowed)) {
    return false;
  }

  if (ctx.isDm) return true;

  if (channelInList(ctx.channelId, ctx.parentChannelId, String(cfg.free_response_channels ?? ""))) {
    return true;
  }

  if (ctx.isThread) {
    if (!cfg.thread_require_mention) return true;
    return ctx.isMentioned || ctx.isReplyToBot;
  }

  if (cfg.require_mention) {
    return ctx.isMentioned || ctx.isReplyToBot;
  }

  return true;
}

export function shouldCreateThread(ctx: DiscordMessageContext, cfg: DiscordConfig): boolean {
  if (!cfg.auto_thread) return false;
  if (ctx.isDm) return false;
  if (ctx.isThread) return false;
  if (channelInList(ctx.channelId, ctx.parentChannelId, String(cfg.free_response_channels ?? ""))) {
    return false;
  }
  return true;
}

export function extractOrigin(params: {
  channelId: string;
  parentChannelId: string;
  guildId: string;
  isThread: boolean;
}): PlatformOrigin {
  const platform_extra: Record<string, string> = {
    channel_id: params.isThread ? params.parentChannelId : params.channelId,
  };
  if (params.guildId) platform_extra.guild_id = params.guildId;
  if (params.isThread) platform_extra.thread_id = params.channelId;
  return { platform: "discord", platform_extra };
}

export function threadOriginAfterCreate(params: {
  guildId: string;
  parentChannelId: string;
  threadId: string;
}): PlatformOrigin {
  return {
    platform: "discord",
    platform_extra: {
      guild_id: params.guildId,
      channel_id: params.parentChannelId,
      thread_id: params.threadId,
    },
  };
}

export function stripBotMention(content: string, botUserId: string): string {
  let clean = content.trim();
  const patterns = [`<@${botUserId}>`, `<@!${botUserId}>`];
  for (const p of patterns) {
    clean = clean.replaceAll(p, "").trim();
  }
  return clean;
}
