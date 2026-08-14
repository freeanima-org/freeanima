import { logComponent } from "@freeanima/habitat/platform/logging";
import type { MessagingPort } from "@freeanima/habitat/platform/ports/messaging-port";
import type { StreamEvent } from "@freeanima/habitat/kernel/loop-mechanism";
import {
  REST,
  Routes,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";

import { chunkText } from "../chunk-text.ts";
import {
  createDiscordAnswerStrategy,
  createDiscordCleanupStrategy,
  createDiscordGatewayToolRoundStrategy,
  createStreamChannelComposer,
  DISCORD_ANSWER_SPLIT_AT,
} from "../stream-strategies/index.ts";
import type { ToolDisplayMode } from "../tool-display.ts";
import { DEFAULT_TOOL_DISPLAY_MODE } from "../tool-display.ts";
import { runStreamChannel } from "../stream-state/run-channel.ts";
import {
  deliverDiscordFinalContent,
  isDiscordDeliveryDegraded,
  isDiscordInteractionAlreadyAcked,
  tryDiscordInterimEdit,
  withDiscordRetry,
} from "./discord-retry.ts";
import type { DiscordConfig } from "./discord-policy.ts";
import { extractOrigin, type PlatformOrigin } from "./discord-policy.ts";

export type DiscordSlashCommandMeta = {
  name: string;
  description: string;
};

const OPTION_APPLIERS: Record<string, (builder: SlashCommandBuilder) => void> = {
  cwd: (b) => {
    b.addStringOption((o) =>
      o
        .setName("path")
        .setDescription("Working directory path (empty to view current)")
        .setRequired(false),
    );
  },
  title: (b) => {
    b.addStringOption((o) =>
      o
        .setName("title")
        .setDescription("New title, max 50 chars (empty to view current)")
        .setRequired(false),
    );
  },
  stats: (b) => {
    b.addBooleanOption((o) =>
      o.setName("all").setDescription("Aggregate stats for all sessions").setRequired(false),
    );
  },
  tooldisplay: (b) => {
    b.addStringOption((o) =>
      o
        .setName("level")
        .setDescription("Display level (empty to view current; reset to clear override)")
        .setRequired(false)
        .addChoices(
          { name: "hidden", value: "hidden" },
          { name: "count", value: "count" },
          { name: "name", value: "name" },
          { name: "name_args_truncated", value: "name_args_truncated" },
          { name: "name_args_full", value: "name_args_full" },
          { name: "name_args_result_full", value: "name_args_result_full" },
          { name: "reset", value: "reset" },
        ),
    );
  },
};

/** Generate Discord Application Commands from runtime command list */
export function buildDiscordSlashCommands(
  commands: DiscordSlashCommandMeta[],
): ReturnType<SlashCommandBuilder["toJSON"]>[] {
  return commands.map((cmd) => {
    const builder = new SlashCommandBuilder()
      .setName(cmd.name)
      .setDescription(cmd.description.slice(0, 100));
    OPTION_APPLIERS[cmd.name]?.(builder);
    return builder.toJSON();
  });
}

/** Discord interaction → Free Anima slash text (e.g. `/cwd path:/tmp` → `/cwd /tmp`) */
export function interactionToCommandText(interaction: ChatInputCommandInteraction): string {
  const name = interaction.commandName;
  const parts: string[] = [];

  const path = interaction.options.getString("path");
  const title = interaction.options.getString("title");
  const all = interaction.options.getBoolean("all");
  const toolLevel = interaction.options.getString("level");

  if (path) parts.push(path);
  if (title) parts.push(title);
  if (all) parts.push("--all");
  if (toolLevel) parts.push(toolLevel);

  return parts.length > 0 ? `/${name} ${parts.join(" ")}` : `/${name}`;
}

export function originFromInteraction(interaction: ChatInputCommandInteraction): PlatformOrigin {
  const channel = interaction.channel;
  if (!channel) {
    throw new Error("interaction has no channel");
  }
  return originFromDiscordChannel(channel, interaction.guildId ?? "");
}

export function originFromButtonInteraction(interaction: ButtonInteraction): PlatformOrigin {
  const channel = interaction.channel;
  if (!channel) {
    throw new Error("interaction has no channel");
  }
  return originFromDiscordChannel(channel, interaction.guildId ?? "");
}

function originFromDiscordChannel(
  channel: NonNullable<ChatInputCommandInteraction["channel"]>,
  guildId: string,
): PlatformOrigin {
  const isThread = "isThread" in channel && channel.isThread();
  const channelId = channel.id;
  const parentChannelId =
    isThread && "parentId" in channel && channel.parentId ? channel.parentId : channelId;
  return extractOrigin({
    channelId,
    parentChannelId,
    guildId,
    isThread,
  });
}

export async function syncDiscordSlashCommands(
  client: Client,
  token: string,
  service: MessagingPort,
  cfg: DiscordConfig,
): Promise<void> {
  if (!cfg.slash_commands) return;

  const appId = client.user?.id;
  if (!appId) return;

  const { commands } = service.listCommands({ platform: "discord" });
  const body = buildDiscordSlashCommands(commands);
  const rest = new REST({ version: "10" }).setToken(token);
  const guildId = (cfg.slash_commands_guild_id ?? "").trim();

  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(appId, guildId), { body });
      logComponent("discord").info(
        `Discord slash commands synced to guild ${guildId} (${body.length} commands)`,
        { guild_id: guildId, command_count: body.length },
      );
    } else {
      await rest.put(Routes.applicationCommands(appId), { body });
      logComponent("discord").info(
        `Discord slash commands synced globally (${body.length} commands)`,
        { command_count: body.length },
      );
    }
  } catch (e) {
    logComponent("discord").error("Discord slash command sync failed", { err: e });
  }
}

