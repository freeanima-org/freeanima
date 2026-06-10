import {
  ChannelType,
  Client,
  GatewayIntentBits,
  type ChatInputCommandInteraction,
  type Message,
  Partials,
  type TextBasedChannel,
} from "discord.js";
import type { StreamEvent } from "@freeanima/engine-loop";
import {
  isEngineStreamError,
  isTransientNetworkError,
  networkErrorUserHint,
} from "@freeanima/engine-loop";
import { getServiceContext } from "@freeanima/service-api";
import { RateLimitedLogger } from "@freeanima/kernel-retry";
import { logComponent } from "@freeanima/service-logging";
import type { AnimaService } from "@freeanima/service-api";
import type { PlatformAdapter } from "../platforms.ts";
import { formatClarifyForPlatform, parseClarifyStreamEvent } from "../clarify/index.ts";
import { registerDiscordCronDeliverer, unregisterDiscordCronDeliverer } from "../cron-deliver.ts";
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
} from "./discord-policy.ts";
import {
  interactionToCommandText,
  originFromInteraction,
  replyDiscordInteraction,
  syncDiscordSlashCommands,
} from "./discord-slash.ts";

import { chunkText } from "../chunk-text.ts";
import {
  deliverDiscordFinalContent,
  tryDiscordInterimEdit,
  withDiscordRetry,
} from "./discord-retry.ts";
import { ToolRoundCollector } from "../stream-tool-format.ts";

const DISCORD_MAX_LEN = 2000;
/** Final answer edit throttle interval */
export const DISCORD_ANSWER_EDIT_MS = 3000;
/** Final answer segment threshold */
export const DISCORD_ANSWER_SPLIT_AT = 1000;
/** Discord login failure auto-retry interval */
export const DISCORD_LOGIN_RETRY_MS = 5 * 60 * 1000;
/** Placeholder at stream reply start */
const DISCORD_STREAM_PLACEHOLDER = "⏳ Thinking…";

function splitDiscordMessage(text: string, limit = DISCORD_MAX_LEN): string[] {
  return chunkText(text, limit, { maxChunkLength: DISCORD_MAX_LEN });
}

