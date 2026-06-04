import {
  ChannelType,
  Client,
  GatewayIntentBits,
  type ChatInputCommandInteraction,
  type Message,
  Partials,
  type TextBasedChannel,
} from "discord.js";
import type { StreamEvent } from "@freeanima/legacy-engine";
import {
  isEngineStreamError,
  isTransientNetworkError,
  loadSessionMeta,
  networkErrorUserHint,
} from "@freeanima/legacy-engine";
import { logComponent } from "@freeanima/legacy-kernel";
import type { NestService } from "@freeanima/legacy-runtime";
import type { PlatformAdapter } from "../platforms";
import { formatClarifyForPlatform, parseClarifyStreamEvent } from "../clarify/index";
import {
  registerDiscordCronDeliverer,
  unregisterDiscordCronDeliverer,
} from "../cron-deliver";
import {
  extractOrigin,
  mergeDiscordConfig,
  shouldCreateThread,
  shouldRespond,
  stripBotMention,
  threadOriginAfterCreate,
  type DiscordConfig,
  type DiscordMessageContext,
  type PlatformOrigin,
} from "./discord-policy";
import {
  interactionToCommandText,
  originFromInteraction,
  replyDiscordInteraction,
  syncDiscordSlashCommands,
} from "./discord-slash";

import {
  deliverDiscordFinalContent,
  tryDiscordInterimEdit,
  withDiscordRetry,
} from "./discord-retry";

const DISCORD_MAX_LEN = 2000;
/** Discord login 失败后自动重试间隔 */
export const DISCORD_LOGIN_RETRY_MS = 5 * 60 * 1000;
/** 流式回复开始时的占位；收尾编辑会移除，仅展示模型正文与工具行。 */
const DISCORD_STREAM_PLACEHOLDER = "⏳ 思考中…";

