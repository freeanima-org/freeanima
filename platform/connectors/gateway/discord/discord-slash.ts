import { logComponent } from "@freeanima/platform/logging";
import type { MessagingPort } from "@freeanima/platform/ports/ports/messaging-port";
import {
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";

import {
  deliverDiscordFinalContent,
  isDiscordDeliveryDegraded,
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

  if (path) parts.push(path);
  if (title) parts.push(title);
  if (all) parts.push("--all");

  return parts.length ? `/${name} ${parts.join(" ")}` : `/${name}`;
}

export function originFromInteraction(interaction: ChatInputCommandInteraction): PlatformOrigin {
  const channel = interaction.channel;
  if (!channel) {
    throw new Error("interaction has no channel");
  }
  const isThread = "isThread" in channel && channel.isThread();
  const channelId = channel.id;
  const parentChannelId =
    isThread && "parentId" in channel && channel.parentId ? String(channel.parentId) : channelId;
  return extractOrigin({
    channelId,
    parentChannelId,
    guildId: interaction.guildId ?? "",
    isThread,
  });
}

export async function syncDiscordSlashCommands(
  client: Client,
  token: string,
  service: MessagingPort,
  cfg: DiscordConfig,
): Promise<void> {
  if (cfg.slash_commands === false) return;

  const appId = client.user?.id;
  if (!appId) return;

  const { commands } = service.listCommands({ platform: "discord" });
  const body = buildDiscordSlashCommands(commands);
  const rest = new REST({ version: "10" }).setToken(token);
  const guildId = String(cfg.slash_commands_guild_id ?? "").trim();

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

  if (!chunks.length) {
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
  await deliverDiscordFinalContent(
    async () => {
      await interaction.editReply({ content: chunks[0]! });
    },
    async () => {
      if (interaction.replied || interaction.deferred) {
        await withDiscordRetry(() => interaction.followUp({ content: chunks[0]! }));
      } else {
        await sendViaChannel(chunks[0]!);
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