function messageContext(message: Message, botUserId: string | undefined): DiscordMessageContext {
  const isThread = message.channel.isThread();
  const parentId =
    isThread && "parentId" in message.channel && message.channel.parentId
      ? String(message.channel.parentId)
      : String(message.channel.id);

  const isMentioned =
    Boolean(botUserId && message.mentions.users.has(botUserId)) ||
    Boolean(message.client.user && message.content.startsWith(message.client.user.displayName));

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

/** Discord gateway: each tool round separate message, final answer separate (3s throttled edit). */
export async function streamReplyToChannel(
  channel: TextBasedChannel,
  events: AsyncIterable<StreamEvent>,
): Promise<void> {
  if (!("send" in channel) || typeof channel.send !== "function") return;
  const channelSend = channel.send.bind(channel) as (content: string) => Promise<Message>;

  const toolRound = new ToolRoundCollector();
  let answerBuffer = "";
  let answerMsg: Message | null = null;
  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  let editTail: Promise<void> = Promise.resolve();

  const discordEmptyFallback = "\u3164";

  const clearThrottleTimer = (): void => {
    if (throttleTimer !== null) {
      clearTimeout(throttleTimer);
      throttleTimer = null;
    }
  };

  /** Finalize current answer segment so later tool sends do not insert after placeholder */
  const commitAnswerSegment = async (): Promise<void> => {
    clearThrottleTimer();
    await editTail;
    if (!answerMsg) return;

    const trimmed = answerBuffer.trim();
    if (trimmed) {
      const content = trimmed.length <= DISCORD_MAX_LEN ? trimmed : trimmed.slice(-DISCORD_MAX_LEN);
      await deliverDiscordFinalContent(
        async () => {
          await answerMsg!.edit({ content });
        },
        async () => {
          await channelSend(content);
        },
        { phase: "commit-segment" },
      );
    } else {
      await tryDiscordInterimEdit(
        async () => {
          await answerMsg!.edit({ content: discordEmptyFallback });
        },
        { phase: "commit-empty" },
      );
    }
    answerMsg = null;
    answerBuffer = "";
  };

  const sendChunked = async (text: string): Promise<void> => {
    for (const chunk of splitDiscordMessage(text)) {
      await withDiscordRetry(async (): Promise<void> => {
        await channelSend(chunk);
      });
    }
  };

  const flushToolRound = async (): Promise<void> => {
    const text = toolRound.take();
    if (!text) return;
    await commitAnswerSegment();
    await sendChunked(text);
  };

  const ensureAnswerMsg = async (): Promise<Message> => {
    if (answerMsg) return answerMsg;
    answerMsg = await withDiscordRetry(async (): Promise<Message> => {
      return await channelSend(DISCORD_STREAM_PLACEHOLDER);
    });
    return answerMsg;
  };

  const flushAnswerEdit = (): void => {
    editTail = editTail.then(async () => {
      if (!answerMsg) return;
      const trimmed = answerBuffer.trim();
      const content =
        trimmed.length > 0
          ? trimmed.length <= DISCORD_MAX_LEN
            ? trimmed
            : trimmed.slice(-DISCORD_MAX_LEN)
          : DISCORD_STREAM_PLACEHOLDER;
      await tryDiscordInterimEdit(
        async () => {
          await answerMsg!.edit({ content });
        },
        { content_len: content.length },
      );
    });
  };

  const scheduleAnswerEdit = (): void => {
    clearThrottleTimer();
    throttleTimer = setTimeout(() => {
      throttleTimer = null;
      flushAnswerEdit();
    }, DISCORD_ANSWER_EDIT_MS);
  };

  const finalizeDiscordStream = async (): Promise<void> => {
    clearThrottleTimer();
    await editTail;
    await flushToolRound();

    const trimmed = answerBuffer.trim();
    if (!trimmed) return;

    const chunks = splitDiscordMessage(trimmed, DISCORD_ANSWER_SPLIT_AT);

    if (!answerMsg) {
      for (const chunk of chunks) {
        await withDiscordRetry(async (): Promise<void> => {
          await channelSend(chunk);
        });
      }
      return;
    }

    const first = chunks[0] ?? discordEmptyFallback;
    await deliverDiscordFinalContent(
      async () => {
        await answerMsg!.edit({ content: first });
      },
      async () => {
        await channelSend(first);
      },
      { chunk: 0, total: chunks.length },
    );
    for (let i = 1; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      await withDiscordRetry(async (): Promise<void> => {
        await channelSend(chunk);
      });
    }
  };

  for await (const event of events) {
    switch (event.event) {
      case "token":
        await flushToolRound();
        answerBuffer += event.data.content;
        await ensureAnswerMsg();
        scheduleAnswerEdit();
        break;
      case "content_replace":
        await flushToolRound();
        answerBuffer = event.data.content;
        await ensureAnswerMsg();
        flushAnswerEdit();
        break;
      case "awaiting_clarify": {
        await flushToolRound();
        const payload = parseClarifyStreamEvent(event.data);
        if (payload) {
          await sendChunked(formatClarifyForPlatform("discord", payload));
        }
        break;
      }
      case "tool_begin":
        clearThrottleTimer();
        toolRound.addBegin(event.data.name, event.data.args);
        break;
      case "tool_result":
        toolRound.addResult(event.data.name, event.data.content);
        break;
      case "tool_error":
        toolRound.addError(event.data.content);
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
      logComponent("discord").warn("Discord failed to remove 👀 reaction", { err: e });
    }
  }
  try {
    await message.react(ok ? "✅" : "❌");
  } catch (e) {
    logComponent("discord").warn(`Discord failed to add ${ok ? "✅" : "❌"} reaction`, { err: e });
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
  private readonly shardErrorLogLimiter = new RateLimitedLogger();

  constructor(
    private readonly service: AnimaService,
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
      if (this.shardErrorLogLimiter.shouldLog(`shard:${shardId}`)) {
        logComponent("discord").warn("Discord shard error", {
          err: error,
          shard_id: shardId,
        });
      }
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
      this.shardErrorLogLimiter.reset();
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
    // Cron scheduler starts before platforms; deliver does not require gateway ready, only needs connection to send
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
    logComponent("discord").warn(`${retryMin} min later, retrying login…`, {
      retry_in_min: retryMin,
    });
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
    logComponent("shutdown").debug("Discord disconnecting gateway…");
    this.started = false;
    this.clearLoginRetry();
    unregisterDiscordCronDeliverer();
    this.client.destroy();
    logComponent("shutdown").debug("Discord disconnected");
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
      `❌ Unknown command: /${interaction.commandName}`,
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

    // 👀 indicates message received
    let eyeReaction: import("discord.js").MessageReaction | undefined;
    try {
      eyeReaction = await message.react("👀");
    } catch {
      /* Reaction failure does not affect main flow */
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

      // Stream reply complete: rename sub-thread with auto-title
      if (channel.isThread()) {
        try {
          const meta = await getServiceContext().conversation.loadSessionMeta(sid);
          const title = (meta.title as string)?.trim();
          if (title) {
            await channel.setName(title.slice(0, 100));
          }
        } catch {
          /* Rename failure does not affect main flow */
        }
      }
    } catch (e) {
      logDiscordSessionError(sid, e);
      await finalizeUserReaction(message, eyeReaction, false);
      try {
        await this.sendToChannel(channel, networkErrorUserHint(e));
      } catch {
        /* May fail to reply on network errors */
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

    const fallbackName = `Free Anima × ${message.member?.displayName ?? message.author.displayName}`;
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
        throw new Error("Channel is not text-based", { cause: e });
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
  service: AnimaService,
  token: string,
  config?: Record<string, unknown>,
): DiscordAdapter {
  return new DiscordAdapter(service, token, config);
}