/** deferReply，已确认或重复投递时返回 false（调用方应跳过本次处理） */
export async function ensureSlashInteractionDeferred(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (interaction.deferred || interaction.replied) return true;
  try {
    await interaction.deferReply();
    return true;
  } catch (e) {
    if (interaction.deferred || interaction.replied) return true;
    if (isDiscordInteractionAlreadyAcked(e)) return false;
    if (isDiscordDeliveryDegraded(e)) return false;
    throw e;
  }
}

export async function replyDiscordInteraction(
  interaction: ChatInputCommandInteraction,
  text: string,
  splitMessage: (t: string) => string[],
): Promise<void> {
  const chunks = splitMessage(text);
  const channel = interaction.channel;
  const sendViaChannel = async (content: string): Promise<void> => {
    if (channel && "send" in channel && typeof channel.send === "function") {
      await withDiscordRetry(async (): Promise<void> => {
        await channel.send({ content });
      });
      return;
    }
    if (interaction.replied || interaction.deferred) {
      await withDiscordRetry(() => interaction.followUp({ content }));
    }
  };

  if (chunks.length === 0) {
    try {
      await withDiscordRetry(() => interaction.editReply({ content: "(no output)" }));
    } catch (e) {
      if (isDiscordDeliveryDegraded(e)) {
        await sendViaChannel("(no output)");
      } else {
        throw e;
      }
    }
    return;
  }
  const firstChunk = chunks[0];
  if (!firstChunk) return;
  await deliverDiscordFinalContent(
    async () => {
      await interaction.editReply({ content: firstChunk });
    },
    async () => {
      if (interaction.replied || interaction.deferred) {
        await withDiscordRetry(() => interaction.followUp({ content: firstChunk }));
      } else {
        await sendViaChannel(firstChunk);
      }
    },
    { kind: "slash", chunk: 0 },
  );
  for (const chunk of chunks.slice(1)) {
    try {
      await withDiscordRetry(() => interaction.followUp({ content: chunk }));
    } catch (e) {
      if (isDiscordDeliveryDegraded(e)) {
        await sendViaChannel(chunk);
      } else {
        throw e;
      }
    }
  }
}

const DISCORD_MAX_LEN = 2000;

function splitDiscordInteractionMessage(text: string, limit = DISCORD_MAX_LEN): string[] {
  return chunkText(text, limit, { maxChunkLength: DISCORD_MAX_LEN });
}

export type DiscordStreamInteractionOptions = {
  toolDisplayMode?: ToolDisplayMode;
  conversationId?: string;
};

