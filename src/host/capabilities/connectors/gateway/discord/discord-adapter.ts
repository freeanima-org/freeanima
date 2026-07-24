import {
  ChannelType,
  Client,
  GatewayIntentBits,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Message,
  Partials,
  type TextBasedChannel,
} from "discord.js";
import { expireIfNeeded, readAwaitingClarify } from "@freeanima/host/capabilities/tools/clarify";
import {
  isEngineStreamError,
  isTransientNetworkError,
  networkErrorUserHint,
} from "@freeanima/host/engine/loop";
import { getAppRuntime } from "@freeanima/host/platform/ports";
import { resolveCommand } from "@freeanima/host/capabilities/tools/slash-commands";
import { conversationUpdated } from "@freeanima/host/capabilities/memory";
import { isConversationMeta } from "@freeanima/host/core/db/domain";
import type { EventBus } from "@freeanima/host/kernel/eventbus";
import { KeyedRateLimiter } from "@freeanima/host/core/util/backoff";
import { logComponent } from "@freeanima/host/platform/logging";
import type { MessagingPort } from "@freeanima/host/platform/ports/messaging-port";
import { registerDiscordCronDeliverer, unregisterDiscordCronDeliverer } from "../cron-deliver.ts";
import type { PlatformAdapter } from "../platforms.ts";
import { resolveToolDisplayMode } from "../tool-display.ts";
import { streamReplyToChannel } from "./discord-channel.ts";
import {
  disabledActionRowsFromMessage,
  parseClarifyButtonCustomId,
} from "./discord-clarify-components.ts";
import { ClarifyPendingRegistry } from "./discord-clarify-pending.ts";
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
  ensureSlashInteractionDeferred,
  interactionToCommandText,
  originFromButtonInteraction,
  originFromInteraction,
  streamReplyToInteraction,
  syncDiscordSlashCommands,
} from "./discord-slash.ts";

import { isDiscordDeliveryDegraded, withDiscordRetry } from "./discord-retry.ts";
import { chunkText } from "../chunk-text.ts";
import {
  discordThreadNameFromUserMessage,
  discordThreadTitleFromSession,
  shouldRenameDiscordThread,
} from "./discord-thread-title.ts";

const DISCORD_MAX_LEN = 2000;
/** Discord login failure auto-retry interval */
export const DISCORD_LOGIN_RETRY_MS = 5 * 60 * 1000;

export { DISCORD_ANSWER_EDIT_MS, DISCORD_ANSWER_SPLIT_AT } from "./discord-channel.ts";

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