function splitDiscordMessage(text: string): string[] {
  if (text.length <= DISCORD_MAX_LEN) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > DISCORD_MAX_LEN) {
    let cut = rest.lastIndexOf("\n", DISCORD_MAX_LEN);
    if (cut < DISCORD_MAX_LEN / 2) cut = DISCORD_MAX_LEN;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function messageContext(message: Message, botUserId: string | undefined): DiscordMessageContext {
  const isThread = message.channel.isThread();
  const parentId =
    isThread && "parentId" in message.channel && message.channel.parentId
      ? String(message.channel.parentId)
      : String(message.channel.id);

  const isMentioned =
    Boolean(botUserId && message.mentions.users.has(botUserId)) ||
    Boolean(
      message.client.user &&
        message.content.startsWith(message.client.user.displayName),
    );

  return {
    content: message.content,
    authorIsBot: message.author.id === botUserId,
    isDm: message.channel.type === ChannelType.DM,
    isThread,
    channelId: String(message.channel.id),
    parentChannelId: parentId,
    isMentioned,
    isReplyToBot: message.mentions.repliedUser?.id === botUserId,
  };
}

async function resolveReplyToBot(message: Message, botUserId: string): Promise<boolean> {
  if (!message.reference?.messageId) return false;
  try {
    const refMsg = await withDiscordRetry(() => message.fetchReference());
    return refMsg.author.id === botUserId;
  } catch {
    return message.mentions.repliedUser?.id === botUserId;
  }
}

function composeDiscordStreamInterim(buffer: string): string {
  if (!buffer) return DISCORD_STREAM_PLACEHOLDER;
  const head = `${DISCORD_STREAM_PLACEHOLDER}\n`;
  const full = head + buffer;
  if (full.length <= DISCORD_MAX_LEN) return full;
  const marker = "⋯\n";
  let tail = buffer;
  while (head.length + marker.length + tail.length > DISCORD_MAX_LEN && tail.length > 0) {
    tail = tail.slice(1);
  }
  return `${DISCORD_STREAM_PLACEHOLDER}${marker}${tail}`;
}

/** Discord 网关：先发占位消息并按事件流实时编辑，收尾去掉占位并超长拆条。 */
export async function streamReplyToChannel(
  channel: TextBasedChannel,
  events: AsyncIterable<StreamEvent>,
): Promise<void> {
  if (!("send" in channel) || typeof channel.send !== "function") return;
  const channelSend = channel.send.bind(channel) as (content: string) => Promise<Message>;

  const sentMsg = await withDiscordRetry(async (): Promise<Message> => {
    return await channelSend(DISCORD_STREAM_PLACEHOLDER);
  });

  let buffer = "";
  let burstTokens = 0;
  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  let editTail: Promise<void> = Promise.resolve();

  function clearThrottleTimer(): void {
    if (throttleTimer !== null) {
      clearTimeout(throttleTimer);
      throttleTimer = null;
    }
  }

  function enqueueEdit(getContent: () => string): void {
    editTail = editTail.then(async () => {
      const raw = getContent();
      const content =
        raw.length <= DISCORD_MAX_LEN ? raw : raw.slice(-DISCORD_MAX_LEN);
      await tryDiscordInterimEdit(
        async () => {
          await sentMsg.edit({ content });
        },
        { content_len: content.length },
      );
    });
  }

  function flushInterimNow(): void {
    clearThrottleTimer();
    burstTokens = 0;
    enqueueEdit(() => composeDiscordStreamInterim(buffer));
  }

  function scheduleDebouncedFlush(): void {
    clearThrottleTimer();
    throttleTimer = setTimeout(() => {
      throttleTimer = null;
      flushInterimNow();
    }, 500);
  }

  async function finalizeDiscordStream(): Promise<void> {
    clearThrottleTimer();
    await editTail;

    const trimmed = buffer.trim();
    const discordEmptyFallback = "\u3164"; // 避免最终 edit 为空串被 Discord 拒绝
    const chunks = splitDiscordMessage(trimmed.length > 0 ? trimmed : discordEmptyFallback);

    await deliverDiscordFinalContent(
      async () => {
        await sentMsg.edit({ content: chunks[0]! });
      },
      async () => {
        await channelSend(chunks[0]!);
      },
      { chunk: 0, total: chunks.length },
    );
    for (let i = 1; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      await withDiscordRetry(async (): Promise<void> => {
        await channelSend(chunk);
      });
    }
  }

  for await (const event of events) {
    switch (event.event) {
      case "token":
        buffer += event.data.content;
        burstTokens++;
        if (burstTokens >= 10) {
          flushInterimNow();
        } else {
          scheduleDebouncedFlush();
        }
        break;
      case "content_replace":
        buffer = event.data.content;
        flushInterimNow();
        break;
      case "awaiting_clarify": {
        const payload = parseClarifyStreamEvent(event.data);
        if (payload) {
          buffer += `\n${formatClarifyForPlatform("discord", payload)}`;
        }
        flushInterimNow();
        break;
      }
      case "tool_begin": {
        const tool = event.data.name;
        if (tool !== "clarify") {
          buffer += `\n🔧 ${tool}(...)\n`;
        }
        flushInterimNow();
        break;
      }
      case "tool_result":
        break;
      case "tool_error":
        buffer += `\n❌ ${event.data.content}`;
        flushInterimNow();
        break;
      case "error":
        clearThrottleTimer();
        throw new Error(event.data.error);
      case "done":
        await finalizeDiscordStream();
        return;
    }
  }

  await finalizeDiscordStream();
}

async function finalizeUserReaction(
  message: Message,
  eyeReaction: import("discord.js").MessageReaction | undefined,
  ok: boolean,
): Promise<void> {
  const botId = message.client.user?.id;
  if (eyeReaction && botId) {
    try {
      await eyeReaction.users.remove(botId);
    } catch (e) {
      logComponent("discord").warn("Discord 移除 👀 反应失败", { err: e });
    }
  }
  try {
    await message.react(ok ? "✅" : "❌");
  } catch (e) {
    logComponent("discord").warn(`Discord 添加 ${ok ? "✅" : "❌"} 反应失败`, { err: e });
  }
}

function logDiscordSessionError(sid: string, e: unknown): void {
  const short = sid.slice(0, 12);
  const context = { session_id: sid };
  if (isTransientNetworkError(e) && !isEngineStreamError(e)) {
    logComponent("discord").error(`Discord session ${short} network error`, {
      err: e,
      ...context,
    });
  } else {
    logComponent("discord").error(`Discord session ${short} engine error`, {
      err: e,
      ...context,
    });
  }
}

export class DiscordAdapter implements PlatformAdapter {
  readonly name = "discord";
  private readonly cfg: DiscordConfig;
  private readonly client: Client;
  private started = false;
  private loginRetryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly service: NestService,
    private readonly token: string,
    config?: Record<string, unknown>,
  ) {
    this.cfg = mergeDiscordConfig(config);
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessageReactions,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    this.client.on("error", (e) => {
      logComponent("discord").error("Discord client error", { err: e });
    });

    this.client.on("shardError", (error, shardId) => {
      logComponent("discord").error("Discord shard error", {
        err: error,
        shard_id: shardId,
      });
      this.service.updatePlatformStatus("discord", "degraded", { shard_id: shardId });
    });

    this.client.on("shardDisconnect", (event, shardId) => {
      logComponent("discord").warn(`Discord shard ${shardId} disconnected`, {
        shard_id: shardId,
        code: event.code,
      });
      this.service.updatePlatformStatus("discord", "disconnected", {
        shard_id: shardId,
        code: event.code,
      });
    });

    this.client.on("clientReady", () => {
      this.clearLoginRetry();
      const user = this.client.user;
      const botName = user?.tag ?? "?";
      const botId = user?.id ?? "?";
      logComponent("discord").info(`Discord bot logged in as ${botName}`, {
        bot_name: botName,
        bot_id: botId,
      });
      this.service.updatePlatformStatus("discord", "connected", {
        bot_name: botName,
        bot_id: botId,
      });
      void syncDiscordSlashCommands(this.client, this.token, this.service, this.cfg);
    });

    this.client.on("interactionCreate", (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      void this.onSlashCommand(interaction).catch((e) => {
        logComponent("discord").error("Discord slash command failed", { err: e });
      });
    });

    this.client.on("messageCreate", (msg) => {
      void this.onMessage(msg).catch((e) => {
        logComponent("discord").error("Discord on_message failed", { err: e });
      });
    });
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.service.registerPlatform("discord");
    // Cron 调度器先于平台启动；deliver 不依赖 gateway ready，仅发送时需已连接
    registerDiscordCronDeliverer(this.client);
    await this.attemptLogin();
  }

  private clearLoginRetry(): void {
    if (this.loginRetryTimer === null) return;
    clearTimeout(this.loginRetryTimer);
    this.loginRetryTimer = null;
  }

  private scheduleLoginRetry(): void {
    if (!this.started || this.loginRetryTimer !== null || this.client.isReady()) return;
    const retryMin = Math.round(DISCORD_LOGIN_RETRY_MS / 60_000);
    logComponent("discord").warn(`${retryMin} 分钟后重试登录…`, { retry_in_min: retryMin });
    this.service.updatePlatformStatus("discord", "disconnected", {
      retry_in_sec: DISCORD_LOGIN_RETRY_MS / 1000,
    });
    this.loginRetryTimer = setTimeout(() => {
      this.loginRetryTimer = null;
      void this.attemptLogin();
    }, DISCORD_LOGIN_RETRY_MS);
  }

  private async attemptLogin(): Promise<void> {
    if (!this.started || this.client.isReady()) return;
    this.service.updatePlatformStatus("discord", "starting");
    try {
      await this.client.login(this.token);
    } catch (e) {
      logComponent("discord").error("Discord login failed", { err: e });
      this.service.updatePlatformStatus("discord", "disconnected", {
        error: e instanceof Error ? e.message : String(e),
        retry_in_sec: DISCORD_LOGIN_RETRY_MS / 1000,
      });
      this.scheduleLoginRetry();
    }
  }

  async stop(): Promise<void> {
    logComponent("shutdown").info("Discord 断开网关…");
    this.started = false;
    this.clearLoginRetry();
    unregisterDiscordCronDeliverer();
    this.client.destroy();
    logComponent("shutdown").info("Discord 已断开");
  }

  private async onSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const origin = originFromInteraction(interaction);
    const { session_id: sid } = await this.service.findOrCreateSession(
      "discord",
      origin.platform_extra,
    );

    const text = interactionToCommandText(interaction);
    const cmdResult = await this.service.executeCommand({
      session_id: sid,
      text,
      platform: "discord",
      origin_extra: origin.platform_extra,
    });

    if (cmdResult.found) {
      await replyDiscordInteraction(interaction, cmdResult.text, splitDiscordMessage);
      return;
    }

    await replyDiscordInteraction(
      interaction,
      `❌ 未知命令: /${interaction.commandName}`,
      splitDiscordMessage,
    );
  }

  private async onMessage(message: Message): Promise<void> {
    const botId = this.client.user?.id;
    const ctx = messageContext(message, botId);
    if (botId) {
      ctx.isReplyToBot = await resolveReplyToBot(message, botId);
    }
    if (!shouldRespond(ctx, this.cfg)) return;

    let cleanContent = ctx.content.trim();
    if (botId) {
      cleanContent = stripBotMention(cleanContent, botId);
    }
    if (!cleanContent) return;

    const channel = await this.ensureThread(message, ctx, cleanContent);
    const threadOrigin = this.resolveThreadOrigin(message, channel.id, ctx);

    const { session_id: sid } = await this.service.findOrCreateSession(
      "discord",
      threadOrigin.platform_extra,
    );

    const cmdResult = await this.service.executeCommand({
      session_id: sid,
      text: cleanContent,
      platform: "discord",
      origin_extra: threadOrigin.platform_extra,
    });
    if (cmdResult.found) {
      if (cmdResult.text) await this.sendToChannel(channel, cmdResult.text);
      return;
    }

    if (!channel.isTextBased()) return;

    // 👀 表示已收到消息
    let eyeReaction: import("discord.js").MessageReaction | undefined;
    try {
      eyeReaction = await message.react("👀");
    } catch {
      /* 反应失败不影响主流程 */
    }

    try {
      if ("sendTyping" in channel && typeof channel.sendTyping === "function") {
        await withDiscordRetry(() => channel.sendTyping());
      }
      await streamReplyToChannel(
        channel,
        this.service.sendMessageStream(sid, cleanContent, "discord"),
      );

      await finalizeUserReaction(message, eyeReaction, true);

      // 流式回复完成：用 auto-title 重命名子线程
      if (channel.isThread()) {
        try {
          const meta = await loadSessionMeta(sid);
          const title = (meta.title as string)?.trim();
          if (title) {
            await channel.setName(title.slice(0, 100));
          }
        } catch {
          /* 重命名失败不影响主流程 */
        }
      }
    } catch (e) {
      logDiscordSessionError(sid, e);
      await finalizeUserReaction(message, eyeReaction, false);
      try {
        await this.sendToChannel(channel, networkErrorUserHint(e));
      } catch {
        /* 网络故障时可能无法回复 */
      }
    }
  }

  private resolveThreadOrigin(
    message: Message,
    replyChannelId: string,
    ctx: DiscordMessageContext,
  ): PlatformOrigin {
    const guildId = message.guild?.id ?? "";
    if (ctx.isThread || !shouldCreateThread(ctx, this.cfg)) {
      return extractOrigin({
        channelId: String(message.channel.id),
        parentChannelId: ctx.parentChannelId,
        guildId,
        isThread: ctx.isThread,
      });
    }
    if (replyChannelId !== String(message.channel.id)) {
      return threadOriginAfterCreate({
        guildId,
        parentChannelId: String(message.channel.id),
        threadId: replyChannelId,
      });
    }
    return extractOrigin({
      channelId: String(message.channel.id),
      parentChannelId: ctx.parentChannelId,
      guildId,
      isThread: false,
    });
  }

  private async ensureThread(
    message: Message,
    ctx: DiscordMessageContext,
    titleHint?: string,
  ): Promise<TextBasedChannel> {
    if (!shouldCreateThread(ctx, this.cfg)) {
      if (!message.channel.isTextBased()) {
        throw new Error("Channel is not text-based");
      }
      return message.channel;
    }

    const fallbackName = `逸灵风 × ${message.member?.displayName ?? message.author.displayName}`;
    const threadName = (titleHint?.trim() ?? fallbackName).slice(0, 100) || fallbackName;
    try {
      const thread = await withDiscordRetry(() =>
        message.startThread({
          name: threadName,
          autoArchiveDuration: 60,
        }),
      );
      logComponent("discord").info(`Created thread ${thread.name} for ${message.author.tag}`, {
        thread_id: thread.id,
        thread_name: thread.name,
        author: message.author.tag,
      });
      return thread;
    } catch (e) {
      logComponent("discord").error("Discord create thread failed, fallback to channel", {
        err: e,
      });
      if (!message.channel.isTextBased()) {
        throw new Error("Channel is not text-based");
      }
      return message.channel;
    }
  }

  private async sendToChannel(channel: TextBasedChannel, text: string): Promise<void> {
    if (!("send" in channel) || typeof channel.send !== "function") return;
    for (const chunk of splitDiscordMessage(text)) {
      await withDiscordRetry(async () => {
        await channel.send(chunk);
      });
    }
  }
}

export function createDiscordAdapter(
  service: NestService,
  token: string,
  config?: Record<string, unknown>,
): DiscordAdapter {
  return new DiscordAdapter(service, token, config);
}