/** Stream slash command output to a deferred Discord interaction (ack → final). */
export async function streamReplyToInteraction(
  interaction: ChatInputCommandInteraction,
  events: AsyncIterable<StreamEvent>,
  opts?: DiscordStreamInteractionOptions,
): Promise<void> {
  let answerOpen = false;
  let delivered = false;

  const markDelivered = (text: string): void => {
    if (text.trim()) delivered = true;
  };

  const sendFollowUpChunked = async (text: string): Promise<void> => {
    for (const chunk of splitDiscordInteractionMessage(text)) {
      await withDiscordRetry(() => interaction.followUp({ content: chunk }));
    }
  };

  const answerIo = {
    send: async (text: string): Promise<void> => {
      markDelivered(text);
      const chunks = splitDiscordInteractionMessage(text);
      const first = chunks[0] ?? "(no output)";
      await deliverDiscordFinalContent(
        async () => {
          await interaction.editReply({ content: first });
          answerOpen = true;
        },
        async () => {
          await sendFollowUpChunked(first);
        },
        { kind: "slash", chunk: 0 },
      );
      for (const chunk of chunks.slice(1)) {
        await withDiscordRetry(() => interaction.followUp({ content: chunk }));
      }
    },
    edit: async (text: string): Promise<void> => {
      markDelivered(text);
      if (!answerOpen) {
        await withDiscordRetry(() => interaction.editReply({ content: text }));
        answerOpen = true;
        return;
      }
      await tryDiscordInterimEdit(async () => {
        await interaction.editReply({ content: text });
      });
    },
  };

  const toolDisplayMode = opts?.toolDisplayMode ?? DEFAULT_TOOL_DISPLAY_MODE;
  const toolStrategy = createDiscordGatewayToolRoundStrategy(
    async (text) => {
      markDelivered(text);
      await sendFollowUpChunked(text);
    },
    async (content, rows, _timeoutSec) => {
      await withDiscordRetry(() => interaction.followUp({ content, components: rows }));
    },
    toolDisplayMode,
    opts?.conversationId,
  );

  const answerStrategy = createDiscordAnswerStrategy({ io: answerIo });
  const finalizeHandle = answerStrategy.handle.bind(answerStrategy);
  answerStrategy.handle = async (effect, ctx) => {
    if (effect.kind === "answer_finalize") {
      clearInteractionThrottle(ctx);
      const text = effect.content.trim();
      if (!text) {
        clearInteractionAnswerBag(ctx);
        return [];
      }
      const chunks = splitDiscordInteractionMessage(text, DISCORD_ANSWER_SPLIT_AT);
      if (!answerOpen) {
        await answerIo.send(text);
        clearInteractionAnswerBag(ctx);
        return [];
      }
      const first = chunks[0] ?? "\u3164";
      await deliverDiscordFinalContent(
        async () => {
          await interaction.editReply({ content: first });
        },
        async () => {
          await sendFollowUpChunked(first);
        },
        { phase: "finalize" },
      );
      for (let i = 1; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk === undefined) continue;
        await withDiscordRetry(() => interaction.followUp({ content: chunk }));
      }
      answerOpen = false;
      clearInteractionAnswerBag(ctx);
      return [];
    }
    if (effect.kind === "answer_commit") {
      const result = await finalizeHandle(effect, ctx);
      if (effect.content.trim()) {
        answerOpen = false;
      }
      return result;
    }
    return finalizeHandle(effect, ctx);
  };

  const composer = createStreamChannelComposer({
    strategies: [toolStrategy, answerStrategy, createDiscordCleanupStrategy(answerIo)],
    io: {},
  });

  await runStreamChannel(events, composer, {
    platform: "discord",
    toolDisplayMode,
  });

  if (!delivered) {
    await deliverDiscordFinalContent(
      async () => {
        await interaction.editReply({ content: "(no output)" });
      },
      async () => {
        await sendFollowUpChunked("(no output)");
      },
      { kind: "slash", chunk: 0 },
    );
  }
}

function clearInteractionThrottle(ctx: { bag: Map<string, unknown> }): void {
  const key = "discord.throttleTimer";
  const timer = ctx.bag.get(key) as ReturnType<typeof setTimeout> | undefined;
  if (timer) {
    clearTimeout(timer);
    ctx.bag.delete(key);
  }
}

function clearInteractionAnswerBag(ctx: { bag: Map<string, unknown> }): void {
  ctx.bag.delete("discord.answerOpen");
  ctx.bag.delete("discord.answerBuffer");
  ctx.bag.delete("discord.firstFlushGate");
}