export { streamReplyToChannel } from "./discord-channel.ts";

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
  const context = { conversation_id: sid };
  if (isTransientNetworkError(e) && !isEngineStreamError(e)) {
    logComponent("discord").error(`Discord conversation ${short} network error`, {
      err: e,
      ...context,
    });
  } else {
    logComponent("discord").error(`Discord conversation ${short} engine error`, {
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
  private readonly shardErrorLogLimiter = new KeyedRateLimiter();
  private conversationUpdatedOff: (() => void) | null = null;
  private readonly slashInteractionInflight = new Map<string, Promise<void>>();
  private readonly buttonInteractionInflight = new Map<string, Promise<void>>();
  private readonly clarifyPending: ClarifyPendingRegistry;

  constructor(
    private readonly service: MessagingPort,
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
    this.clarifyPending = new ClarifyPendingRegistry(this.client);

    this.client.on("error", (e) => {
      logComponent("discord").error("Discord client error", { err: e });
    });

    this.client.on("shardError", (error, shardId) => {
      if (this.shardErrorLogLimiter.allow(`shard:${shardId}`)) {
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
      if (interaction.isChatInputCommand()) {
        void this.runSlashCommandOnce(interaction).catch((e) => {
          const log = logComponent("discord");
          if (isDiscordDeliveryDegraded(e)) {
            log.warn("Discord slash command failed", { err: e });
          } else {
            log.error("Discord slash command failed", { err: e });
          }
        });
        return;
      }
      if (interaction.isButton() && interaction.customId.startsWith("clarify:")) {
        void this.runClarifyButtonOnce(interaction).catch((e) => {
          const log = logComponent("discord");
          if (isDiscordDeliveryDegraded(e)) {
            log.warn("Discord clarify button failed", { err: e });
          } else {
            log.error("Discord clarify button failed", { err: e });
          }
        });
      }
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
    registerDiscordCronDeliverer(this.client);
    this.attachSessionTitleListener();
    await this.attemptLogin();
  }

  private attachSessionTitleListener(): void {
    this.conversationUpdatedOff?.();
    this.conversationUpdatedOff = null;
    try {
      const kernel = (getAppRuntime() as { kernel?: { eventBus: EventBus } }).kernel;
      const bus = kernel?.eventBus;
      if (!bus) return;
      this.conversationUpdatedOff = bus.on(conversationUpdated, (payload) => {
        void this.onSessionTitleUpdated(payload.conversation_id);
      });
    } catch {
      /* AppRuntime not ready yet; skip */
    }
  }

  private clearLoginRetry(): void {
    if (this.loginRetryTimer == null) return;
    clearTimeout(this.loginRetryTimer);
    this.loginRetryTimer = null;
  }

  private scheduleLoginRetry(): void {
    if (!this.started || this.loginRetryTimer != null || this.client.isReady()) return;
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
    this.conversationUpdatedOff?.();
    this.conversationUpdatedOff = null;
    unregisterDiscordCronDeliverer();
    this.clarifyPending.disposeAll();
    void this.client.destroy();
    logComponent("shutdown").debug("Discord disconnected");
  }

  private runSlashCommandOnce(interaction: ChatInputCommandInteraction): Promise<void> {
    const inflight = this.slashInteractionInflight.get(interaction.id);
    if (inflight) return inflight;
    const task = this.handleSlashCommand(interaction).finally(() => {
      this.slashInteractionInflight.delete(interaction.id);
    });
    this.slashInteractionInflight.set(interaction.id, task);
    return task;
  }

  private runClarifyButtonOnce(interaction: ButtonInteraction): Promise<void> {
    const inflight = this.buttonInteractionInflight.get(interaction.id);
    if (inflight) return inflight;
    const task = this.handleClarifyButton(interaction).finally(() => {
      this.buttonInteractionInflight.delete(interaction.id);
    });
    this.buttonInteractionInflight.set(interaction.id, task);
    return task;
  }

  private async handleClarifyButton(interaction: ButtonInteraction): Promise<void> {
    const parsed = parseClarifyButtonCustomId(interaction.customId);
    if (!parsed) return;

    const origin = originFromButtonInteraction(interaction);
    const { conversation_id: channelSid } = await this.service.findOrCreateConversation(
      "discord",
      origin.platform_extra,
    );
    if (channelSid !== parsed.conversationId) {
      await this.rejectClarifyButton(interaction, "This button does not belong to this channel.");
      return;
    }

    const conversation = getAppRuntime().conversation;
    const expiry = await expireIfNeeded(conversation, parsed.conversationId);
    if (expiry.expired) {
      await this.rejectClarifyButton(
        interaction,
        expiry.hint ?? "Previous questions have expired.",
      );
      return;
    }

    const awaiting = await readAwaitingClarify(conversation, parsed.conversationId);
    if (!awaiting) {
      await this.rejectClarifyButton(interaction, "No pending confirmation for this conversation.");
      return;
    }

    const channel = interaction.channel;
    if (!channel?.isTextBased()) return;

    await interaction.deferUpdate();
    await this.clarifyPending.clear(parsed.conversationId);

    if (parsed.kind === "cancel") {
      const cmdResult = await this.service.executeCommand({
        conversation_id: parsed.conversationId,
        text: "/cancel",
        platform: "discord",
        origin_extra: origin.platform_extra,
      });
      if (cmdResult.text) {
        await this.sendToChannel(channel, cmdResult.text);
      }
      return;
    }

    const choice = awaiting.items[0]?.choices?.[parsed.choiceIndex];
    if (!choice) {
      await interaction.followUp({
        content: "Invalid choice.",
        ephemeral: true,
      });
      return;
    }

    try {
      await streamReplyToChannel(
        channel,
        this.service.sendMessageStream(parsed.conversationId, choice, "discord"),
        {
          conversationId: parsed.conversationId,
          clarifyPending: this.clarifyPending,
          toolDisplayMode: resolveToolDisplayMode(
            await getAppRuntime().conversation.loadConversationMeta(parsed.conversationId),
            getAppRuntime().engine.config.data,
          ),
        },
      );
    } catch (e) {
      logDiscordSessionError(parsed.conversationId, e);
      try {
        await this.sendToChannel(channel, networkErrorUserHint(e));
      } catch {
        /* May fail to reply on network errors */
      }
    }
  }

  private async rejectClarifyButton(
    interaction: ButtonInteraction,
    message: string,
  ): Promise<void> {
    const parsed = parseClarifyButtonCustomId(interaction.customId);
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }
    if (parsed) {
      await this.clarifyPending.clear(parsed.conversationId);
    } else if ("edit" in interaction.message && typeof interaction.message.edit === "function") {
      const components = disabledActionRowsFromMessage(interaction.message);
      try {
        await withDiscordRetry(() =>
          interaction.message.edit({ content: interaction.message.content, components }),
        );
      } catch {
        /* disable best-effort */
      }
    }
    await interaction.followUp({ content: message, ephemeral: true });
  }

  private async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const deferred = await ensureSlashInteractionDeferred(interaction);
    if (!deferred) {
      logComponent("discord").warn(
        "Discord slash skipped: interaction already acknowledged (duplicate bot or handler)",
        { interaction_id: interaction.id, command: interaction.commandName },
      );
      return;
    }

    const origin = originFromInteraction(interaction);
    const { conversation_id: sid } = await this.service.findOrCreateConversation(
      "discord",
      origin.platform_extra,
    );

    const text = interactionToCommandText(interaction);
    try {
      await streamReplyToInteraction(
        interaction,
        this.service.sendMessageStream(sid, text, "discord", origin.platform_extra),
        {
          conversationId: sid,
          toolDisplayMode: resolveToolDisplayMode(
            await getAppRuntime().conversation.loadConversationMeta(sid),
            getAppRuntime().engine.config.data,
          ),
        },
      );
    } catch (e) {
      logDiscordSessionError(sid, e);
      try {
        await streamReplyToInteraction(
          interaction,
          (async function* (): AsyncGenerator<import("@freeanima/host/engine/loop").StreamEvent> {
            yield { event: "token", data: { content: networkErrorUserHint(e) } };
            yield { event: "done", data: {} };
          })(),
        );
      } catch {
        /* May fail to reply on network errors */
      }
    }
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

    const { conversation_id: sid } = await this.service.findOrCreateConversation(
      "discord",
      threadOrigin.platform_extra,
    );

    await this.clarifyPending.clear(sid);

    const [cmd] = resolveCommand(cleanContent, "discord");
    if (cmd || cleanContent.startsWith("/")) {
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
          this.service.sendMessageStream(sid, cleanContent, "discord", threadOrigin.platform_extra),
          {
            conversationId: sid,
            clarifyPending: this.clarifyPending,
            toolDisplayMode: resolveToolDisplayMode(
              await getAppRuntime().conversation.loadConversationMeta(sid),
              getAppRuntime().engine.config.data,
            ),
          },
        );
        await finalizeUserReaction(message, eyeReaction, true);
      } catch (e) {
        logDiscordSessionError(sid, e);
        await finalizeUserReaction(message, eyeReaction, false);
        try {
          await this.sendToChannel(channel, networkErrorUserHint(e));
        } catch {
          /* May fail to reply on network errors */
        }
      }
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
        {
          conversationId: sid,
          clarifyPending: this.clarifyPending,
          toolDisplayMode: resolveToolDisplayMode(
            await getAppRuntime().conversation.loadConversationMeta(sid),
            getAppRuntime().engine.config.data,
          ),
        },
      );

      await finalizeUserReaction(message, eyeReaction, true);
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

  private async onSessionTitleUpdated(conversationId: string): Promise<void> {
    try {
      const meta = await getAppRuntime().conversation.loadConversationMeta(conversationId);
      if (!isConversationMeta(meta) || meta.platform !== "discord") return;
      const threadId = meta.platform_extra?.thread_id;
      if (!threadId) return;

      const title = (
        await getAppRuntime().conversation.getConversationTitle(conversationId)
      ).trim();
      if (!title) return;

      const channel = await withDiscordRetry(() => this.client.channels.fetch(String(threadId)));
      if (!channel?.isThread()) return;

      await this.maybeApplySessionTitleToThread(channel, conversationId);
    } catch (e) {
      logComponent("discord").debug("Discord conversation title thread rename skipped", {
        conversation_id: conversationId,
        err: e,
      });
    }
  }

  private async maybeApplySessionTitleToThread(
    channel: TextBasedChannel & {
      isThread(): boolean;
      name?: string;
      setName(name: string): Promise<unknown>;
    },
    conversationId: string,
  ): Promise<void> {
    if (!channel.isThread()) return;
    try {
      const title = (
        await getAppRuntime().conversation.getConversationTitle(conversationId)
      ).trim();
      if (!title || !shouldRenameDiscordThread(String(channel.name ?? ""), title)) return;
      await channel.setName(discordThreadTitleFromSession(title));
    } catch {
      /* Rename failure does not affect main flow */
    }
  }

  private async ensureThread(
    message: Message,
    ctx: DiscordMessageContext,
    userText: string,
  ): Promise<TextBasedChannel> {
    if (!shouldCreateThread(ctx, this.cfg)) {
      if (!message.channel.isTextBased()) {
        throw new Error("Channel is not text-based");
      }
      return message.channel;
    }

    const threadName = discordThreadNameFromUserMessage(userText);
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
  service: MessagingPort,
  token: string,
  config?: Record<string, unknown>,
): DiscordAdapter {
  return new DiscordAdapter(service, token, config);
}
